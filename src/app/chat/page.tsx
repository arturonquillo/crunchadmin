"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChatModule } from "@/components/ChatModule";

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startNew = searchParams.get("new") === "1";
  const autoStart = searchParams.get("speak") === "1";
  const initialThreadId = searchParams.get("thread");
  // Remount when Hablar asks for a brand-new speak session.
  const instanceKey =
    searchParams.get("t") ||
    (startNew ? `new-${searchParams.toString()}` : initialThreadId || "latest");

  const onThreadChange = useCallback(
    (threadId: string) => {
      const params = new URLSearchParams();
      params.set("thread", threadId);
      if (autoStart) params.set("speak", "1");
      router.replace(`/chat?${params.toString()}`, { scroll: false });
    },
    [router, autoStart]
  );

  return (
    <ChatModule
      key={instanceKey}
      autoStart={autoStart}
      startNew={startNew}
      initialThreadId={initialThreadId}
      onThreadChange={onThreadChange}
    />
  );
}

function ChatFallback() {
  const t = useTranslations("Chat");
  return (
    <div className="hablar-root is-page">
      <div className="hablar-panel">
        <p className="hablar-empty">{t("loadingChat")}</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatPageInner />
    </Suspense>
  );
}
