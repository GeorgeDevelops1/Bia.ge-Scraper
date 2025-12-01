export type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  if (meta !== undefined) {
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta);
  } else {
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta)
};


