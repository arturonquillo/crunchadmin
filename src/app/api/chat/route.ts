import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatCompletion, isOpenAIConfigured } from "@/lib/openai";
import {
  matchInsumoName,
  parseInventoryIntent,
  toBaseQty,
} from "@/lib/chat-inventory";
import { formatQty } from "@/lib/inventory";
import { SYSTEM_PROMPT } from "@/lib/assistant/tools";
import {
  takePendingByCode,
  takeLatestPending,
  peekLatestPending,
  matchesConfirmSecret,
  getConfirmSecret,
} from "@/lib/assistant/confirm-store";
import {
  executeAssistantTool,
  executeConfirmedAction,
} from "@/lib/assistant/execute";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/** Bare «CONFIRMAR» / «confirmo» without the 6-char code — owner often replies that way. */
function isBareConfirm(text: string): boolean {
  const t = text.trim();
  // Do NOT treat bare «sí» as confirm — too ambiguous in chat.
  return /^(confirmar|confirmo|sí\s*confirmo|si\s*confirmo)\s*[.!]?$/i.test(t);
}

async function getOrCreateThread() {
  const existing = await prisma.chatThread.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return prisma.chatThread.create({
    data: {
      title: "Operación diaria",
      messages: {
        create: {
          role: "SYSTEM",
          content: SYSTEM_PROMPT,
        },
      },
    },
  });
}

/** Legacy regex path — still used as offline/stub fallback for stock phrases */
async function applyInventoryFromText(text: string): Promise<{
  applied: boolean;
  summary: string | null;
  actions: Record<string, unknown> | null;
}> {
  const intent = parseInventoryIntent(text);
  if (!intent) {
    return { applied: false, summary: null, actions: null };
  }

  const insumos = await prisma.insumo.findMany();
  let match = matchInsumoName(insumos, intent.nameQuery);

  // Create on add if missing (align with tool behavior)
  if (!match && intent.kind === "add") {
    match = await prisma.insumo.create({
      data: {
        name: intent.nameQuery.replace(/\b\w/g, (c) => c.toUpperCase()),
        baseUnit: intent.unit,
        category: "SECOS",
        quantityOnHand: 0,
        packSize: intent.quantity,
      },
    });
  }

  if (!match) {
    return {
      applied: false,
      summary: `No encontré el insumo «${intent.nameQuery}» en inventario.`,
      actions: { inventory: { intent, matched: false } },
    };
  }

  const converted = toBaseQty(intent.quantity, intent.unit, match.baseUnit);
  if (!converted.ok) {
    return {
      applied: false,
      summary: converted.error,
      actions: { inventory: { intent, matched: true, error: converted.error } },
    };
  }

  const before = match.quantityOnHand;
  const after =
    intent.kind === "set"
      ? converted.quantity
      : Math.round((before + converted.quantity) * 10000) / 10000;
  const delta = Math.round((after - before) * 10000) / 10000;

  await prisma.insumo.update({
    where: { id: match.id },
    data: { quantityOnHand: after },
  });
  await prisma.inventoryMovement.create({
    data: {
      insumoId: match.id,
      kind: "CHAT",
      delta,
      note: text.slice(0, 200),
    },
  });

  const summary =
    intent.kind === "set"
      ? `Actualicé «${match.name}» a ${formatQty(after, match.baseUnit)} (antes ${formatQty(before, match.baseUnit)}).`
      : `Sumé ${formatQty(converted.quantity, match.baseUnit)} a «${match.name}». Ahora hay ${formatQty(after, match.baseUnit)}.`;

  return {
    applied: true,
    summary,
    actions: {
      inventory: {
        intent,
        insumoId: match.id,
        name: match.name,
        before,
        after,
        delta,
      },
    },
  };
}

function parseConfirmCode(text: string): string | null {
  const m = text.trim().match(/^CONFIRMAR\s+([A-Za-z0-9_-]+)\s*$/i);
  // Ignore bare CONFIRMAR (handled by isBareConfirm → latest pending)
  if (!m) return null;
  const code = m[1];
  if (!code || /^(confirmar|confirmo|sí|si)$/i.test(code)) return null;
  return code;
}

