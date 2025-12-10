/**
 * Logger - Centralized logging
 */

export class Logger {
  constructor(context) {
    this.context = context;
    this.enabled = true;
  }

  info(...args) {
    if (this.enabled) {
      console.log(`[${this.context}]`, ...args);
    }
  }

  warn(...args) {
    if (this.enabled) {
      console.warn(`[${this.context}]`, ...args);
    }
  }

  error(...args) {
    console.error(`[${this.context}]`, ...args);
  }

  debug(...args) {
    if (this.enabled) {
      console.debug(`[${this.context}]`, ...args);
    }
  }
}
