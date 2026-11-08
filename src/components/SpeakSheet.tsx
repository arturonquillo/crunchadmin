"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  detectRecorderSupport,
  extensionForMime,
} from "@/lib/media-record";
import {
  widgetsFromActionsJson,
  type ChatWidget,
  type ConfirmWidget,
  type ChoiceWidget,
} from "@/lib/assistant/widgets";

function IconMic() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconSend() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  kind: string;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  actionsJson?: string | null;
  attachments?: Attachment[];
  widgets?: ChatWidget[];
};

type Props = {
  onClose: () => void;
  autoStart?: boolean;
};

function ConfirmActionWidget({
  widget,
  active,
  busy,
  onConfirm,
  onCancel,
}: {
  widget: ConfirmWidget;
  active: boolean;
  busy: boolean;
  onConfirm: (code: string) => void;
  onCancel: (code: string) => void;
}) {
  return (
    <div className={`chat-widget confirm ${active ? "active" : "spent"}`}>
      <p className="chat-widget-title">{widget.title}</p>
      <p className="chat-widget-summary">{widget.summary}</p>
      {active ? (
        <div className="chat-widget-actions">
          <button
            type="button"
            className="btn chat-widget-confirm"
            disabled={busy}
            onClick={() => onConfirm(widget.code)}
          >
            {widget.confirmLabel}
          </button>
          <button
            type="button"
            className="btn ghost chat-widget-cancel"
            disabled={busy}
            onClick={() => onCancel(widget.code)}
          >
            {widget.cancelLabel}
          </button>
        </div>
      ) : (
        <p className="chat-widget-spent">Acción ya resuelta o vencida.</p>
      )}
    </div>
  );
}

