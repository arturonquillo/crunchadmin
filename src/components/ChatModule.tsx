"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
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
import { VoiceMeter, formatElapsed } from "@/components/VoiceMeter";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import {
  startLiveTranscription,
  type LiveSession,
} from "@/lib/realtime-transcribe";

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

function IconHistory() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 8v4.5L15 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconClip() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.4 11.6 12.1 20.9a6 6 0 0 1-8.5-8.5l9.3-9.3a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.2-8.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
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

type ThreadSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string | null;
};

type Props = {
  /** Start mic when OpenAI + recorder are ready (Hablar entry). */
  autoStart?: boolean;
  /** Create a blank conversation on mount (Hablar entry). */
  startNew?: boolean;
  /** Open a specific thread; ignored when startNew. */
  initialThreadId?: string | null;
  /** Called when the active thread changes so the URL can stay in sync. */
  onThreadChange?: (threadId: string) => void;
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

export function ChatModule({
  autoStart = false,
  startNew = false,
  initialThreadId = null,
  onThreadChange,
}: Props) {
  const t = useTranslations("Chat");
  const [threadId, setThreadId] = useState<string | null>(
    startNew ? null : initialThreadId
  );
  const [threadTitle, setThreadTitle] = useState("Chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [openaiOk, setOpenaiOk] = useState<boolean | null>(null);
  const [recorderSupport] = useState(() => detectRecorderSupport());
  const [booting, setBooting] = useState(true);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveMode, setLiveMode] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const baseTextRef = useRef("");
  const preRecordTextRef = useRef("");
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onThreadChangeRef = useRef(onThreadChange);
  onThreadChangeRef.current = onThreadChange;

  const micReady = Boolean(openaiOk && recorderSupport.ok);
  const micBusy = recording || transcribing;

  const hydrateMessage = useCallback((m: ChatMessage): ChatMessage => {
    const widgets =
      m.widgets && m.widgets.length > 0
        ? m.widgets
        : widgetsFromActionsJson(m.actionsJson, m.id);
    return { ...m, widgets };
  }, []);

  const applyThreadPayload = useCallback(
    (data: {
      threadId?: string;
      title?: string | null;
      pending?: { code: string }[];
      messages?: ChatMessage[];
    }) => {
      if (data.threadId) {
        setThreadId(data.threadId);
        onThreadChangeRef.current?.(data.threadId);
      }
      if (data.title) setThreadTitle(data.title);
      const pending = new Set<string>(
        (data.pending || []).map((p) => String(p.code).toUpperCase())
      );
      setPendingCodes(pending);
      setMessages((data.messages || []).map((m) => hydrateMessage(m)));
    },
    [hydrateMessage]
  );

  const loadThread = useCallback(
    async (id?: string | null) => {
      const qs = id ? `?threadId=${encodeURIComponent(id)}` : "";
      const res = await fetch(`/api/chat${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el chat");
      applyThreadPayload(data);
      return data.threadId as string;
    },
    [applyThreadPayload]
  );

  const createThread = useCallback(async () => {
    const res = await fetch("/api/chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nueva conversación" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se pudo crear conversación");
    setThreadId(data.id);
    setThreadTitle(data.title || "Nueva conversación");
    setMessages([]);
    setPendingCodes(new Set());
    onThreadChangeRef.current?.(data.id);
    return data.id as string;
  }, []);

  const loadThreadList = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const res = await fetch("/api/chat/threads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo listar chats");
      setThreads(data.threads || []);
    } catch (err) {
      setStatus(String(err));
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessionP = fetch("/api/transcribe/session")
          .then((r) => r.json())
          .then((d) => setOpenaiOk(Boolean(d.configured)))
          .catch(() => setOpenaiOk(false));

        if (startNew) {
          await createThread();
        } else {
          await loadThread(initialThreadId);
        }
        await sessionP;
      } catch (err) {
        if (!cancelled) setStatus(String(err));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only boot for this ChatModule instance (keyed by page).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!historyOpen) return;
    void loadThreadList();
  }, [historyOpen, loadThreadList]);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending, transcribing]);

  const resizeComposer = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const styles = window.getComputedStyle(el);
    const lineHeight = parseFloat(styles.lineHeight) || 22;
    const padY =
      parseFloat(styles.paddingTop || "0") + parseFloat(styles.paddingBottom || "0");
    const maxH = lineHeight * 8 + padY;
    const next = Math.min(el.scrollHeight, maxH);
    el.style.height = `${Math.max(next, lineHeight + padY)}px`;
    el.style.overflowY = el.scrollHeight > maxH + 1 ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [text, recording, transcribing, resizeComposer]);

  const releaseStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    setLiveStream(null);
  }, []);

  useEffect(() => {
    if (!recording) return;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 200);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (!recording && !transcribing) setElapsedMs(0);
  }, [recording, transcribing]);

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

  const applyLiveText = useCallback((spoken: string) => {
    const base = preRecordTextRef.current.trim();
    const next = [base, spoken.trim()].filter(Boolean).join(" ").trim();
    baseTextRef.current = next;
    setText(next);
  }, []);

  const startWhisperFallback = useCallback(async () => {
    setLiveMode(false);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });
    mediaStreamRef.current = stream;
    setLiveStream(stream);
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
        setStatus("Grabación muy corta. Hablá un segundo más y usá Stop.");
        return;
      }
      void transcribeBlob(blob, type);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    setStatus("Grabando (Whisper al final)…");
  }, [recorderSupport, releaseStream, transcribeBlob]);

  const stopRecording = useCallback(() => {
    const live = liveSessionRef.current;
    if (live) {
      liveSessionRef.current = null;
      setRecording(false);
      setTranscribing(true);
      setStatus("Cerrando turno en vivo…");
      void live
        .stop()
        .then((finalText) => {
          if (finalText) applyLiveText(finalText);
          setStatus(finalText ? "Texto listo — podés editar o Enviar." : null);
        })
        .catch((err) => setStatus(String(err)))
        .finally(() => {
          setTranscribing(false);
          setLiveStream(null);
          setLiveMode(false);
        });
      return;
    }

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
  }, [releaseStream, applyLiveText]);

  const startRecording = useCallback(async () => {
    setStatus(null);
    if (openaiOk === null) {
      setStatus("Preparando micrófono…");
      return;
    }
    if (openaiOk === false) {
      setStatus(
        "Transcripción por IA no disponible (falta OPENAI_API_KEY). Escribí el mensaje."
      );
      return;
    }
    if (!recorderSupport.ok) {
      setStatus(recorderSupport.reason || "Grabación no disponible.");
      return;
    }

    preRecordTextRef.current = text;
    try {
      setStatus("Conectando transcripción en vivo…");
      const session = await startLiveTranscription({
        onPartial: (spoken) => applyLiveText(spoken),
        onFinal: (spoken) => applyLiveText(spoken),
        onStatus: (msg) => setStatus(msg),
        onError: (msg) => setStatus(msg),
      });
      liveSessionRef.current = session;
      mediaStreamRef.current = session.stream;
      setLiveStream(session.stream);
      setLiveMode(true);
      setRecording(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus(
          "Permiso de micrófono denegado. Activá el mic en Ajustes → Safari y reintentá."
        );
        setRecording(false);
        return;
      }
      setStatus(
        `Realtime no disponible (${err instanceof Error ? err.message : "error"}). Usando Whisper…`
      );
      try {
        await startWhisperFallback();
      } catch (fallbackErr) {
        setStatus(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : "No se pudo abrir el micrófono."
        );
        setRecording(false);
      }
    }
  }, [
    openaiOk,
    recorderSupport,
    text,
    applyLiveText,
    startWhisperFallback,
  ]);

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
      const live = liveSessionRef.current;
      liveSessionRef.current = null;
      if (live) void live.stop().catch(() => undefined);
      releaseStream();
    };
  }, [releaseStream]);

  // Only auto-start after boot + OpenAI ready — avoids false "falta API key"
  useEffect(() => {
    if (!autoStart || booting) return;
    if (openaiOk !== true) return;
    if (!recorderSupport.ok) return;
    const t = window.setTimeout(() => {
      void startRecording();
    }, 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, booting, openaiOk, recorderSupport.ok]);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list || list.length === 0) return;
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const f of Array.from(list)) {
        if (next.some((p) => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified)) {
          continue;
        }
        next.push(f);
      }
      return next.slice(0, 8);
    });
  }, []);

  const sendMessage = useCallback(
    async (payload: string, files?: File[]) => {
      const attach = files ?? pendingFiles;
      const clean = payload.trim();
      if ((!clean && attach.length === 0) || sending) return;
      if (recording) stopRecording();
      setSending(true);
      setStatus(null);
      const tempId = `local-${Date.now()}`;
      const preview =
        clean ||
        `Adjunto: ${attach.map((f) => f.name).join(", ")}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          role: "USER",
          content: preview,
          createdAt: new Date().toISOString(),
          attachments: attach.map((f, i) => ({
            id: `${tempId}-f-${i}`,
            filename: f.name,
            mimeType: f.type || "application/octet-stream",
            url: "",
            kind: f.type.startsWith("image/") ? "image" : "file",
          })),
        },
      ]);
      setText("");
      baseTextRef.current = "";
      const sendingFiles = attach;
      setPendingFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      try {
        let activeId = threadId;
        if (!activeId) {
          activeId = await createThread();
        }
        let res: Response;
        if (sendingFiles.length > 0) {
          const form = new FormData();
          form.set("message", clean);
          form.set("source", "chat");
          form.set("threadId", activeId);
          sendingFiles.forEach((f) => form.append("files", f));
          res = await fetch("/api/chat", { method: "POST", body: form });
        } else {
          res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: clean,
              source: "chat",
              threadId: activeId,
            }),
          });
        }
        const data = await res.json();
        if (!res.ok) {
          setStatus(data.error || "Error al enviar");
          await loadThread(activeId);
          return;
        }
        await loadThread(activeId);
      } catch (err) {
        setStatus(String(err));
        if (threadId) await loadThread(threadId);
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [
      sending,
      recording,
      stopRecording,
      loadThread,
      pendingFiles,
      threadId,
      createThread,
    ]
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
        body: JSON.stringify({
          action: "cancel_pending",
          code,
          threadId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error || "No se pudo cancelar");
      }
      await loadThread(threadId);
    } catch (err) {
      setStatus(String(err));
    } finally {
      setSending(false);
    }
  }

  async function openHistory() {
    setHistoryOpen(true);
  }

  async function selectThread(id: string) {
    setHistoryOpen(false);
    setBooting(true);
    setStatus(null);
    try {
      await loadThread(id);
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBooting(false);
      inputRef.current?.focus();
    }
  }

  async function startFreshFromHistory() {
    setHistoryOpen(false);
    setBooting(true);
    setStatus(null);
    try {
      await createThread();
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBooting(false);
      inputRef.current?.focus();
    }
  }

  const micHint =
    openaiOk === false
      ? "Sin OPENAI_API_KEY no hay dictado por IA. Escribí el mensaje."
      : !recorderSupport.ok
        ? recorderSupport.reason || null
        : null;

  return (
    <div className="hablar-root is-page" aria-label="Chat Crunchadmin">
      <div className="hablar-panel">
        <header className="hablar-head">
          <div className="hablar-head-text">
            <p className="hablar-kicker">Asistente</p>
            <h2>Chat</h2>
            <p className="hablar-thread-title">{threadTitle}</p>
          </div>
          <button
            type="button"
            className="hablar-history-btn"
            aria-label={t("historial")}
            aria-expanded={historyOpen}
            onClick={() => void openHistory()}
          >
            <IconHistory />
            <span>{t("historial")}</span>
          </button>
        </header>

        {historyOpen && (
          <div className="chat-history-panel" role="dialog" aria-label={t("historialTitle")}>
            <div className="chat-history-head">
              <h3>Conversaciones</h3>
              <div className="chat-history-head-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => void startFreshFromHistory()}
                >
                  Nueva
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setHistoryOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
            <div className="chat-history-list">
              {threadsLoading && (
                <p className="hablar-empty">Cargando conversaciones…</p>
              )}
              {!threadsLoading && threads.length === 0 && (
                <p className="hablar-empty">Todavía no hay conversaciones.</p>
              )}
              {!threadsLoading &&
                threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chat-history-item ${t.id === threadId ? "active" : ""}`}
                    onClick={() => void selectThread(t.id)}
                  >
                    <span className="chat-history-item-title">{t.title}</span>
                    <span className="chat-history-item-meta">
                      {new Date(t.updatedAt).toLocaleString("es", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {t.messageCount > 0 ? ` · ${t.messageCount} msgs` : ""}
                    </span>
                    {t.preview && (
                      <span className="chat-history-item-preview">{t.preview}</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}

        <div className="hablar-log" ref={logRef}>
          {booting && <p className="hablar-empty">Cargando chat…</p>}
          {!booting && messages.length === 0 && (
            <div className="hablar-empty">
              <p>Conversá con el sistema.</p>
              <p className="muted">
                Tocá el mic y hablá, o adjuntá foto / PDF / Excel de una compra.
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
                <div className="hablar-bubble-body">
                  <ChatMarkdown>{m.content}</ChatMarkdown>
                </div>
                {m.attachments && m.attachments.length > 0 && (
                  <div className="chat-attach">
                    {m.attachments.map((a) =>
                      a.url ? (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                          {a.kind === "image" ? `🖼 ${a.filename}` : a.filename}
                        </a>
                      ) : (
                        <span key={a.id}>{a.filename}</span>
                      )
                    )}
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
        {status && !recording && !transcribing && (
          <p className="hablar-status">{status}</p>
        )}

        {pendingFiles.length > 0 && (
          <ul className="hablar-pending-files" aria-label="Archivos a enviar">
            {pendingFiles.map((f, i) => (
              <li key={`${f.name}-${f.size}-${i}`}>
                <span>
                  {f.type.startsWith("image/") ? "🖼 " : ""}
                  {f.name}
                </span>
                <button
                  type="button"
                  className="hablar-file-remove"
                  aria-label={`Quitar ${f.name}`}
                  onClick={() =>
                    setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={fileRef}
          type="file"
          multiple
          className="hablar-file-input"
          accept="image/*,.pdf,.txt,.csv,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <form className="hablar-composer" onSubmit={onSubmit}>
          <button
            type="button"
            className={`hablar-mic ${recording ? "listening is-stop" : ""} ${transcribing ? "transcribing" : ""}`}
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
            {recording ? <IconStop /> : <IconMic />}
            {recording && (
              <span className="hablar-mic-timer" aria-hidden>
                {formatElapsed(elapsedMs)}
              </span>
            )}
          </button>
          <button
            type="button"
            className="hablar-attach"
            aria-label="Adjuntar foto, PDF o Excel"
            disabled={sending || micBusy}
            onClick={() => fileRef.current?.click()}
          >
            <IconClip />
            {pendingFiles.length > 0 && (
              <span className="hablar-attach-count">{pendingFiles.length}</span>
            )}
          </button>
          <div
            className={`hablar-input-wrap ${recording ? "is-recording" : ""} ${transcribing ? "is-transcribing" : ""} ${liveMode && recording ? "is-live" : ""}`}
          >
            <textarea
              ref={inputRef}
              className="hablar-input"
              value={text}
              rows={1}
              placeholder={
                recording
                  ? "Hablá… el texto aparece acá"
                  : transcribing
                    ? "Cerrando transcripción…"
                    : pendingFiles.length
                      ? "Mensaje opcional… o Enviar el adjunto"
                      : "Escribí, adjuntá o tocá el mic…"
              }
              onChange={(e) => {
                setText(e.target.value);
                baseTextRef.current = e.target.value;
              }}
              onInput={resizeComposer}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(text);
                }
              }}
            />
            {recording && (
              <div className="hablar-input-meter" aria-hidden>
                <VoiceMeter stream={liveStream} active={recording} bars={22} />
              </div>
            )}
          </div>
          <button
            type="submit"
            className="hablar-send"
            disabled={sending || micBusy || (!text.trim() && pendingFiles.length === 0)}
            aria-label="Enviar"
          >
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  );
}
