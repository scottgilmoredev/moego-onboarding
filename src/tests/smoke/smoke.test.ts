/**
 * Smoke Tests
 *
 * @module
 * @description Verifies the critical path through the onboarding flow is
 * operational. Confirms doPost handles a valid APPOINTMENT_CREATED payload
 * end-to-end with mocked GAS globals and stubbed API responses.
 */

import { doPost } from '#/server.js';
import { mockConfig } from '#/tests/utils/gas-mocks.js';

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
  const mockSheet = { appendRow: vi.fn() };
  const mockSpreadsheet = { getActiveSheet: vi.fn().mockReturnValue(mockSheet) };

  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
    vi.stubGlobal('ContentService', {
      createTextOutput: vi.fn().mockReturnValue({ setMimeType: vi.fn() }),
    });
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperties: vi.fn().mockReturnValue({}),
        getProperty: vi.fn().mockReturnValue(null),
        setProperty: vi.fn(),
        deleteProperty: vi.fn(),
      }),
    });
    vi.stubGlobal('Utilities', {
      getUuid: vi.fn().mockReturnValue('test-uuid'),
    });
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue(mockSpreadsheet),
    });
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

        // hasFinishedAppointments — no finished appointments (new client)
        .mockReturnValueOnce({
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ appointments: [] }),
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms doPost processes a valid APPOINTMENT_CREATED payload
   * end-to-end without throwing, writes the sheet row, and delivers a success
   * email to the business owner.
   */
  it('processes a valid APPOINTMENT_CREATED webhook end-to-end', () => {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({
          id: 'evt_001',
          type: 'APPOINTMENT_CREATED',
          timestamp: '2024-08-01T12:10:00Z',
          companyId: 'cmp_001',
          moegoWebhookSecret: 'test-webhook-secret',
          appointment: {
            id: 'apt_001',
            businessId: 'biz_001',
            customerId: 'cus_001',
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
    expect(mockSheet.appendRow).toHaveBeenCalled();
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });
});
