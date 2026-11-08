import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

export type PendingAction = {
  id: string;
  code: string;
  kind: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000;
const STORE_PATH = path.join("/tmp", "crunchadmin-pending-actions.json");

type StoreFile = { actions: PendingAction[] };

function load(): PendingAction[] {
  try {
    if (!existsSync(STORE_PATH)) return [];
    const raw = JSON.parse(readFileSync(STORE_PATH, "utf8")) as StoreFile;
    const now = Date.now();
    return (raw.actions || []).filter((a) => a.expiresAt > now);
  } catch {
    return [];
  }
}

function save(actions: PendingAction[]) {
  mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify({ actions }, null, 2));
}

function shortCode(): string {
  return randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
}

export function createPendingAction(input: {
  kind: string;
  summary: string;
  payload: Record<string, unknown>;
}): PendingAction {
  const actions = load();
  const now = Date.now();
  const action: PendingAction = {
    id: randomBytes(8).toString("hex"),
    code: shortCode(),
    kind: input.kind,
    summary: input.summary,
    payload: input.payload,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  actions.push(action);
  save(actions);
  return action;
}

export function takePendingByCode(code: string): PendingAction | null {
  const normalized = code.trim().toUpperCase();
  const actions = load();
  const idx = actions.findIndex((a) => a.code === normalized && a.expiresAt > Date.now());
  if (idx < 0) return null;
  const [action] = actions.splice(idx, 1);
  save(actions);
  return action;
}

export function peekPendingByCode(code: string): PendingAction | null {
  const normalized = code.trim().toUpperCase();
  return (
    load().find((a) => a.code === normalized && a.expiresAt > Date.now()) || null
  );
}

export function getConfirmSecret(): string | null {
  const s = process.env.ASSISTANT_CONFIRM_SECRET?.trim();
  return s || null;
}

export function matchesConfirmSecret(text: string): boolean {
  const secret = getConfirmSecret();
  if (!secret) return false;
  return text.trim() === secret || text.trim() === `CONFIRMAR ${secret}`;
}
