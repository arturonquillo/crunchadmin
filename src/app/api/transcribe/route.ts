import { NextRequest, NextResponse } from "next/server";
import { isOpenAIConfigured, transcribeAudio } from "@/lib/openai";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export async function GET() {
  return NextResponse.json({
    configured: isOpenAIConfigured(),
    model: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
    hint: "POST multipart field «audio» (webm/mp4/wav/m4a).",
  });
}

export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY no configurada. No hay transcripción backend disponible.",
      },
      { status: 503 }
    );
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Enviá multipart/form-data con el campo audio." },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Falta el archivo audio." },
      { status: 400 }
    );
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Audio vacío." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Audio demasiado grande (máx. 12 MB)." },
      { status: 413 }
    );
  }

  const language = String(form.get("language") || "es").slice(0, 8);
  const buf = Buffer.from(await file.arrayBuffer());
  const filename =
    file.name && file.name.includes(".")
      ? file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      : guessFilename(file.type);

  const result = await transcribeAudio({
    bytes: buf,
    filename,
    mimeType: file.type || undefined,
    language,
  });

  if (result.error && !result.text) {
    return NextResponse.json(
      { error: result.error, text: "" },
      { status: result.stub ? 503 : 502 }
    );
  }

  return NextResponse.json({
    text: result.text,
    filename,
    bytes: buf.length,
  });
}

function guessFilename(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) {
    return "hablar.m4a";
  }
  if (mime.includes("wav")) return "hablar.wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "hablar.mp3";
  if (mime.includes("ogg")) return "hablar.ogg";
  return "hablar.webm";
}
