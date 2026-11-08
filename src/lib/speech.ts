/** Browser speech-recognition helpers for Hablar dictation */

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onstart: ((ev?: Event) => void) | null;
  onerror: ((ev: { error: string; message?: string }) => void) | null;
  onend: ((ev?: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onaudiostart?: ((ev?: Event) => void) | null;
  onspeechend?: ((ev?: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    length: number;
    [index: number]: { transcript: string; confidence: number };
  }>;
};

export type SpeechSupport = {
  ok: boolean;
  secure: boolean;
  ctor: (new () => SpeechRecognitionLike) | null;
  reason?: string;
};

export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function detectSpeechSupport(): SpeechSupport {
  if (typeof window === "undefined") {
    return { ok: false, secure: false, ctor: null, reason: "ssr" };
  }
  const secure = window.isSecureContext === true;
  const ctor = getSpeechRecognitionCtor();
  if (!secure) {
    return {
      ok: false,
      secure: false,
      ctor,
      reason:
        "El dictado requiere HTTPS (o localhost). Abrí la preview por el túnel https://…trycloudflare.com",
    };
  }
  if (!ctor) {
    return {
      ok: false,
      secure,
      ctor: null,
      reason:
        "Este navegador no soporta dictado por voz (Web Speech API). En iPhone/iPad probá Safari; en Android, Chrome. Podés escribir el mensaje abajo.",
    };
  }
  return { ok: true, secure, ctor };
}

export function preferredSpeechLang(): string {
  if (typeof navigator === "undefined") return "es-AR";
  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("es")) {
    // Prefer regional if browser already reports one
    if (nav.length >= 5) return navigator.language;
    return "es-AR";
  }
  return "es-AR";
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permiso de micrófono denegado. Activá el mic en la barra del navegador y tocá Dictar de nuevo.";
    case "no-speech":
      return "No escuché nada. Tocá Dictar y hablá cerca del micrófono.";
    case "audio-capture":
      return "No hay micrófono disponible o está en uso por otra app.";
    case "network":
      return "Error de red del servicio de dictado. Reintentá en unos segundos.";
    case "aborted":
      return ""; // user or programmatic stop — not an error to show
    case "language-not-supported":
      return "Idioma no soportado. Reintentando en español…";
    default:
      return `No se pudo dictar (${code || "error"}). Usá el texto.`;
  }
}
