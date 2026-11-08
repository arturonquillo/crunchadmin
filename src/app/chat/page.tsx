"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  kind: string;
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  attachments?: Attachment[];
};

export default function ChatPage() {
  const t = useTranslations("Chat");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [sending, setSending] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/chat");
    const data = await res.json();
    setMessages(data.messages || []);
    setOpenaiConfigured(Boolean(data.openaiConfigured));
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() && (!files || files.length === 0)) return;
    setSending(true);
    try {
      const form = new FormData();
      form.set("message", text);
      if (files) {
        Array.from(files).forEach((f) => form.append("files", f));
      }
      const res = await fetch("/api/chat", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || tc("error"));
        return;
      }
      setText("");
      setFiles(null);
      const fileInput = document.getElementById(
        "chat-files"
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <h1 className="section-title">{t("title")}</h1>
      <p className="section-sub">
        {openaiConfigured ? t("subtitleConnected") : t("subtitleStub")}
      </p>

      <section className="panel chat-layout">
        <div className="chat-log" ref={logRef}>
          {messages.length === 0 && (
            <p className="empty">{t("empty")}</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={m.role === "USER" ? "bubble user" : "bubble assistant"}
            >
              <span className="meta">
                {m.role === "USER" ? t("you") : t("assistant")} ·{" "}
                {new Date(m.createdAt).toLocaleTimeString(locale)}
              </span>
              {/* Chat message content is user/assistant data — not system chrome */}
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              {m.attachments && m.attachments.length > 0 && (
                <div className="chat-attach">
                  {m.attachments.map((a) => (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                      {a.kind === "image"
                        ? t("imagePrefix", { filename: a.filename })
                        : a.filename}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <form className="chat-composer" onSubmit={onSend}>
          <div className="field">
            <label htmlFor="msg">{t("message")}</label>
            <textarea
              id="msg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("placeholder")}
            />
          </div>
          <div className="field">
            <label htmlFor="chat-files">{t("attachments")}</label>
            <input
              id="chat-files"
              type="file"
              multiple
              accept="image/*,audio/*,.pdf,.txt,.csv"
              onChange={(e) => setFiles(e.target.files)}
            />
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={sending}>
              {sending ? t("sending") : t("send")}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
