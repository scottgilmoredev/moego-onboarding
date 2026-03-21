/**
 * Form URL Builder Tests
 *
 * @module
 * @description Unit tests for the Google Form pre-filled URL builder.
 * Covers successful URL construction with all fields present, partial URL
 * construction when one or more links are unavailable, and URL encoding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { buildFormUrl } from './form.js';

const mockConfig = {
  googleFormUrl: 'https://docs.google.com/forms/d/e/test/viewform',
  formEntryFirstName: 'entry.111',
  formEntryLastName: 'entry.222',
  formEntryPhone: 'entry.333',
  formEntryServiceAgreement: 'entry.444',
  formEntrySmsAgreement: 'entry.555',
  formEntryCof: 'entry.666',
};

vi.mock('#/utils/config.js', () => ({
  getConfig: () => mockConfig,
}));

describe('buildFormUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms a complete pre-filled URL is constructed when all
   * fields are present.
   */
  it('constructs a complete pre-filled URL when all fields are present', () => {
    const result = buildFormUrl({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+12125551234',
      serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
      smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
      cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
    });

    expect(result.missingFields).toHaveLength(0);
    expect(result.url).toContain('entry.111=John');
    expect(result.url).toContain('entry.222=Doe');
    expect(result.url).toContain('entry.333=%2B12125551234');
    expect(result.url).toContain(
      'entry.444=https%3A%2F%2Fclient.moego.pet%2Fagreement%2Fsign%2Fabc123'
    );
    expect(result.url).toContain(
      'entry.555=https%3A%2F%2Fclient.moego.pet%2Fagreement%2Fsign%2Fdef456'
    );
    expect(result.url).toContain(
      'entry.666=https%3A%2F%2Fclient.moego.pet%2Fpayment%2Fcof%2Fclient%3Fc%3Dghi789'
    );
  });

  /**
   * @test
   * @description Confirms a partial URL is constructed and missing fields are
   * reported when the Service Agreement URL is unavailable.
   */
  it('constructs a partial URL and reports missing fields when serviceAgreementUrl is null', () => {
    const result = buildFormUrl({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+12125551234',
      serviceAgreementUrl: null,
      smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
      cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
    });

    expect(result.missingFields).toContain('serviceAgreementUrl');
    expect(result.url).not.toContain('entry.444');
  });

  /**
   * @test
   * @description Confirms a partial URL is constructed and missing fields are
   * reported when the SMS Agreement URL is unavailable.
   */
  it('constructs a partial URL and reports missing fields when smsAgreementUrl is null', () => {
    const result = buildFormUrl({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+12125551234',
      serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
      smsAgreementUrl: null,
      cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
    });

    expect(result.missingFields).toContain('smsAgreementUrl');
    expect(result.url).not.toContain('entry.555');
  });

  /**
   * @test
   * @description Confirms a partial URL is constructed and missing fields are
   * reported when the card-on-file URL is unavailable.
   */
  it('constructs a partial URL and reports missing fields when cofUrl is null', () => {
    const result = buildFormUrl({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+12125551234',
      serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
      smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
      cofUrl: null,
    });

    expect(result.missingFields).toContain('cofUrl');
    expect(result.url).not.toContain('entry.666');
  });

  /**
   * @test
   * @description Confirms all nullable fields are reported as missing when
   * all three links are unavailable.
   */
  it('reports all missing fields when all links are null', () => {
    const result = buildFormUrl({
      firstName: 'John',
      lastName: 'Doe',
      phone: '+12125551234',
      serviceAgreementUrl: null,
      smsAgreementUrl: null,
      cofUrl: null,
    });

    expect(result.missingFields).toHaveLength(3);
    expect(result.missingFields).toContain('serviceAgreementUrl');
    expect(result.missingFields).toContain('smsAgreementUrl');
    expect(result.missingFields).toContain('cofUrl');
  });
});
