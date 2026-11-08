import { prisma } from "@/lib/prisma";
import { SYSTEM_PROMPT } from "@/lib/assistant/tools";

export async function listChatThreads() {
  return prisma.chatThread.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
      messages: {
        where: { role: { not: "SYSTEM" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
    },
  });
}

export async function createChatThread(title = "Nueva conversación") {
  return prisma.chatThread.create({
    data: {
      title,
      messages: {
        create: {
          role: "SYSTEM",
          content: SYSTEM_PROMPT,
        },
      },
    },
  });
}

export async function getThreadById(threadId: string) {
  return prisma.chatThread.findUnique({ where: { id: threadId } });
}

/** Latest thread, or create one if the DB has none. */
export async function getOrCreateLatestThread() {
  const existing = await prisma.chatThread.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return createChatThread("Operación diaria");
}

export async function resolveThread(threadId?: string | null) {
  if (threadId) {
    const found = await getThreadById(threadId);
    if (found) return found;
  }
  return getOrCreateLatestThread();
}

export async function touchThread(threadId: string, titleHint?: string) {
  const data: { updatedAt: Date; title?: string } = { updatedAt: new Date() };
  if (titleHint) {
    const thread = await getThreadById(threadId);
    if (thread && (!thread.title || thread.title === "Nueva conversación")) {
      data.title = titleHint.slice(0, 72);
    }
  }
  return prisma.chatThread.update({ where: { id: threadId }, data });
}
