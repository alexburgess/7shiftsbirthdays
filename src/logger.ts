export type LogLevel = "info" | "warn" | "error";

export type LogMeta = Record<string, unknown>;

function write(level: LogLevel, message: string, meta: LogMeta = {}): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  const serialized = JSON.stringify(payload);

  if (level === "error") {
    process.stderr.write(`${serialized}\n`);
    return;
  }

  process.stdout.write(`${serialized}\n`);
}

export const logger = {
  info: (message: string, meta?: LogMeta) => write("info", message, meta),
  warn: (message: string, meta?: LogMeta) => write("warn", message, meta),
  error: (message: string, meta?: LogMeta) => write("error", message, meta)
};