function ChoiceActionWidget({
  widget,
  busy,
  onPick,
}: {
  widget: ChoiceWidget;
  busy: boolean;
  onPick: (message: string) => void;
}) {
  return (
    <div className="chat-widget choices">
      <p className="chat-widget-title">{widget.prompt}</p>
      <div className="chat-widget-actions wrap">
        {widget.options.map((opt) => (
          <button
            key={opt.message}
            type="button"
            className="btn ghost chat-choice"
            disabled={busy}
            onClick={() => onPick(opt.message)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SpeakSheet({ onClose, autoStart = false }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [whisperOk, setWhisperOk] = useState<boolean | null>(null);
  const [recorderSupport] = useState(() => detectRecorderSupport());
  const [booting, setBooting] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>("");
  const baseTextRef = useRef("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const micReady = Boolean(whisperOk && recorderSupport.ok);
  const micBusy = recording || transcribing;

  const hydrateMessage = useCallback((m: ChatMessage): ChatMessage => {
    const widgets =
      m.widgets && m.widgets.length > 0
        ? m.widgets
        : widgetsFromActionsJson(m.actionsJson, m.id);
    return { ...m, widgets };
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/chat");
    const data = await res.json();
    const pending = new Set<string>(
      (data.pending || []).map((p: { code: string }) => String(p.code).toUpperCase())
    );
    setPendingCodes(pending);
    setMessages((data.messages || []).map((m: ChatMessage) => hydrateMessage(m)));
  }, [hydrateMessage]);

  useEffect(() => {
    Promise.all([
      loadHistory(),
      fetch("/api/transcribe")
        .then((r) => r.json())
        .then((d) => setWhisperOk(Boolean(d.configured)))
        .catch(() => setWhisperOk(false)),
    ])
      .catch((err) => setStatus(String(err)))
      .finally(() => setBooting(false));
  }, [loadHistory]);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, transcribing]);

  const releaseStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  const appendTranscript = useCallback((said: string) => {
    const piece = said.trim();
    if (!piece) return;
    const next = (baseTextRef.current ? `${baseTextRef.current} ` : "") + piece;
    baseTextRef.current = next.trim();
    setText(baseTextRef.current);
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      setTranscribing(true);
      setStatus("Transcribiendo con IA…");
      try {
        const ext = extensionForMime(mimeType || blob.type);
        const form = new FormData();
        form.append("audio", blob, `hablar.${ext}`);
        form.append("language", "es");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          setStatus(data.error || "No se pudo transcribir.");
          return;
        }
        if (!data.text) {
          setStatus("No escuché texto claro. Probá de nuevo cerca del mic.");
          return;
        }
        appendTranscript(String(data.text));
        setStatus("Texto listo — podés editar o Enviar.");
      } catch (err) {
        setStatus(String(err));
      } finally {
        setTranscribing(false);
      }
    },
    [appendTranscript]
  );

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    } else {
      setRecording(false);
      releaseStream();
    }
  }, [releaseStream]);

  const startRecording = useCallback(async () => {
    setStatus(null);
    if (!whisperOk) {
      setStatus(
        "Transcripción por IA no disponible (falta OPENAI_API_KEY). Escribí el mensaje."
      );
      return;
    }
    if (!recorderSupport.ok) {
      setStatus(recorderSupport.reason || "Grabación no disponible.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const mime = recorderSupport.mimeType || "";
      mimeRef.current = mime;
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onerror = () => {
        setStatus("Error al grabar audio.");
        setRecording(false);
        releaseStream();
      };
      recorder.onstop = () => {
        setRecording(false);
        const type = mimeRef.current || recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        releaseStream();
        mediaRecorderRef.current = null;
        if (blob.size < 400) {
          setStatus("Grabación muy corta. Mantené el mic un segundo y hablá.");
          return;
        }
        void transcribeBlob(blob, type);
      };

      mediaRecorderRef.current = recorder;
      // timeslice helps some iOS builds flush audio chunks
      recorder.start(250);
      setRecording(true);
      setStatus("Grabando… tocá el mic otra vez para cortar");
    } catch (err) {
      releaseStream();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus(
          "Permiso de micrófono denegado. Activá el mic en Ajustes → Safari y reintentá."
        );
      } else {
        setStatus(
          err instanceof Error ? err.message : "No se pudo abrir el micrófono."
        );
      }
      setRecording(false);
    }
  }, [whisperOk, recorderSupport, releaseStream, transcribeBlob]);

  const toggleMic = useCallback(() => {
    if (transcribing) return;
    if (recording) stopRecording();
    else void startRecording();
  }, [transcribing, recording, stopRecording, startRecording]);

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      releaseStream();
    };
  }, [releaseStream]);

  useEffect(() => {
    if (!autoStart) return;
    const t = window.setTimeout(() => {
      void startRecording();
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const sendMessage = useCallback(
    async (payload: string) => {
      const clean = payload.trim();
      if (!clean || sending) return;
      if (recording) stopRecording();
      setSending(true);
      setStatus(null);
      const tempId = `local-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          role: "USER",
          content: clean,
          createdAt: new Date().toISOString(),
        },
      ]);
      setText("");
      baseTextRef.current = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: clean, source: "speak" }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus(data.error || "Error al enviar");
          await loadHistory();
          return;
        }
        await loadHistory();
      } catch (err) {
        setStatus(String(err));
        await loadHistory();
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [sending, recording, stopRecording, loadHistory]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await sendMessage(text);
  }

  async function onConfirmWidget(code: string) {
    await sendMessage(`CONFIRMAR ${code}`);
  }

  async function onCancelWidget(code: string) {
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_pending", code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error || "No se pudo cancelar");
      }
      await loadHistory();
    } catch (err) {
      setStatus(String(err));
    } finally {
      setSending(false);
    }
  }

  const micHint =
    whisperOk === false
      ? "Sin OPENAI_API_KEY no hay dictado por IA. Escribí el mensaje."
      : !recorderSupport.ok
        ? recorderSupport.reason || null
        : null;

  return (
    <div
      className="hablar-root"
      role="dialog"
      aria-modal="true"
      aria-label="Asistente Crunchadmin"
    >
      <div
        className="hablar-backdrop"
        onClick={() => {
          stopRecording();
          onClose();
        }}
      />
      <div className="hablar-panel">
        <header className="hablar-head">
          <div className="hablar-head-text">
            <p className="hablar-kicker">Asistente · Whisper</p>
            <h2>Hablar</h2>
          </div>
          <button
            type="button"
            className="hablar-close"
            aria-label="Cerrar chat"
            onClick={() => {
              stopRecording();
              onClose();
            }}
          >
            <IconClose />
          </button>
        </header>

        <div className="hablar-log" ref={logRef}>
          {booting && <p className="hablar-empty">Cargando historial…</p>}
          {!booting && messages.length === 0 && (
            <div className="hablar-empty">
              <p>Conversá con el sistema.</p>
              <p className="muted">
                Tocá el mic, hablá, tocá de nuevo: la IA pasa tu voz a texto
                (mejor que el dictado nativo de iPhone).
              </p>
            </div>
          )}
          {messages.map((m) => {
            if (m.role === "SYSTEM") return null;
            const isUser = m.role === "USER";
            return (
              <div
                key={m.id}
                className={`hablar-bubble ${isUser ? "user" : "assistant"}`}
              >
                <span className="hablar-meta">
                  {isUser ? "Vos" : "Crunchadmin"} ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="hablar-bubble-body">{m.content}</div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="chat-attach">
                    {m.attachments.map((a) => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                        {a.filename}
                      </a>
                    ))}
                  </div>
                )}
                {!isUser &&
                  m.widgets?.map((w) => {
                    if (w.type === "confirm") {
                      const active = pendingCodes.has(w.code.toUpperCase());
                      return (
                        <ConfirmActionWidget
                          key={w.id}
                          widget={w}
                          active={active}
                          busy={sending}
                          onConfirm={onConfirmWidget}
                          onCancel={onCancelWidget}
                        />
                      );
                    }
                    if (w.type === "choices") {
                      return (
                        <ChoiceActionWidget
                          key={w.id}
                          widget={w}
                          busy={sending}
                          onPick={sendMessage}
                        />
                      );
                    }
                    return null;
                  })}
              </div>
            );
          })}
          {sending && (
            <div className="hablar-bubble assistant typing">
              <span className="hablar-meta">Crunchadmin</span>
              <div className="hablar-typing-dots" aria-label="Escribiendo">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>

        {micHint && (
          <p className="speak-unsupported hablar-banner" role="status">
            {micHint}
          </p>
        )}
        {status && <p className="hablar-status">{status}</p>}

        <form className="hablar-composer" onSubmit={onSubmit}>
          <button
            type="button"
            className={`hablar-mic ${recording ? "listening" : ""} ${transcribing ? "transcribing" : ""}`}
            aria-label={
              recording
                ? "Detener grabación"
                : transcribing
                  ? "Transcribiendo"
                  : "Grabar y transcribir"
            }
            aria-pressed={recording}
            disabled={!micReady || transcribing}
            onClick={(e) => {
              e.preventDefault();
              toggleMic();
            }}
          >
            <IconMic />
          </button>
          <textarea
            ref={inputRef}
            className="hablar-input"
            value={text}
            rows={1}
            placeholder={
              recording
                ? "Grabando…"
                : transcribing
                  ? "Transcribiendo…"
                  : "Escribí o tocá el mic…"
            }
            onChange={(e) => {
              setText(e.target.value);
              baseTextRef.current = e.target.value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(text);
              }
            }}
          />
          <button
            type="submit"
            className="hablar-send"
            disabled={sending || micBusy || !text.trim()}
            aria-label="Enviar"
          >
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  );
}
