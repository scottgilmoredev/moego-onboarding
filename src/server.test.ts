/**
 * Server Tests
 *
 * @module
 * @description Tests for the Apps Script doPost entrypoint and its helper
 * functions. Covers fetchCustomer, fetchOnboardingLinks, sendOnboardingEmail,
 * and the full doPost orchestration flow.
 */

import { doPost, fetchCustomer, fetchOnboardingLinks, sendOnboardingEmail } from '#/server.js';

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
  appointment: {
    id: 'apt_001',
    businessId: 'biz_001',
    customerId: 'cus_001',
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

        // getCustomer
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              id: 'cus_001',
              firstName: 'John',
              lastName: 'Doe',
              phone: '+12125551234',
            }),
        })

        // Service Agreement sign link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/abc123' }),
        })

        // SMS Agreement sign link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/def456' }),
        })

        // Card-on-file link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ link: 'https://client.moego.pet/payment/cof/client?c=ghi789' }),
        })

        // Short.io shortened URL
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

        // getCustomer
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              id: 'cus_001',
              firstName: 'John',
              lastName: 'Doe',
              phone: '+12125551234',
            }),
        })

        // Service Agreement sign link — fails
        .mockReturnValueOnce({
          getResponseCode: () => 404,
          getContentText: () => JSON.stringify({ message: 'Not found' }),
        })

        // SMS Agreement sign link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/def456' }),
        })

        // Card-on-file link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ link: 'https://client.moego.pet/payment/cof/client?c=ghi789' }),
        })

        // Short.io shortened URL
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
      fetch: vi
        .fn()

        // getCustomer
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              id: 'cus_001',
              firstName: 'John',
              lastName: 'Doe',
              phone: '+12125551234',
            }),
        })

        // All MoeGo API calls fail
        .mockReturnValue({
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

        // getCustomer
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              id: 'cus_001',
              firstName: 'John',
              lastName: 'Doe',
              phone: '+12125551234',
            }),
        })

        // Service Agreement sign link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/abc123' }),
        })

        // SMS Agreement sign link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/def456' }),
        })

        // Card-on-file link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ link: 'https://client.moego.pet/payment/cof/client?c=ghi789' }),
        })

        // Short.io — fails
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
      fetch: vi
        .fn()

        // getCustomer
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              id: 'cus_001',
              firstName: 'John',
              lastName: 'Doe',
              phone: '+12125551234',
            }),
        })

        // Remaining calls all succeed (service agreement, sms agreement, cof, short.io)
        .mockReturnValue({
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
   * @description Confirms doPost sends full failure email when customer lookup fails.
   */
  it('sends full failure email when customer lookup fails', () => {
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
   * @description Confirms doPost ignores events from other companies.
   */
  it('ignores events from other companies', () => {
    doPost(mockDoPostEvent({ ...basePayload, companyId: 'other_company' }));

    expect(MailApp.sendEmail).not.toHaveBeenCalled();
    expect(ContentService.createTextOutput).toHaveBeenCalledWith('OK');
  });
});

/**
 * fetchCustomer
 *
 * @description Tests for the fetchCustomer helper. Covers successful retrieval
 * and null return on failure.
 */
describe('fetchCustomer', () => {
  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms the customer is returned on a successful API call.
   */
  it('returns the customer on success', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({
            id: 'cus_001',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+12125551234',
          }),
      }),
    });

    const result = fetchCustomer('cus_001', 'test-api-key');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('cus_001');
  });

  /**
   * @test
   * @description Confirms null is returned when the API call fails.
   */
  it('returns null on failure', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue({
        getResponseCode: () => 500,
        getContentText: () => JSON.stringify({ message: 'Server error' }),
      }),
    });

    const result = fetchCustomer('cus_001', 'test-api-key');

    expect(result).toBeNull();
  });
});

/**
 * fetchOnboardingLinks
 *
 * @description Tests for the fetchOnboardingLinks helper. Covers full success,
 * partial failure, and full failure cases.
 */
