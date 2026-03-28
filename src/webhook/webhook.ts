/**
 * Webhook Module
 *
 * @module
 * @description Receives and validates incoming MoeGo webhook payloads.
 * Verifies event type is CUSTOMER_CREATED and that the payload contains
 * the expected customer data.
 */

import type { MoeGoEvent, MoeGoCustomerCreatedEvent, MoeGoEventType } from '#/types/moego.js';
import { REQUIRED_CUSTOMER_FIELDS, SUPPORTED_EVENT_TYPES } from '#/utils/constants.js';

/**
 * Parse and validate an incoming MoeGo webhook payload.
 *
 * @function parseWebhookPayload
 * @description Parses the raw JSON string from the webhook request body,
 * validates the event type is CUSTOMER_CREATED, and verifies all required
 * customer fields are present.
 *
 * @param {string} raw - Raw JSON string from the webhook request body.
 * @returns {MoeGoCustomerCreatedEvent} Parsed and validated webhook event.
 * @throws {Error} If the payload is malformed JSON.
 * @throws {Error} If the event type is not CUSTOMER_CREATED.
 * @throws {Error} If any required customer fields are missing.
 *
 * @example
 * const event = parseWebhookPayload(e.postData.contents);
 */
export function parseWebhookPayload(raw: string): MoeGoEvent | MoeGoCustomerCreatedEvent {
  let payload: unknown;

  // Attempt to parse the raw JSON — throw a clear error if malformed
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Invalid webhook payload: malformed JSON');
  }

  const event = payload as Record<string, unknown>;
  const customer = event.customer as Record<string, unknown>;

  if (!SUPPORTED_EVENT_TYPES.includes(event.type as MoeGoEventType)) {
    return event as unknown as MoeGoEvent;
  }

  for (const field of REQUIRED_CUSTOMER_FIELDS) {
    if (!customer?.[field]) {
      throw new Error(`Invalid webhook payload: missing required customer field "${field}"`);
    }
  }

  // Return the validated payload as a typed MoeGoCustomerCreatedEvent
  return event as unknown as MoeGoCustomerCreatedEvent;
}
