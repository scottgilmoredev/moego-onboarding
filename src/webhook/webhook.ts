/**
 * Webhook Module
 *
 * @module
 * @description Receives and validates incoming MoeGo webhook payloads.
 * Parses and returns supported event types with full customer field validation.
 * Unsupported event types are returned as-is without further validation.
 */

import type { MoeGoEvent, MoeGoAppointmentCreatedEvent, MoeGoEventType } from '#/types/moego.js';
import { REQUIRED_CUSTOMER_FIELDS, SUPPORTED_EVENT_TYPES } from '#/utils/constants.js';

/**
 * Parse and validate an incoming MoeGo webhook payload.
 *
 * @function parseWebhookPayload
 * @description Parses the raw JSON string from the webhook request body,
 * validates the event type is APPOINTMENT_CREATED, and verifies all required
 * customer fields are present.
 *
 * @param {string} raw - Raw JSON string from the webhook request body.
 * @returns {MoeGoAppointmentCreatedEvent} Parsed and validated webhook event.
 * @throws {Error} If the payload is malformed JSON.
 * @throws {Error} If the event type is not APPOINTMENT_CREATED.
 *
 * @example
 * const event = parseWebhookPayload(e.postData.contents);
 */
export function parseWebhookPayload(raw: string): MoeGoEvent | MoeGoAppointmentCreatedEvent {
  let payload: unknown;

  // Attempt to parse the raw JSON — throw a clear error if malformed
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Invalid webhook payload: malformed JSON');
  }

  const event = payload as Record<string, unknown>;
  const customer = event.customer as Record<string, unknown>;

  // Return early for unsupported event types — no further validation needed
  if (!SUPPORTED_EVENT_TYPES.includes(event.type as MoeGoEventType)) {
    return event as unknown as MoeGoEvent;
  }

  // Verify all required customer fields are present
  for (const field of REQUIRED_CUSTOMER_FIELDS) {
    if (!customer?.[field]) {
      throw new Error(`Invalid webhook payload: missing required customer field "${field}"`);
    }
  }

  // Return the validated payload as a typed MoeGoAppointmentCreatedEvent
  return event as unknown as MoeGoAppointmentCreatedEvent;
}
