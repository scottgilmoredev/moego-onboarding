/**
 * Smoke Tests
 *
 * @module
 * @description Verifies the critical path through the onboarding flow is
 * operational. Confirms doPost handles a valid APPOINTMENT_CREATED payload
 * end-to-end with mocked GAS globals and stubbed API responses.
 */

import { doPost } from '#/server.js';

const mockConfig = {
  moegoApiKey: 'test-api-key',
  moegoCompanyId: 'cmp_001',
  moegoBusinessId: 'test-business-id',
  moegoServiceAgreementId: 'agr_service',
  moegoSmsAgreementId: 'agr_sms',
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

/**
 * smoke
 *
 * @description Verifies the full onboarding flow processes a valid
 * APPOINTMENT_CREATED webhook payload without throwing and delivers
 * an email to the business owner.
 */
describe('smoke', () => {
  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
    vi.stubGlobal('ContentService', {
      createTextOutput: vi.fn().mockReturnValue({ setMimeType: vi.fn() }),
    });
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms doPost processes a valid APPOINTMENT_CREATED payload
   * end-to-end without throwing and delivers a success email to the business
   * owner.
   */
  it('processes a valid APPOINTMENT_CREATED webhook end-to-end', () => {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({
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
        }),
        type: 'application/json',
        length: 0,
        name: '',
      },
      parameter: {
        'X-Moe-Client-Id': 'test-client-id',
        'X-Moe-Nonce': '123456789',
        'X-Moe-Timestamp': '1751284717825',
      },
    } as unknown as GoogleAppsScript.Events.DoPost;

    expect(() => doPost(mockEvent)).not.toThrow();
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });
});
