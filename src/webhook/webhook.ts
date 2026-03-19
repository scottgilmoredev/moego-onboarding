/**
 * Webhook Module
 *
 * @module
 * @description Receives and validates incoming MoeGo webhook payloads.
 * Verifies event type is CUSTOMER_CREATED and that the payload contains
 * the expected customer data.
 */

import type { MoeGoCustomerCreatedEvent } from '#/types/moego.js';
import { SUPPORTED_EVENT_TYPE, REQUIRED_CUSTOMER_FIELDS } from '#/utils/constants.js';

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
export function parseWebhookPayload(raw: string): MoeGoCustomerCreatedEvent {
  let payload: unknown;

  // Attempt to parse the raw JSON — throw a clear error if malformed
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('Invalid webhook payload: malformed JSON');
  }

  const event = payload as Record<string, unknown>;

  // Verify the event type is CUSTOMER_CREATED — reject all other event types
  if (event.type !== SUPPORTED_EVENT_TYPE) {
    throw new Error(
      `Invalid webhook event type: expected ${SUPPORTED_EVENT_TYPE}, received ${String(event.type)}`
    );
  }

  const customer = event.customer as Record<string, unknown>;

  for (const field of REQUIRED_CUSTOMER_FIELDS) {
    if (!customer?.[field]) {
      throw new Error(`Invalid webhook payload: missing required customer field "${field}"`);
    }
  }

  // Return the validated payload as a typed MoeGoCustomerCreatedEvent
  return event as unknown as MoeGoCustomerCreatedEvent;
}
