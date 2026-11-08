"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  detectSpeechSupport,
  preferredSpeechLang,
  speechErrorMessage,
  type SpeechRecognitionLike,
} from "@/lib/speech";

function IconMic() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  onClose: () => void;
  /** Start listening in the same turn as the Hablar tap when possible */
  autoStart?: boolean;
};

export function SpeakSheet({ onClose, autoStart = false }: Props) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [support] = useState(() => detectSpeechSupport());

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stoppingRef = useRef(false);
  const baseTextRef = useRef("");

  const stopMic = useCallback(() => {
    stoppingRef.current = true;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    try {
      rec?.stop();
    } catch {
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
    setInterim("");
  }, []);

  const startMic = useCallback(() => {
    setStatus(null);
    setReply(null);

    const current = detectSpeechSupport();
    if (!current.ok || !current.ctor) {
      setStatus(current.reason || "Dictado no disponible. Escribí el mensaje.");
      return;
    }

    // Restart cleanly if a session is already open
    if (recognitionRef.current) {
      stoppingRef.current = true;
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }

    stoppingRef.current = false;
    baseTextRef.current = text;
    const recognition = new current.ctor();
    recognition.lang = preferredSpeechLang();
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setStatus("Escuchando… hablá ahora");
    };

    recognition.onaudiostart = () => {
      setStatus("Micrófono activo…");
    };

    recognition.onerror = (ev) => {
      if (stoppingRef.current || ev.error === "aborted") return;
      const msg = speechErrorMessage(ev.error);
      if (msg) setStatus(msg);
      setListening(false);
      setInterim("");
    };

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const piece = res[0]?.transcript || "";
        if (res.isFinal) finalChunk += piece;
        else interimChunk += piece;
      }
      if (finalChunk) {
        const next = (baseTextRef.current ? `${baseTextRef.current} ` : "") + finalChunk.trim();
        baseTextRef.current = next.trim();
        setText(baseTextRef.current);
        setInterim("");
        setStatus("Texto capturado — podés seguir hablando o Enviar");
      } else {
        setInterim(interimChunk);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
      // Auto-restart only if user didn't stop (some mobile browsers end after a pause)
      if (!stoppingRef.current) {
        // Leave stopped after a natural end so user can tap again; continuous already covers pauses better
        setStatus((s) =>
          s && s.startsWith("Permiso")
            ? s
            : "Dictado en pausa. Tocá Dictar para continuar o Enviar."
        );
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setListening(false);
      setStatus(
        `No se pudo iniciar el micrófono. ${err instanceof Error ? err.message : "Reintentá."}`
      );
    }
  }, [text]);

  useEffect(() => {
    return () => {
      stoppingRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Try auto-start when Hablar was opened by a user tap (best-effort; may still need Dictar on some browsers)
  useEffect(() => {
    if (!autoStart) return;
    // Defer one frame so the sheet is painted; still often counts as gesture on Chromium
    const t = window.setTimeout(() => startMic(), 0);
    return () => window.clearTimeout(t);
    // intentionally once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = (text + (interim ? ` ${interim}` : "")).trim();
    if (!payload) return;
    stopMic();
    setSending(true);
    setReply(null);
    setStatus(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: payload, source: "speak" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Error al enviar");
        return;
      }
      setReply(data.assistantMessage?.content || "Registrado.");
      setText("");
      baseTextRef.current = "";
      setInterim("");
    } catch (err) {
      setStatus(String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="speak-sheet-root"
      role="dialog"
      aria-modal="true"
      aria-label="Informar al sistema"
    >
      <div className="speak-backdrop" onClick={onClose} />
      <div className="speak-sheet">
        <div className="speak-sheet-head">
          <div>
            <p className="zone-sheet-kicker">Asistente</p>
            <h2>Decile al sistema</h2>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              stopMic();
              onClose();
            }}
          >
            Cerrar
          </button>
        </div>
        <p className="section-sub" style={{ marginTop: 0 }}>
          Dictá o escribí. Ej.: «agrega 20 kg de harina» o «limpiar el salón principal».
        </p>

        {!support.ok && (
          <p className="speak-unsupported" role="status">
            {support.reason}
          </p>
        )}

        <form onSubmit={onSubmit} className="speak-form">
          <div className="speak-mic-row">
            <button
              type="button"
              className={`btn speak-mic-btn ${listening ? "listening" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (listening) stopMic();
                else startMic();
              }}
              aria-pressed={listening}
              disabled={!support.ok}
            >
              <IconMic />
              {listening ? "Detener" : "Dictar"}
            </button>
            {listening && <span className="speak-live-dot" aria-hidden />}
          </div>

          {interim && (
            <p className="speak-interim" aria-live="polite">
              <em>{interim}</em>
            </p>
          )}

          <div className="field">
            <label htmlFor="speak-text">Mensaje</label>
            <textarea
              id="speak-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                baseTextRef.current = e.target.value;
              }}
              placeholder="Escribí o tocá Dictar…"
              rows={3}
            />
          </div>
          {status && (
            <p className={status.startsWith("Escuchando") || status.startsWith("Micrófono") || status.startsWith("Texto") ? "speak-status" : "error"}>
              {status}
            </p>
          )}
          {reply && <p className="speak-reply">{reply}</p>}
          <div className="form-actions">
            <button className="btn" type="submit" disabled={sending || !text.trim()}>
              {sending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
