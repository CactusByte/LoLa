/**
 * Simple logger utility for agent actions
 */

type LogLevel = "info" | "warn" | "error" | "debug";

class Logger {
  private enabled: boolean = true;
  private timestamps: boolean = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setTimestamps(enabled: boolean) {
    this.timestamps = enabled;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = this.timestamps ? `[${new Date().toISOString()}] ` : "";
    const levelTag = `[${level.toUpperCase()}]`;
    const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : "";
    return `${timestamp}${levelTag} ${message}${dataStr}`;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.enabled) return;
    const formatted = this.formatMessage(level, message, data);
    console.log(formatted);
  }

  info(message: string, data?: any) {
    this.log("info", message, data);
  }

  warn(message: string, data?: any) {
    this.log("warn", message, data);
  }

  error(message: string, data?: any) {
    this.log("error", message, data);
  }

  debug(message: string, data?: any) {
    this.log("debug", message, data);
  }

  // Convenience methods for agent-specific logging
  agent(message: string, data?: any) {
    this.info(`🤖 AGENT: ${message}`, data);
  }

  tool(message: string, data?: any) {
    this.info(`🔧 TOOL: ${message}`, data);
  }

  browser(message: string, data?: any) {
    this.info(`🌐 BROWSER: ${message}`, data);
  }

  step(message: string, data?: any) {
    this.info(`➡️  STEP: ${message}`, data);
  }
}

export const logger = new Logger();