export async function GET() {
  const thread = await getOrCreateThread();
  const messages = await prisma.chatMessage.findMany({
    where: { threadId: thread.id, role: { not: "SYSTEM" } },
    orderBy: { createdAt: "asc" },
    include: { attachments: true },
  });
  return NextResponse.json({
    threadId: thread.id,
    openaiConfigured: isOpenAIConfigured(),
    confirmSecretConfigured: Boolean(getConfirmSecret()),
    messages,
  });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let text = "";
  const imageDataUrls: string[] = [];
  const savedAttachments: {
    filename: string;
    mimeType: string;
    url: string;
    kind: string;
  }[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    text = String(form.get("message") ?? "").trim();
    const files = form.getAll("files");
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    for (const file of files) {
      if (!(file instanceof File)) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      const safe = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const diskPath = path.join(uploadDir, safe);
      await writeFile(diskPath, buf);
      const url = `/uploads/${safe}`;
      const mime = file.type || "application/octet-stream";
      const kind = mime.startsWith("image/")
        ? "image"
        : mime.startsWith("audio/")
          ? "audio"
          : "file";
      savedAttachments.push({ filename: file.name, mimeType: mime, url, kind });
      if (kind === "image") {
        const b64 = buf.toString("base64");
        imageDataUrls.push(`data:${mime};base64,${b64}`);
      }
    }
  } else {
    const body = await req.json();
    text = String(body.message ?? "").trim();
  }

  if (!text && savedAttachments.length === 0) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const thread = await getOrCreateThread();
  const userContent =
    text ||
    `(Adjunto: ${savedAttachments.map((a) => a.filename).join(", ")})`;

  const userMsg = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "USER",
      content: userContent,
      attachments: {
        create: savedAttachments,
      },
    },
    include: { attachments: true },
  });

  // —— Fast-path: destructive intents staged server-side (never trust the model alone) ——
  if (text && !parseConfirmCode(text)) {
    const lower = text.toLowerCase();
    const clearAll =
      /elimin[ae].*todos?\s+los\s+insumos|borr[ae].*todos?\s+los\s+insumos|vaciar?\s+(el\s+)?inventario|clear\s+all\s+inventory/.test(
        lower
      );
    const delInsumo = lower.match(
      /(?:elimin[ae]|borr[ae])\s+(?:el\s+)?insumo\s+(.+)$/i
    );
    if (clearAll) {
      const staged = await executeAssistantTool("inventory_clear_all", "{}");
      const assistantMsg = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          role: "ASSISTANT",
          content: staged.summary,
          actionsJson: JSON.stringify({ toolResults: [staged], staged: true }),
        },
      });
      return NextResponse.json({
        stub: false,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        toolResults: [staged],
      });
    }
    if (delInsumo?.[1]) {
      const staged = await executeAssistantTool(
        "inventory_delete",
        JSON.stringify({ name: delInsumo[1].trim() })
      );
      const assistantMsg = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          role: "ASSISTANT",
          content: staged.summary,
          actionsJson: JSON.stringify({ toolResults: [staged], staged: true }),
        },
      });
      return NextResponse.json({
        stub: false,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        toolResults: [staged],
      });
    }
  }

  // —— Confirmation gate (destructive actions) ——
  // Accept: CONFIRMAR <código> | bare CONFIRMAR/confirmo/sí | ASSISTANT_CONFIRM_SECRET
  const confirmCode = text ? parseConfirmCode(text) : null;
  const bareConfirm = text ? isBareConfirm(text) : false;
  if (confirmCode || bareConfirm || (text && matchesConfirmSecret(text))) {
    let pending = confirmCode ? takePendingByCode(confirmCode) : null;
    if (!pending && (bareConfirm || (text && matchesConfirmSecret(text)))) {
      pending = takeLatestPending();
    }

    if (!pending) {
      const hint = peekLatestPending();
      const assistantMsg = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          role: "ASSISTANT",
          content: hint
            ? `Todavía hay una acción pendiente: ${hint.summary}. Respondé: CONFIRMAR ${hint.code}`
            : "No hay una acción pendiente (o expiró a los 5 minutos). Pedí de nuevo la acción destructiva.",
          actionsJson: JSON.stringify({ confirm: "expired_or_missing" }),
        },
      });
      return NextResponse.json({
        stub: false,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
      });
    }

    const result = await executeConfirmedAction(pending.kind, pending.payload);
    const assistantMsg = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "ASSISTANT",
        content: result.summary,
        actionsJson: JSON.stringify({
          confirmed: true,
          kind: pending.kind,
          ok: result.ok,
          code: pending.code,
        }),
      },
    });
    await prisma.chatThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });
    return NextResponse.json({
      stub: false,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      confirmed: result,
    });
  }

  const history = await prisma.chatMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  const pendientes = await prisma.pendiente.findMany({
    where: { estado: { not: "HECHO" } },
    take: 15,
    orderBy: { updatedAt: "desc" },
  });
  const recetas = await prisma.receta.findMany({
    take: 10,
    select: { name: true },
  });
  const insumos = await prisma.insumo.findMany({
    take: 25,
    orderBy: { name: "asc" },
    select: {
      name: true,
      quantityOnHand: true,
      baseUnit: true,
      minQty: true,
      category: true,
    },
  });

  const systemExtra = `Contexto operativo Crunchadmin:
Pendientes abiertos: ${pendientes.map((p) => `[${p.prioridad}] ${p.title} (${p.categoria}/${p.zone})`).join("; ") || "ninguno"}
Recetas: ${recetas.map((r) => r.name).join(", ") || "ninguna"}
Inventario: ${insumos.map((i) => `${i.name}=${i.quantityOnHand}${i.baseUnit}`).join("; ") || "vacío"}`;

  let assistantContent: string;
  let stub = false;
  let toolResults: unknown[] = [];
  let legacyInventory: unknown = null;

  if (!isOpenAIConfigured()) {
    // Offline: regex stock only
    const inventoryResult = text
      ? await applyInventoryFromText(text)
      : { applied: false, summary: null, actions: null };
    legacyInventory = inventoryResult.actions;
    stub = true;
    assistantContent = inventoryResult.summary
      ? `${inventoryResult.summary}\n\n(Modo stub sin OPENAI_API_KEY — solo frases de stock. Con API key uso herramientas completas.)`
      : "Asistente en modo stub (sin OPENAI_API_KEY). Configurá la clave para controlar inventario, pendientes y más por voz/texto.";
  } else {
    const messages = [
      {
        role: "system" as const,
        content: `${SYSTEM_PROMPT}\n\n${systemExtra}`,
      },
      ...history
        .filter((m) => m.role !== "SYSTEM")
        .map((m) => ({
          role: (m.role === "USER" ? "user" : "assistant") as
            | "user"
            | "assistant",
          content: m.content,
        })),
    ];

    const result = await chatCompletion({ messages, imageDataUrls });
    stub = result.stub;
    assistantContent = result.content;
    toolResults = result.toolResults || [];

    // Guard: model must never claim a destructive mutation without a tool result
    const claimedDone =
      /elimin[eé].*insumos|inventario vaciad|borr[eé].*todos|ya (lo )?elimin/i.test(
        assistantContent
      );
    const toolsRan = Array.isArray(toolResults) && toolResults.length > 0;
    if (claimedDone && !toolsRan) {
      const pendingHint = peekLatestPending();
      assistantContent = pendingHint
        ? `Todavía no borré nada. Hay una acción pendiente (${pendingHint.summary}). Para ejecutarla de verdad respondé exactamente: CONFIRMAR ${pendingHint.code} (también vale solo «CONFIRMAR»).`
        : "Todavía no borré nada: no corrí ninguna herramienta. Pedí de nuevo la acción (ej. «eliminá todos los insumos») y después confirmá con el código.";
    }
  }

  const assistantMsg = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "ASSISTANT",
      content: assistantContent,
      actionsJson: JSON.stringify({
        stub,
        toolResults,
        ...(legacyInventory ? { inventory: legacyInventory } : {}),
      }),
    },
  });

  await prisma.chatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    stub,
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    toolResults,
  });
}
