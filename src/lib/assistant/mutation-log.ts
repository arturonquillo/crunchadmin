import { appendFileSync, mkdirSync } from "fs";
import path from "path";

const LOG_PATH = path.join("/tmp", "crunchadmin-assistant-mutations.log");

export function logMutation(entry: {
  tool: string;
  ok: boolean;
  summary: string;
  detail?: Record<string, unknown>;
}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  try {
    mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, line + "\n");
  } catch {
    // best-effort
  }
  console.info("[assistant-mutation]", line);
}
