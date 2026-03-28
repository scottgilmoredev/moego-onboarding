/**
 * Server Tests
 *
 * @module
 * @description Tests for the Apps Script doPost entrypoint. Covers the full
 * onboarding flow including webhook parsing, MoeGo API calls, form URL
 * construction, URL shortening, and email delivery for all cases.
 */

import { doPost } from '#/server.js';

const mockConfig = {
  moegoApiKey: 'test-api-key',
  moegoCompanyId: 'cmp_001',
  moegoBusinessId: 'test-business-id',
  moegoServiceAgreementId: 'agr_service',
  moegoSmsAgreementId: 'agr_sms',
  moegoWebhookSecret: 'test-webhook-secret',
  shortIoApiKey: 'test-shortio-key',
  shortIoDomain: 'abc.short.gy',
  businessOwnerEmails: ['owner@example.com', 'another-owner@example.com'],
  googleFormUrl: 'https://docs.google.com/forms/d/e/test/viewform',
  formEntryServiceAgreement: 'entry.444',
  formEntrySmsAgreement: 'entry.555',
  formEntryCof: 'entry.666',
};

vi.mock('#/utils/config.js', () => ({
  getConfig: () => mockConfig,
}));

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

const mockDoPostEvent = (payload: object): GoogleAppsScript.Events.DoPost =>
  ({
    postData: {
      contents: JSON.stringify(payload),
      type: 'application/json',
      length: 0,
      name: '',
    },
    parameter: {
      'X-Moe-Client-Id': 'test-client-id',
      'X-Moe-Nonce': '123456789',
      'X-Moe-Timestamp': '1751284717825',
    },
  }) as unknown as GoogleAppsScript.Events.DoPost;

/**
 * doPost
 *
 * @description Integration tests for the Apps Script doPost entrypoint.
 * Covers the full onboarding flow for success, partial failure, full failure,
 * and Short.io fallback cases.
 */
describe('doPost', () => {
  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
    vi.stubGlobal('ContentService', {
      createTextOutput: vi.fn().mockReturnValue({ setMimeType: vi.fn() }),
      MimeType: { TEXT: 'text/plain' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms doPost sends success email when all API calls succeed
   * and URL is shortened.
   */
  it('sends success email when all API calls succeed', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi
        .fn()
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/abc123' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/def456' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ link: 'https://client.moego.pet/payment/cof/client?c=ghi789' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ shortURL: 'https://abc.short.gy/xyz123' }),
        }),
    });

    doPost(mockDoPostEvent(basePayload));

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });

  /**
   * @test
   * @description Confirms doPost sends partial failure email when one MoeGo
   * API call fails.
   */
  it('sends partial failure email when one MoeGo API call fails', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi
        .fn()
        .mockReturnValueOnce({
          getResponseCode: () => 404,
          getContentText: () => JSON.stringify({ message: 'Not found' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/def456' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ link: 'https://client.moego.pet/payment/cof/client?c=ghi789' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ shortURL: 'https://abc.short.gy/xyz123' }),
        }),
    });

    doPost(mockDoPostEvent(basePayload));

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Partially Unavailable'),
      expect.stringContaining('cus_001')
    );
  });

  /**
   * @test
   * @description Confirms doPost sends full failure email when all MoeGo
   * API calls fail.
   */
  it('sends full failure email when all MoeGo API calls fail', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue({
        getResponseCode: () => 500,
        getContentText: () => JSON.stringify({ message: 'Server error' }),
      }),
    });

    doPost(mockDoPostEvent(basePayload));

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Unavailable'),
      expect.stringContaining('cus_001')
    );
  });

  /**
   * @test
   * @description Confirms doPost sends success email with fallback advisory
   * note when Short.io API call fails.
   */
  it('sends success email with fallback advisory note when Short.io fails', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi
        .fn()
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/abc123' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/def456' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ link: 'https://client.moego.pet/payment/cof/client?c=ghi789' }),
        })
        .mockReturnValueOnce({
          getResponseCode: () => 500,
          getContentText: () => JSON.stringify({ message: 'Server error' }),
        }),
    });

    doPost(mockDoPostEvent(basePayload));

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('URL shortening failed')
    );
  });

  /**
   * @test
   * @description Confirms doPost returns a 200 response for valid payloads.
   */
  it('returns 200 response for valid payload', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/abc123' }),
      }),
    });

    doPost(mockDoPostEvent(basePayload));

    expect(ContentService.createTextOutput).toHaveBeenCalledWith('OK');
  });

  /**
   * @test
   * @description Confirms doPost ignores events from other companies.
   */
  it('ignores events from other companies', () => {
    doPost(mockDoPostEvent({ ...basePayload, companyId: 'other_company' }));

    expect(MailApp.sendEmail).not.toHaveBeenCalled();
    expect(ContentService.createTextOutput).toHaveBeenCalledWith('OK');
  });
});
