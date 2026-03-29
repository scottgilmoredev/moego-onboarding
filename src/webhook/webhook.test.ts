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
  appointment: {
    id: 'apt_001',
    businessId: 'biz_001',
    customerId: 'cus_001',
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
    const { type, appointment } = parseWebhookPayload(
      JSON.stringify(basePayload)
    ) as MoeGoAppointmentCreatedEvent;

    expect(type).toBe('APPOINTMENT_CREATED');
    expect(appointment.id).toBe('apt_001');
    expect(appointment.businessId).toBe('biz_001');
    expect(appointment.customerId).toBe('cus_001');
  });

  /**
   * @test
   * @description Confirms unsupported event types are returned without throwing.
   */
  it('returns without throwing for unsupported event types', () => {
    const raw = JSON.stringify({ ...basePayload, type: 'HEALTH_CHECK' });
    expect(() => parseWebhookPayload(raw)).not.toThrow();
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
   * @description Confirms a payload missing required appointment fields throws a clear error.
   */
  it('throws on missing required appointment fields', () => {
    const raw = JSON.stringify({
      ...basePayload,
      appointment: { id: 'apt_001', businessId: 'biz_001' },
    });

    expect(() => parseWebhookPayload(raw)).toThrow();
  });
});
