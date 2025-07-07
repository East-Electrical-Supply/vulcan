export interface LogContext {
  requestId?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext, error?: Error): string {
    const timestamp = new Date().toISOString();
    const logEntry: any = {
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'vulcan'
    };

    if (context) {
      logEntry.context = context;
    }

    if (error) {
      logEntry.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }

    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    console.log(this.formatMessage('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    console.warn(this.formatMessage('warn', message, context, error));
  }

  error(message: string, context?: LogContext, error?: Error): void {
    console.error(this.formatMessage('error', message, context, error));
  }

  createRequestLogger(requestId: string) {
    return {
      debug: (message: string, context?: LogContext) => 
        this.debug(message, { requestId, ...context }),
      info: (message: string, context?: LogContext) => 
        this.info(message, { requestId, ...context }),
      warn: (message: string, context?: LogContext, error?: Error) => 
        this.warn(message, { requestId, ...context }, error),
      error: (message: string, context?: LogContext, error?: Error) => 
        this.error(message, { requestId, ...context }, error)
    };
  }
}

export const logger = new Logger();
export default logger;