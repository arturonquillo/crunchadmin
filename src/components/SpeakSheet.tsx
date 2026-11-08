"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  detectSpeechSupport,
  preferredSpeechLang,
  speechErrorMessage,
  type SpeechRecognitionLike,
} from "@/lib/speech";
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
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [support] = useState(() => detectSpeechSupport());
  const [booting, setBooting] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stoppingRef = useRef(false);
  const baseTextRef = useRef("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hydrateMessage = useCallback(
    (m: ChatMessage, livePending: Set<string>): ChatMessage => {
      const widgets = (m.widgets && m.widgets.length > 0
        ? m.widgets
        : widgetsFromActionsJson(m.actionsJson, m.id)
      ).map((w) => {
        if (w.type !== "confirm") return w;
        // Mark spent if code no longer pending
        return w;
      });
      return { ...m, widgets };
    },
    []
  );

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/chat");
    const data = await res.json();
    const pending = new Set<string>(
      (data.pending || []).map((p: { code: string }) => String(p.code).toUpperCase())
    );
    setPendingCodes(pending);
    const msgs: ChatMessage[] = (data.messages || []).map((m: ChatMessage) =>
      hydrateMessage(m, pending)
    );
    setMessages(msgs);
  }, [hydrateMessage]);

  useEffect(() => {
    loadHistory()
      .catch((err) => setStatus(String(err)))
      .finally(() => setBooting(false));
  }, [loadHistory]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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
    const current = detectSpeechSupport();
    if (!current.ok || !current.ctor) {
      setStatus(current.reason || "Dictado no disponible.");
      return;
    }
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
      setStatus("Escuchando…");
    };
    recognition.onaudiostart = () => setStatus("Micrófono activo…");
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
        const next =
          (baseTextRef.current ? `${baseTextRef.current} ` : "") + finalChunk.trim();
        baseTextRef.current = next.trim();
        setText(baseTextRef.current);
        setInterim("");
        setStatus(null);
      } else {
        setInterim(interimChunk);
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setListening(false);
      setStatus(err instanceof Error ? err.message : "No se pudo iniciar el mic.");
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

  useEffect(() => {
    if (!autoStart) return;
    const t = window.setTimeout(() => startMic(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const sendMessage = useCallback(
    async (payload: string) => {
      const clean = payload.trim();
      if (!clean || sending) return;
      stopMic();
      setSending(true);
      setStatus(null);
      // Optimistic user bubble
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
      setInterim("");
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
    [sending, stopMic, loadHistory]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = (text + (interim ? ` ${interim}` : "")).trim();
    await sendMessage(payload);
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
          stopMic();
          onClose();
        }}
      />
      <div className="hablar-panel">
        <header className="hablar-head">
          <div className="hablar-head-text">
            <p className="hablar-kicker">Asistente</p>
            <h2>Hablar</h2>
          </div>
          <button
            type="button"
            className="hablar-close"
            aria-label="Cerrar chat"
            onClick={() => {
              stopMic();
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
                Ej.: «agrega 20 kg de harina» o «elimina todos los insumos».
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

        {!support.ok && (
          <p className="speak-unsupported hablar-banner" role="status">
            {support.reason}
          </p>
        )}
        {status && <p className="hablar-status">{status}</p>}
        {interim && (
          <p className="hablar-interim" aria-live="polite">
            <em>{interim}</em>
          </p>
        )}

        <form className="hablar-composer" onSubmit={onSubmit}>
          <button
            type="button"
            className={`hablar-mic ${listening ? "listening" : ""}`}
            aria-label={listening ? "Detener dictado" : "Dictar"}
            aria-pressed={listening}
            disabled={!support.ok}
            onClick={(e) => {
              e.preventDefault();
              if (listening) stopMic();
              else startMic();
            }}
          >
            <IconMic />
          </button>
          <textarea
            ref={inputRef}
            className="hablar-input"
            value={text}
            rows={1}
            placeholder="Escribí o dictá…"
            onChange={(e) => {
              setText(e.target.value);
              baseTextRef.current = e.target.value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage((text + (interim ? ` ${interim}` : "")).trim());
              }
            }}
          />
          <button
            type="submit"
            className="hablar-send"
            disabled={sending || !(text.trim() || interim.trim())}
            aria-label="Enviar"
          >
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  );
}
