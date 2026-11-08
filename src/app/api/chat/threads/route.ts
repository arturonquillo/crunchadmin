import { NextRequest, NextResponse } from "next/server";
import {
  createChatThread,
  listChatThreads,
} from "@/lib/chat-threads";

export async function GET() {
  const threads = await listChatThreads();
  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title || "Sin título",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      messageCount: Math.max(0, t._count.messages - 1), // exclude SYSTEM
      preview: t.messages[0]?.content?.slice(0, 120) || null,
    })),
  });
}

export async function POST(req: NextRequest) {
  let title = "Nueva conversación";
  try {
    const body = await req.json();
    if (body?.title && typeof body.title === "string") {
      title = body.title.trim().slice(0, 72) || title;
    }
  } catch {
    /* empty body ok */
  }
  const thread = await createChatThread(title);
  return NextResponse.json({
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  });
}