describe('fetchOnboardingLinks', () => {
  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms all three links are returned when all API calls succeed.
   */
  it('returns all links on full success', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi
        .fn()

        // Service Agreement sign link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/abc123' }),
        })

        // SMS Agreement sign link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/def456' }),
        })

        // Card-on-file link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ link: 'https://client.moego.pet/payment/cof/client?c=ghi789' }),
        }),
    });

    const result = fetchOnboardingLinks({
      customerId: 'cus_001',
      businessId: 'biz_001',
      serviceAgreementId: 'agr_service',
      smsAgreementId: 'agr_sms',
      apiKey: 'test-api-key',
    });

    expect(result.serviceAgreementUrl).toBe('https://client.moego.pet/agreement/sign/abc123');
    expect(result.smsAgreementUrl).toBe('https://client.moego.pet/agreement/sign/def456');
    expect(result.cofUrl).toBe('https://client.moego.pet/payment/cof/client?c=ghi789');
  });

  /**
   * @test
   * @description Confirms failed calls return null while successful calls proceed.
   */
  it('returns null for failed calls and proceeds with the rest', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi
        .fn()

        // Service Agreement sign link — fails
        .mockReturnValueOnce({
          getResponseCode: () => 404,
          getContentText: () => JSON.stringify({ message: 'Not found' }),
        })

        // SMS Agreement sign link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ signUrl: 'https://client.moego.pet/agreement/sign/def456' }),
        })

        // Card-on-file link
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({ link: 'https://client.moego.pet/payment/cof/client?c=ghi789' }),
        }),
    });

    const result = fetchOnboardingLinks({
      customerId: 'cus_001',
      businessId: 'biz_001',
      serviceAgreementId: 'agr_service',
      smsAgreementId: 'agr_sms',
      apiKey: 'test-api-key',
    });

    expect(result.serviceAgreementUrl).toBeNull();
    expect(result.smsAgreementUrl).toBe('https://client.moego.pet/agreement/sign/def456');
    expect(result.cofUrl).toBe('https://client.moego.pet/payment/cof/client?c=ghi789');
  });

  /**
   * @test
   * @description Confirms all links are null when all API calls fail.
   */
  it('returns all null on full failure', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue({
        getResponseCode: () => 500,
        getContentText: () => JSON.stringify({ message: 'Server error' }),
      }),
    });

    const result = fetchOnboardingLinks({
      customerId: 'cus_001',
      businessId: 'biz_001',
      serviceAgreementId: 'agr_service',
      smsAgreementId: 'agr_sms',
      apiKey: 'test-api-key',
    });

    expect(result.serviceAgreementUrl).toBeNull();
    expect(result.smsAgreementUrl).toBeNull();
    expect(result.cofUrl).toBeNull();
  });
});

/**
 * sendOnboardingEmail
 *
 * @description Tests for the sendOnboardingEmail helper. Covers success,
 * partial failure, full failure, and Short.io fallback cases.
 */
describe('sendOnboardingEmail', () => {
  const mockCustomer = {
    id: 'cus_001',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+12125551234',
    companyId: 'cmp_001',
  };

  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms a success email is sent when all links are present
   * and URL is shortened.
   */
  it('sends success email when all links are present', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ shortURL: 'https://abc.short.gy/xyz123' }),
      }),
    });

    sendOnboardingEmail({
      customer: mockCustomer,
      customerId: 'cus_001',
      links: {
        serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
        smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
        cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
      },
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });

  /**
   * @test
   * @description Confirms a partial failure email is sent when one link is missing.
   */
  it('sends partial failure email when one link is missing', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ shortURL: 'https://abc.short.gy/xyz123' }),
      }),
    });

    sendOnboardingEmail({
      customer: mockCustomer,
      customerId: 'cus_001',
      links: {
        serviceAgreementUrl: null,
        smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
        cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
      },
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Partially Unavailable'),
      expect.stringContaining('cus_001')
    );
  });

  /**
   * @test
   * @description Confirms a full failure email is sent when all links are missing.
   */
  it('sends full failure email when all links are missing', () => {
    sendOnboardingEmail({
      customer: mockCustomer,
      customerId: 'cus_001',
      links: {
        serviceAgreementUrl: null,
        smsAgreementUrl: null,
        cofUrl: null,
      },
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Unavailable'),
      expect.stringContaining('cus_001')
    );
  });

  /**
   * @test
   * @description Confirms a success email with fallback advisory note is sent
   * when Short.io fails.
   */
  it('sends success email with fallback advisory note when Short.io fails', () => {
    vi.stubGlobal('UrlFetchApp', {
      fetch: vi.fn().mockReturnValue({
        getResponseCode: () => 500,
        getContentText: () => JSON.stringify({ message: 'Server error' }),
      }),
    });

    sendOnboardingEmail({
      customer: mockCustomer,
      customerId: 'cus_001',
      links: {
        serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
        smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
        cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
      },
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('URL shortening failed')
    );
  });
});
