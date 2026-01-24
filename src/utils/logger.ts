import * as fs from 'fs';
import * as path from 'path';
import { Logger as ILogger, LogEntry } from './types';

/**
 * Structured logger with console and file output
 */
class Logger implements ILogger {
  private logLevel: 'error' | 'warn' | 'info' | 'debug';
  private logToFile: boolean;
  private logFilePath: string;

  private logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  constructor(
    logLevel: 'error' | 'warn' | 'info' | 'debug' = 'info',
    logToFile: boolean = false,
    logFilePath: string = './logs/trading.log'
  ) {
    this.logLevel = logLevel;
    this.logToFile = logToFile;
    this.logFilePath = logFilePath;

    // Ensure log directory exists
    if (this.logToFile) {
      const logDir = path.dirname(logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: 'error' | 'warn' | 'info' | 'debug'): boolean {
    return this.logLevels[level] <= this.logLevels[this.logLevel];
  }

  /**
   * Format log entry
   */
  private formatLogEntry(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    data?: Record<string, unknown>
  ): LogEntry & { formattedString: string } {
    const timestamp = Date.now();
    const logEntry: LogEntry = {
      timestamp,
      level,
      message,
      data,
    };

    // Format for console/file output
    const dateStr = new Date(timestamp).toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    let formattedString = `[${dateStr}] ${levelStr} ${message}`;

    if (data && Object.keys(data).length > 0) {
      formattedString += `\n  ${JSON.stringify(data, null, 2)}`;
    }

    return { ...logEntry, formattedString };
  }

  /**
   * Write to file
   */
  private writeToFile(formatted: string): void {
    if (!this.logToFile) return;

    try {
      fs.appendFileSync(this.logFilePath, formatted + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Info level log
   */
  info(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return;

    const { formattedString } = this.formatLogEntry('info', message, data);
    console.log(formattedString);
    this.writeToFile(formattedString);
  }

  /**
   * Warn level log
   */
  warn(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return;

    const { formattedString } = this.formatLogEntry('warn', message, data);
    console.warn(formattedString);
    this.writeToFile(formattedString);
  }

  /**
   * Error level log
   */
  error(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;

    const { formattedString } = this.formatLogEntry('error', message, data);
    console.error(formattedString);
    this.writeToFile(formattedString);
  }

  /**
   * Debug level log
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return;

    const { formattedString } = this.formatLogEntry('debug', message, data);
    console.log(formattedString);
    this.writeToFile(formattedString);
  }

  /**
   * Log trade entry decision
   */
  logTradeEntry(pair: string, decision: string, details: Record<string, unknown>): void {
    this.info(`Trade Entry: ${pair} - ${decision}`, {
      pair,
      decision,
      ...details,
    });
  }

  /**
   * Log trade exit
   */
  logTradeExit(pair: string, profitPct: number, reason: string): void {
    const status = profitPct >= 0 ? 'WIN' : 'LOSS';
    this.info(`Trade Exit: ${pair} - ${status} (${profitPct.toFixed(2)}%)`, {
      pair,
      profitPct,
      reason,
      status,
    });
  }

  /**
   * Log risk filter rejection
   */
  logFilterRejection(pair: string, filter: string, reason?: string): void {
    this.info(`Entry Blocked: ${pair} - ${filter}`, {
      pair,
      filter,
      reason,
    });
  }

  /**
   * Log AI decision
   */
  logAIDecision(
    pair: string,
    decision: string,
    confidence: number,
    reasoning: string[]
  ): void {
    this.info(`AI Decision: ${pair} - ${decision} (${confidence}% confidence)`, {
      pair,
      decision,
      confidence,
      reasoning,
    });
  }

  /**
   * Log API error
   */
  logAPIError(source: string, error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
    const details = typeof error === 'object' ? this.safeStringify(error) : undefined;

    this.error(`API Error: ${source}`, {
      source,
      error: errorMsg || String(error),
      details,
    });
  }

  /**
   * Log performance snapshot
   */
  logPerformance(stats: Record<string, unknown>): void {
    this.info('Performance Snapshot', stats);
  }

  /**
   * Safe stringify helper (avoids circular errors)
   */
  private safeStringify(data: unknown): string {
    try {
      return JSON.stringify(data, Object.getOwnPropertyNames(data as object), 2);
    } catch (err) {
      try {
        return JSON.stringify({ error: String(err), fallback: String(data) });
      } catch {
        return '[unserializable error]';
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger(
  (process.env.KRAKEN_BOT_LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  process.env.KRAKEN_BOT_LOG_TO_FILE === 'true',
  process.env.KRAKEN_BOT_LOG_FILE_PATH || './logs/trading.log'
);

export default logger;
