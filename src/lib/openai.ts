import OpenAI from "openai";

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function chatCompletion(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  imageDataUrls?: string[];
}): Promise<{ content: string; stub: boolean }> {
  const client = getOpenAIClient();
  if (!client) {
    return {
      stub: true,
      content:
        "Asistente en modo stub (sin OPENAI_API_KEY). Puedo ayudarte a priorizar pendientes, escalar recetas y revisar el menú cuando configures la API. Mientras tanto: revisa Pendientes de prioridad alta y usa el escalado de recetas con cualquier ingrediente base.",
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

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      ...prior,
      { role: "user", content: userContent },
    ],
  });

  return {
    stub: false,
    content:
      completion.choices[0]?.message?.content?.trim() ||
      "(Sin respuesta del modelo)",
  };
}
