/**
 * 简单的日志工具
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private level: LogLevel;
  private context: string;

  constructor(context: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = level;
  }

  private formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.context}] ${message}${metaStr}`;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR) {
      const meta = error instanceof Error ? { error: error.message, stack: error.stack } : error;
      console.error(this.formatMessage('ERROR', message, meta));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export function createLogger(context: string, level?: LogLevel): Logger {
  return new Logger(context, level);
}
