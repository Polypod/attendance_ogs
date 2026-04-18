type LogLevel = "debug" | "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLogLevel(): LogLevel {
  const fromEnv = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (fromEnv === "debug" || fromEnv === "info" || fromEnv === "warn" || fromEnv === "error") {
    return fromEnv;
  }

  if (process.env.NODE_ENV === "test") {
    return "warn";
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function isEnabled(level: LogLevel, current: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[current];
}

function serializeError(err: unknown): LogMeta {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  return { error: err };
}

function basePayload(level: LogLevel, message: string, meta?: LogMeta): LogMeta {
  return {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta ? { meta } : {}),
  };
}

export const logger = {
  get level(): LogLevel {
    return resolveLogLevel();
  },

  isDebugEnabled(): boolean {
    return isEnabled("debug", resolveLogLevel());
  },

  debug(message: string, meta?: LogMeta): void {
    const current = resolveLogLevel();
    if (!isEnabled("debug", current)) return;
    console.log(JSON.stringify(basePayload("debug", message, meta)));
  },

  info(message: string, meta?: LogMeta): void {
    const current = resolveLogLevel();
    if (!isEnabled("info", current)) return;
    console.log(JSON.stringify(basePayload("info", message, meta)));
  },

  warn(message: string, meta?: LogMeta): void {
    const current = resolveLogLevel();
    if (!isEnabled("warn", current)) return;
    console.warn(JSON.stringify(basePayload("warn", message, meta)));
  },

  error(message: string, meta?: LogMeta, err?: unknown): void {
    const current = resolveLogLevel();
    if (!isEnabled("error", current)) return;
    const mergedMeta: LogMeta = {
      ...(meta ?? {}),
      ...(err !== undefined ? { err: serializeError(err) } : {}),
    };
    console.error(JSON.stringify(basePayload("error", message, mergedMeta)));
  },
};
