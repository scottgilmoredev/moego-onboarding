/**
 * Webhook Module Tests
 *
 * @module
 * @description Unit tests for the MoeGo webhook payload receiver and validator.
 * Covers valid payload parsing, event type validation, required field validation,
 * and malformed JSON handling.
 */

import { parseWebhookPayload, verifyWebhookSignature } from './webhook.js';

import type { MoeGoCustomerCreatedEvent } from '#/types/moego.js';

/**
 * Base webhook payload used across tests.
 * Override individual fields per test as needed.
 */
const basePayload = {
  id: 'evt_001',
  type: 'CUSTOMER_CREATED',
  timestamp: '2024-08-01T12:10:00Z',
  companyId: 'cmp_001',
  customer: {
    id: 'cus_001',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+12125551234',
  },
};

/**
 * parseWebhookPayload
 *
 * @description Tests for MoeGo webhook payload parsing and validation. Covers
 * valid payload parsing, event type validation, required field validation,
 * and malformed JSON handling.
 */
describe('parseWebhookPayload', () => {
  /**
   * @test
   * @description Confirms a valid CUSTOMER_CREATED payload is parsed correctly.
   */
  it('parses a valid CUSTOMER_CREATED payload', () => {
    const result = parseWebhookPayload(JSON.stringify(basePayload)) as MoeGoCustomerCreatedEvent;

    expect(result.type).toBe('CUSTOMER_CREATED');
    expect(result.customer.id).toBe('cus_001');
    expect(result.customer.firstName).toBe('John');
    expect(result.customer.lastName).toBe('Doe');
    expect(result.customer.phone).toBe('+12125551234');
  });

  /**
   * @test
   * @description Confirms malformed JSON throws a clear error.
   */
  it('throws on malformed JSON', () => {
    expect(() => parseWebhookPayload('not json')).toThrow();
  });

  /**
   * @test
   * @description Confirms a payload with wrong event type throws a clear error.
   */
  it('throws on incorrect event type', () => {
    const raw = JSON.stringify({ ...basePayload, type: 'APPOINTMENT_CREATED' });

    expect(() => parseWebhookPayload(raw)).toThrow();
  });

  /**
   * @test
   * @description Confirms a payload missing required customer fields throws a clear error.
   */
  it('throws on missing required customer fields', () => {
    const raw = JSON.stringify({
      ...basePayload,
      customer: { id: 'cus_001', firstName: 'John' },
    });

    expect(() => parseWebhookPayload(raw)).toThrow();
  });
});

/**
 * verifyWebhookSignature
 *
 * @description Tests for MoeGo webhook signature verification. Covers
 * valid signature acceptance and invalid signature rejection.
 */
describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    vi.stubGlobal('Utilities', {
      computeHmacSha256Signature: vi.fn().mockReturnValue([1, 2, 3]),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms a valid signature is accepted.
   */
  it('returns true for a valid signature', () => {
    const body = JSON.stringify({ id: 'evt_001', type: 'CUSTOMER_CREATED' });
    const clientId = 'test-client-id';
    const nonce = '123456789';
    const timestamp = '1751284717825';
    const secret = 'test-secret';

    // Compute expected signature using same logic as implementation
    const expectedBytes = [1, 2, 3];
    const expectedSig = btoa(String.fromCharCode(...expectedBytes));

    const result = verifyWebhookSignature({
      body,
      clientId,
      nonce,
      timestamp,
      signature: expectedSig,
      secret,
    });

    expect(result).toBe(true);
  });

  /**
   * @test
   * @description Confirms an invalid signature is rejected.
   */
  it('returns false for an invalid signature', () => {
    const result = verifyWebhookSignature({
      body: JSON.stringify({ id: 'evt_001' }),
      clientId: 'test-client-id',
      nonce: '123456789',
      timestamp: '1751284717825',
      signature: 'invalid-signature',
      secret: 'test-secret',
    });

    expect(result).toBe(false);
  });
});
