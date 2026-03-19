/**
 * Webhook Module Tests
 *
 * @module
 * @description Unit tests for the MoeGo webhook payload receiver and validator.
 * Covers valid payload parsing, event type validation, required field validation,
 * and malformed JSON handling.
 */

import { describe, it, expect } from 'vitest';

import { parseWebhookPayload } from './webhook.js';

import type { MoeGoCustomerCreatedEvent } from '#/types/moego.js';

describe('parseWebhookPayload', () => {
  /**
   * @test
   * @description Confirms a valid CUSTOMER_CREATED payload is parsed correctly.
   */
  it('parses a valid CUSTOMER_CREATED payload', () => {
    const raw = JSON.stringify({
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
    });

    const result = parseWebhookPayload(raw) as MoeGoCustomerCreatedEvent;

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
    const raw = JSON.stringify({
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
    });

    expect(() => parseWebhookPayload(raw)).toThrow();
  });

  /**
   * @test
   * @description Confirms a payload missing required customer fields throws a clear error.
   */
  it('throws on missing required customer fields', () => {
    const raw = JSON.stringify({
      id: 'evt_001',
      type: 'CUSTOMER_CREATED',
      timestamp: '2024-08-01T12:10:00Z',
      companyId: 'cmp_001',
      customer: {
        id: 'cus_001',
        firstName: 'John',
      },
    });

    expect(() => parseWebhookPayload(raw)).toThrow();
  });
});
