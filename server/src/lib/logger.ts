// JSON-lines logger (Coralogix-compatible: structured stdout, request id).
// Zero deps by design.

export type Level = "debug" | "info" | "warn" | "error";

export interface LogFields {
  reqId?: string;
  userId?: string;
  orgId?: string;
  ms?: number;
  [k: string]: unknown;
}

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[(process.env.LOG_LEVEL as Level) || "info"] ?? 20;

function write(level: Level, msg: string, fields: LogFields = {}): void {
  if (LEVELS[level] < MIN) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  });
  if (level === "error" || level === "warn") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const log = {
  debug: (msg: string, f?: LogFields) => write("debug", msg, f),
  info: (msg: string, f?: LogFields) => write("info", msg, f),
  warn: (msg: string, f?: LogFields) => write("warn", msg, f),
  error: (msg: string, f?: LogFields) => write("error", msg, f),
};
