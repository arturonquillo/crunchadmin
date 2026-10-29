import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatCompletion, isOpenAIConfigured } from "@/lib/openai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

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
          content:
            "Eres el asistente de Crunchadmin para un restaurante. Ayudas con pendientes, recetas (incluyendo escalado) y menú multi-plataforma. Responde siempre en español. Para cambios sensibles pide confirmación.",
        },
      },
    },
  });
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
  const recetas = await prisma.receta.findMany({ take: 10, select: { name: true } });

  const systemExtra = `Contexto operativo Crunchadmin:
Pendientes abiertos: ${pendientes.map((p) => `[${p.prioridad}] ${p.title} (${p.categoria})`).join("; ") || "ninguno"}
Recetas: ${recetas.map((r) => r.name).join(", ") || "ninguna"}`;

  const messages = [
    {
      role: "system" as const,
      content:
        "Eres el asistente de Crunchadmin. Responde en español. " + systemExtra,
    },
    ...history
      .filter((m) => m.role !== "SYSTEM")
      .map((m) => ({
        role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
  ];

  const result = await chatCompletion({ messages, imageDataUrls });

  const assistantMsg = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "ASSISTANT",
      content: result.content,
      actionsJson: result.stub ? JSON.stringify({ stub: true }) : null,
    },
  });

  await prisma.chatThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({
    stub: result.stub,
    userMessage: userMsg,
    assistantMessage: assistantMsg,
  });
}
