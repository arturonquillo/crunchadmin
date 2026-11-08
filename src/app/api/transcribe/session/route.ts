import { NextResponse } from "next/server";
import { getOpenAIClient, isOpenAIConfigured } from "@/lib/openai";

export const runtime = "nodejs";

/**
 * Mint a short-lived Realtime client secret for browser WebRTC / WS transcription.
 * Never exposes OPENAI_API_KEY to the client.
 */
export async function POST() {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY no configurada." },
      { status: 503 }
    );
  }

  const client = getOpenAIClient();
  if (!client) {
    return NextResponse.json({ error: "OpenAI no disponible." }, { status: 503 });
  }

  const model =
    process.env.OPENAI_LIVE_TRANSCRIBE_MODEL || "gpt-live-transcribe";

  try {
    // Prefer live streaming model; fall back to mini-transcribe with server VAD
    type Secret = {
      value: string;
      expires_at: number;
      session?: { audio?: { input?: { transcription?: { model?: string } } } };
    };
    let secret: Secret;
    try {
      secret = (await client.realtime.clientSecrets.create({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              transcription: {
                model,
                languages: ["es"],
                delay: "low",
                prompt:
                  "Dictado operativo de restaurante en español (insumos, kilos, litros, pendientes).",
              },
              turn_detection: null,
            },
          },
        } as never,
      })) as Secret;
    } catch {
      secret = (await client.realtime.clientSecrets.create({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              transcription: {
                model: "gpt-4o-mini-transcribe",
                language: "es",
                prompt:
                  "Dictado operativo de restaurante en español (insumos, kilos, litros, pendientes).",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 600,
              },
            },
          },
        },
      })) as Secret;
    }

    return NextResponse.json({
      value: secret.value,
      expires_at: secret.expires_at,
      model: secret.session?.audio?.input?.transcription?.model || model,
      mode: "realtime",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error creando sesión";
    return NextResponse.json(
      { error: `No pude crear sesión realtime: ${msg.slice(0, 180)}` },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    configured: isOpenAIConfigured(),
    hint: "POST → ephemeral client secret for Hablar live transcription",
  });
}
