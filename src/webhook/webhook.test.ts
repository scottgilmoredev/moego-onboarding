/**
 * Webhook Module Tests
 *
 * @module
 * @description Unit tests for the MoeGo webhook payload receiver and validator.
 * Covers valid payload parsing, event type validation, required field validation,
 * and malformed JSON handling.
 */

import { parseWebhookPayload } from './webhook.js';

import type { MoeGoAppointmentCreatedEvent } from '#/types/moego.js';

/**
 * Base webhook payload used across tests.
 * Override individual fields per test as needed.
 */
const basePayload = {
  id: 'evt_001',
  type: 'APPOINTMENT_CREATED',
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
   * @description Confirms a valid APPOINTMENT_CREATED payload is parsed correctly.
   */
  it('parses a valid APPOINTMENT_CREATED payload', () => {
    const result = parseWebhookPayload(JSON.stringify(basePayload)) as MoeGoAppointmentCreatedEvent;

    expect(result.type).toBe('APPOINTMENT_CREATED');
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
