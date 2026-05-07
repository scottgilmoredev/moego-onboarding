/* eslint-disable no-console */

/**
 * Logger Module
 *
 * @module
 * @description Centralized structured logging service. Emits JSON-formatted
 * log entries to the appropriate console method for each severity level,
 * mapping directly to GCP Cloud Logging severity: console.info → INFO,
 * console.warn → WARNING, console.error → ERROR.
 */

/**
 * A structured log entry.
 *
 * @interface LogEntry
 * @property {string} module - The module or function emitting the log.
 * @property {string} message - The log message.
 * @property {Record<string, unknown>} [context] - Optional additional fields spread at top level.
 */
interface LogEntry {
  module: string;
  message: string;
  [key: string]: unknown;
}

/**
 * Builds and serializes a structured log entry.
 *
 * @param {string} module - The module or function emitting the log.
 * @param {string} message - The log message.
 * @param {Record<string, unknown>} [context] - Optional context fields to include.
 * @returns {string} JSON-serialized log entry.
 */
function buildEntry(module: string, message: string, context?: Record<string, unknown>): string {
  // module and message take precedence over any colliding context keys
  const entry: LogEntry = { ...context, module, message };
  return JSON.stringify(entry);
}

/**
 * Centralized logging service.
 *
 * @namespace logger
 * @description Provides info, warn, and error severity methods that emit
 * structured JSON entries. Use IDs only in context — no names or sensitive data.
 *
 * @example
 * logger.info('doPost', 'webhook received', { companyId, appointmentId });
 * logger.warn('doPost', 'returning client skipped', { customerId });
 * logger.error('doPost', 'shortenUrlStrict failed', { customerId, error: String(err) });
 */
export const logger = {
  /**
   * Emits an INFO-severity log entry to GCP Cloud Logging.
   *
   * @param {string} module - The module or function emitting the log.
   * @param {string} message - The log message.
   * @param {Record<string, unknown>} [context] - Optional context fields.
   */
  info(module: string, message: string, context?: Record<string, unknown>): void {
    console.info(buildEntry(module, message, context));
  },

  /**
   * Emits a WARNING-severity log entry to GCP Cloud Logging.
   *
   * @param {string} module - The module or function emitting the log.
   * @param {string} message - The log message.
   * @param {Record<string, unknown>} [context] - Optional context fields.
   */
  warn(module: string, message: string, context?: Record<string, unknown>): void {
    console.warn(buildEntry(module, message, context));
  },

  /**
   * Emits an ERROR-severity log entry to GCP Cloud Logging.
   *
   * @param {string} module - The module or function emitting the log.
   * @param {string} message - The log message.
   * @param {Record<string, unknown>} [context] - Optional context fields.
   */
  error(module: string, message: string, context?: Record<string, unknown>): void {
    console.error(buildEntry(module, message, context));
  },
};
