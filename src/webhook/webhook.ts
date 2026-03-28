/**
 * Webhook Module
 *
 * @module
 * @description Receives and validates incoming MoeGo webhook payloads.
 * Verifies event type is CUSTOMER_CREATED and that the payload contains
 * the expected customer data.
 */

/**
 * Parameters for verifying a MoeGo webhook signature.
 *
 * @interface VerifyWebhookSignatureParams
 * @property {string} body - The raw request body string.
 * @property {string} clientId - The X-Moe-Client-Id header value.
 * @property {string} nonce - The X-Moe-Nonce header value.
 * @property {string} timestamp - The X-Moe-Timestamp header value.
 * @property {string} signature - The X-Moe-Signature-256 header value.
 * @property {string} secret - The webhook secret token.
 */
export interface VerifyWebhookSignatureParams {
  body: string;
  clientId: string;
  nonce: string;
  timestamp: string;
  signature: string;
  secret: string;
}
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

/**
 * Verify the HMAC-SHA256 signature of an incoming MoeGo webhook request.
 *
 * @function verifyWebhookSignature
 * @description Verifies the X-Moe-Signature-256 header by recomputing the
 * HMAC-SHA256 signature from the request components and comparing it against
 * the provided signature. Returns true if the signatures match.
 *
 * @param {VerifyWebhookSignatureParams} params - The verification parameters.
 * @returns {boolean} Whether the signature is valid.
 *
 * @example
 * const isValid = verifyWebhookSignature({
 *   body: e.postData.contents,
 *   clientId: e.parameter['X-Moe-Client-Id'],
 *   nonce: e.parameter['X-Moe-Nonce'],
 *   timestamp: e.parameter['X-Moe-Timestamp'],
 *   signature: e.parameter['X-Moe-Signature-256'],
 *   secret: config.moegoWebhookSecret,
 * });
 */
export function verifyWebhookSignature({
  body,
  clientId,
  nonce,
  timestamp,
  signature,
  secret,
}: VerifyWebhookSignatureParams): boolean {
  // Concatenate components per MoeGo signature generation spec
  const raw = clientId + nonce + timestamp + body;

  // Compute HMAC-SHA256 signature using Apps Script Utilities
  const signatureBytes = Utilities.computeHmacSha256Signature(raw, secret);

  // Base64-encode the computed signature for comparison
  const computedSignature = btoa(String.fromCharCode(...signatureBytes));

  // Compare computed signature against provided signature
  return computedSignature === signature;
}
