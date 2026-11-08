/** Pick a MediaRecorder MIME that works on the current browser (esp. iOS Safari). */

export type RecorderSupport = {
  ok: boolean;
  mimeType: string | null;
  reason?: string;
};

const CANDIDATES = [
  "audio/mp4",
  "audio/aac",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

export function detectRecorderSupport(): RecorderSupport {
  if (typeof window === "undefined") {
    return { ok: false, mimeType: null, reason: "ssr" };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      mimeType: null,
      reason: "Este navegador no permite acceso al micrófono (getUserMedia).",
    };
  }
  if (typeof MediaRecorder === "undefined") {
    return {
      ok: false,
      mimeType: null,
      reason: "MediaRecorder no está disponible en este navegador.",
    };
  }

  for (const mime of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return { ok: true, mimeType: mime };
    }
  }
  // Some iOS builds accept MediaRecorder with empty mimeType
  return { ok: true, mimeType: "" };
}

export function extensionForMime(mime: string | null | undefined): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
}
