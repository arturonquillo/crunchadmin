import OpenAI from "openai";
import { ASSISTANT_TOOLS } from "@/lib/assistant/tools";
import { executeAssistantTool, type ToolResult } from "@/lib/assistant/execute";

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export async function chatCompletion(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  imageDataUrls?: string[];
}): Promise<{ content: string; stub: boolean; toolResults: ToolResult[] }> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      stub: true,
      toolResults: [],
      content:
        "Asistente en modo stub (sin OPENAI_API_KEY). Con clave puedo mutar inventario, pendientes y más vía herramientas. Mientras tanto usá las pantallas o frases simples de stock.",
    };
  }

  const lastUser = params.messages.filter((m) => m.role === "user").at(-1);
  const prior = params.messages.slice(0, -1);

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const userContent: string | ContentPart[] =
    params.imageDataUrls && params.imageDataUrls.length > 0
      ? [
          { type: "text", text: lastUser?.content ?? "" },
          ...params.imageDataUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ]
      : (lastUser?.content ?? "");

  const messages: Msg[] = [
    ...prior.map((m) => ({ role: m.role, content: m.content }) as Msg),
    { role: "user", content: userContent },
  ];

  try {
    return await runWithTools(client, messages);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const code = (err as { code?: string })?.code;
    if (
      status === 429 ||
      code === "insufficient_quota" ||
      code === "credit_balance_exhausted"
    ) {
      return {
        stub: false,
        toolResults: [],
        content:
          "OpenAI está configurado, pero la cuenta no tiene créditos disponibles (cuota/billing). Agregá crédito en platform.openai.com → Settings → Billing y reintentá.",
      };
    }
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return {
      stub: false,
      toolResults: [],
      content: `No pude completar la respuesta con OpenAI (${status ?? "error"}). Detalle: ${msg.slice(0, 180)}`,
    };
  }
}

async function runWithTools(
  client: OpenAI,
  messages: Msg[]
): Promise<{ content: string; stub: boolean; toolResults: ToolResult[] }> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const collected: ToolResult[] = [];
  const maxRounds = 6;

  for (let round = 0; round < maxRounds; round++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools: ASSISTANT_TOOLS,
      tool_choice: "auto",
    });

    const choice = completion.choices[0];
    const msg = choice?.message;
    if (!msg) {
      return {
        stub: false,
        content: "(Sin respuesta del modelo)",
        toolResults: collected,
      };
    }

    const toolCalls = msg.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return {
        stub: false,
        content: msg.content?.trim() || "(Sin respuesta del modelo)",
        toolResults: collected,
      };
    }

    messages.push({
      role: "assistant",
      content: msg.content || null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const result = await executeAssistantTool(
        call.function.name,
        call.function.arguments || "{}"
      );
      collected.push(result);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    stub: false,
    content:
      "Alcancé el límite de pasos de herramientas. Revisá el resultado parcial o pedime que continúe.",
    toolResults: collected,
  };
}
