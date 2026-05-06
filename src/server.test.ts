/**
 * Server Tests
 *
 * @module
 * @description Tests for the Apps Script doGet and doPost entrypoints and their
 * helper functions. Covers fetchCustomer, fetchOnboardingLinks, the full doPost
 * orchestration flow, doGet token validation and routing, and uploadVaccinationRecord.
 */

import {
  doGet,
  doPost,
  fetchCustomer,
  fetchOnboardingLinks,
  retriggerOnboarding,
  sendBatchUploadNotification,
  uploadVaccinationRecord,
} from '#/server.js';
import {
  createMockFetchResponse,
  mockConfig,
  stubUrlFetchApp,
  stubUrlFetchAppSequence,
} from '#/tests/utils/gas-mocks.js';

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

const mockCustomerResponse = createMockFetchResponse(200, {
  id: 'cus_001',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+12125551234',
});

const mockServiceAgreementResponse = createMockFetchResponse(200, {
  signUrl: 'https://client.moego.pet/agreement/sign/abc123',
});

const mockSmsAgreementResponse = createMockFetchResponse(200, {
  signUrl: 'https://client.moego.pet/agreement/sign/def456',
});

const mockCofResponse = createMockFetchResponse(200, {
  link: 'https://client.moego.pet/payment/cof/client?c=ghi789',
});

const mockShortIoResponse = createMockFetchResponse(200, {
  shortURL: 'https://abc.short.gy/xyz123',
});

const mockNoFinishedAppointmentsResponse = createMockFetchResponse(200, { appointments: [] });
const mockHasFinishedAppointmentsResponse = createMockFetchResponse(200, {
  appointments: [{ id: 'apt_000' }],
});

const mockErrorResponse = createMockFetchResponse(500, { message: 'Server error' });

const mockNotFoundResponse = createMockFetchResponse(404, { message: 'Not found' });

// ============================================================================
// doPost
// ============================================================================

/**
 * doPost
 *
 * @description Integration tests for the Apps Script doPost entrypoint.
 * Covers the full onboarding flow for success, full link failure, Short.io
 * failure, sheet write failure, and customer lookup failure cases.
 */
describe('doPost', () => {
  const mockSheet = {
    appendRow: vi.fn(),
    getDataRange: vi.fn().mockReturnValue({
      getValues: vi
        .fn()
        .mockReturnValue([
          [
            'Last Name',
            'First Name',
            'Phone',
            'Customer ID',
            'Onboarding Link',
            'Sent At',
            'Vaccination Records',
          ],
        ]),
    }),
    getLastRow: vi.fn().mockReturnValue(1),
    insertRowBefore: vi.fn(),
    getRange: vi.fn().mockReturnValue({ setValues: vi.fn() }),
  };
  const mockSpreadsheet = { getActiveSheet: vi.fn().mockReturnValue(mockSheet) };

  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
    vi.stubGlobal('ContentService', {
      createTextOutput: vi.fn().mockReturnValue({ setMimeType: vi.fn() }),
      MimeType: { TEXT: 'text/plain' },
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms doPost sends success email and writes sheet row
   * when all API calls succeed.
   */
  it('sends success email and writes sheet row when all API calls succeed', () => {
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockNoFinishedAppointmentsResponse,
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
      mockShortIoResponse,
    ]);

    doPost(mockDoPostEvent(basePayload));

    expect(mockSheet.appendRow).toHaveBeenCalled();
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });

  /**
   * @test
   * @description Confirms doPost sends full failure email when any MoeGo
   * API call fails.
   */
  it('sends full failure email when any MoeGo API call fails', () => {
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockNoFinishedAppointmentsResponse,
      mockNotFoundResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
    ]);

    doPost(mockDoPostEvent(basePayload));

    expect(mockSheet.appendRow).not.toHaveBeenCalled();
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Unavailable'),
      expect.stringContaining('cus_001')
    );
  });

  /**
   * @test
   * @description Confirms doPost sends Short.io failure email with full token
   * URL when URL shortening fails.
   */
  it('sends Short.io failure email with full token URL when shortening fails', () => {
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockNoFinishedAppointmentsResponse,
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
      mockErrorResponse,
    ]);

    doPost(mockDoPostEvent(basePayload));

    expect(mockSheet.appendRow).not.toHaveBeenCalled();
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('URL Shortening Failed'),
      expect.stringContaining('https://script.google.com/macros/s/abc/exec?token=test-uuid')
    );
  });

  /**
   * @test
   * @description Confirms doPost sends sheet write failure email with shortened
   * URL when the sheet write fails.
   */
  it('sends sheet write failure email with shortened URL when sheet write fails', () => {
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockNoFinishedAppointmentsResponse,
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
      mockShortIoResponse,
    ]);

    mockSheet.appendRow = vi.fn().mockImplementation(() => {
      throw new Error('Write failed');
    });

    doPost(mockDoPostEvent(basePayload));

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Sheet Write Failed'),
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });

  /**
   * @test
   * @description Confirms doPost sends full failure email when customer lookup fails.
   */
  it('sends full failure email when customer lookup fails', () => {
    stubUrlFetchApp(mockErrorResponse);

    doPost(mockDoPostEvent(basePayload));

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Unavailable'),
      expect.stringContaining('cus_001')
    );
  });

  /**
   * @test
   * @description Confirms doPost returns a 200 response for valid payloads.
   */
  it('returns 200 response for valid payload', () => {
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockNoFinishedAppointmentsResponse,
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
      mockShortIoResponse,
    ]);

    doPost(mockDoPostEvent(basePayload));

    expect(ContentService.createTextOutput).toHaveBeenCalledWith('OK');
  });

  /**
   * @test
   * @description Confirms doPost skips returning clients silently.
   */
  it('skips returning clients without sending email or writing sheet row', () => {
    stubUrlFetchAppSequence([mockCustomerResponse, mockHasFinishedAppointmentsResponse]);

    doPost(mockDoPostEvent(basePayload));

    expect(mockSheet.appendRow).not.toHaveBeenCalled();
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
    expect(ContentService.createTextOutput).toHaveBeenCalledWith('OK');
  });

  /**
   * @test
   * @description Confirms doPost sends full failure email when the finished
   * appointments check fails.
   */
  it('sends full failure email when finished appointments check fails', () => {
    stubUrlFetchAppSequence([mockCustomerResponse, mockErrorResponse]);

    doPost(mockDoPostEvent(basePayload));

    expect(mockSheet.appendRow).not.toHaveBeenCalled();
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

// ============================================================================
// HELPERS
// ============================================================================

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
    stubUrlFetchApp(mockCustomerResponse);

    const result = fetchCustomer('cus_001', 'test-api-key');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('cus_001');
  });

  /**
   * @test
   * @description Confirms null is returned when the API call fails.
   */
  it('returns null on failure', () => {
    stubUrlFetchApp(mockErrorResponse);

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
  const mockParams = {
    customerId: 'cus_001',
    businessId: 'biz_001',
    serviceAgreementId: 'agr_service',
    smsAgreementId: 'agr_sms',
    apiKey: 'test-api-key',
  };

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
    stubUrlFetchAppSequence([
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
    ]);

    const result = fetchOnboardingLinks(mockParams);

    expect(result.serviceAgreementUrl).toBe('https://client.moego.pet/agreement/sign/abc123');
    expect(result.smsAgreementUrl).toBe('https://client.moego.pet/agreement/sign/def456');
    expect(result.cofUrl).toBe('https://client.moego.pet/payment/cof/client?c=ghi789');
  });

  /**
   * @test
   * @description Confirms failed calls return null while successful calls proceed.
   */
  it('returns null for failed calls and proceeds with the rest', () => {
    stubUrlFetchAppSequence([mockNotFoundResponse, mockSmsAgreementResponse, mockCofResponse]);

    const result = fetchOnboardingLinks(mockParams);

    expect(result.serviceAgreementUrl).toBeNull();
    expect(result.smsAgreementUrl).toBe('https://client.moego.pet/agreement/sign/def456');
    expect(result.cofUrl).toBe('https://client.moego.pet/payment/cof/client?c=ghi789');
  });

  /**
   * @test
   * @description Confirms all links are null when all API calls fail.
   */
  it('returns all null on full failure', () => {
    stubUrlFetchApp(mockErrorResponse);

    const result = fetchOnboardingLinks(mockParams);

    expect(result.serviceAgreementUrl).toBeNull();
    expect(result.smsAgreementUrl).toBeNull();
    expect(result.cofUrl).toBeNull();
  });
});

// ============================================================================
// doGet
// ============================================================================

/**
 * doGet
 *
 * @description Tests for the Apps Script doGet entrypoint. Covers valid token,
 * expired/invalid token, and missing token cases.
 */
describe('doGet', () => {
  const mockTokenPayload = {
    customerId: 'cus_001',
    firstName: 'John',
    lastName: 'Doe',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
    smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
    cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
  };

  const mockDoGetEvent = (token?: string): GoogleAppsScript.Events.DoGet =>
    ({ parameter: token ? { token } : {} }) as unknown as GoogleAppsScript.Events.DoGet;

  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn(),
        setProperty: vi.fn(),
        deleteProperty: vi.fn(),
      }),
    });
    vi.stubGlobal('HtmlService', {
      createTemplateFromFile: vi.fn().mockReturnValue({
        evaluate: vi.fn().mockReturnValue({ setTitle: vi.fn().mockReturnThis() }),
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms doGet renders the landing page when the token is valid.
   */
  it('renders the landing page for a valid token', () => {
    PropertiesService.getScriptProperties().getProperty = vi
      .fn()
      .mockReturnValue(JSON.stringify(mockTokenPayload));

    doGet(mockDoGetEvent('valid-token'));

    expect(HtmlService.createTemplateFromFile).toHaveBeenCalledWith('landing');
  });

  /**
   * @test
   * @description Confirms doGet renders the error page when the token is invalid.
   */
  it('renders the error page for an invalid token', () => {
    PropertiesService.getScriptProperties().getProperty = vi.fn().mockReturnValue(null);

    doGet(mockDoGetEvent('invalid-token'));

    expect(HtmlService.createTemplateFromFile).toHaveBeenCalledWith('error');
  });

  /**
   * @test
   * @description Confirms doGet renders the error page when no token is provided.
   */
  it('renders the error page when token is missing', () => {
    doGet(mockDoGetEvent());

    expect(HtmlService.createTemplateFromFile).toHaveBeenCalledWith('error');
  });
});

// ============================================================================
// uploadVaccinationRecord
// ============================================================================

/**
 * uploadVaccinationRecord
 *
 * @description Tests for the uploadVaccinationRecord server function. Covers
 * filename prefixing, upload count tracking, upload cap enforcement, fallback
 * for missing token, and propagation of DriveApp errors.
 */
describe('uploadVaccinationRecord', () => {
  const mockFile = { getUrl: vi.fn().mockReturnValue('https://drive.google.com/file/d/abc123') };
  const mockFolder = { createFile: vi.fn().mockReturnValue(mockFile) };
  const mockDeleteProperty = vi.fn();

  const mockPayload = {
    customerId: 'cus_001',
    firstName: 'Jane',
    lastName: 'Smith',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
    smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
    cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
  };

  const mockSetValue = vi.fn();
  const mockSheetForUpload = {
    getDataRange: vi.fn().mockReturnValue({
      getValues: vi.fn().mockReturnValue([
        [
          'Last Name',
          'First Name',
          'Phone',
          'Customer ID',
          'Onboarding Link',
          'Sent At',
          'Vaccination Records',
        ],
        [
          'Smith',
          'Jane',
          '+14045551234',
          'cus_001',
          'https://abc.short.gy/xyz123',
          '2026-04-13 10:00',
          '',
        ],
      ]),
    }),
    getRange: vi.fn().mockReturnValue({ setValue: mockSetValue }),
  };

  beforeEach(() => {
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
    vi.stubGlobal('DriveApp', {
      getFolderById: vi.fn().mockReturnValue(mockFolder),
    });
    vi.stubGlobal('Utilities', {
      base64Decode: vi.fn().mockReturnValue([0x25, 0x50, 0x44, 0x46]),
      newBlob: vi.fn().mockReturnValue({}),
    });
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(mockPayload)),
        deleteProperty: mockDeleteProperty,
      }),
    });
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi
        .fn()
        .mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheetForUpload) }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the file is renamed to LastName_FirstName_vaccination.ext,
   * uploadCount is set to 1 on the first upload, the Drive URL is stored in uploads,
   * no notification email is sent, and the Drive URL is written to the sheet.
   */
  it('renames file, sets uploadCount to 1 on first upload, stores fileUrl, and writes to sheet', () => {
    const mockSetProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(mockPayload)),
        setProperty: mockSetProperty,
        deleteProperty: mockDeleteProperty,
      }),
    });

    uploadVaccinationRecord('rabies.pdf', 'application/pdf', 'base64data==', 'test-token');

    expect(Utilities.newBlob).toHaveBeenCalledWith(
      [0x25, 0x50, 0x44, 0x46],
      'application/pdf',
      'Smith_Jane_vaccination.pdf'
    );
    expect(mockFolder.createFile).toHaveBeenCalled();
    expect(mockSetProperty).toHaveBeenCalledWith(
      'test-token',
      JSON.stringify({
        ...mockPayload,
        uploadCount: 1,
        uploads: [
          {
            name: 'rabies.pdf',
            size: 4,
            type: 'application/pdf',
            fileUrl: 'https://drive.google.com/file/d/abc123',
          },
        ],
      })
    );
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
    expect(mockSetValue).toHaveBeenCalledWith(
      expect.stringContaining('https://drive.google.com/file/d/abc123')
    );
  });

  /**
   * @test
   * @description Confirms uploadCount is incremented on subsequent uploads.
   */
  it('increments uploadCount on subsequent uploads', () => {
    const mockSetProperty = vi.fn();
    const payloadWithCount = { ...mockPayload, uploadCount: 2 };

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(payloadWithCount)),
        setProperty: mockSetProperty,
        deleteProperty: mockDeleteProperty,
      }),
    });

    uploadVaccinationRecord('rabies.pdf', 'application/pdf', 'base64data==', 'test-token');

    expect(mockSetProperty).toHaveBeenCalledWith(
      'test-token',
      JSON.stringify({
        ...payloadWithCount,
        uploadCount: 3,
        uploads: [{ name: 'rabies.pdf', size: 4, type: 'application/pdf' }],
      })
    );
  });

  /**
   * @test
   * @description Confirms upload is rejected and no file is created when uploadCount
   * has reached the cap of 5.
   */
  it('throws and does not upload when uploadCount has reached the cap', () => {
    const payloadAtCap = { ...mockPayload, uploadCount: 5 };

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(payloadAtCap)),
        deleteProperty: mockDeleteProperty,
      }),
    });

    expect(() =>
      uploadVaccinationRecord('rabies.pdf', 'application/pdf', 'base64data==', 'test-token')
    ).toThrow('Upload limit reached');
    expect(mockFolder.createFile).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms the file is created with the original filename,
   * no token update is made, and no notification is sent when the token is not found.
   */
  it('uploads with original filename and skips token update and notification when token is not found', () => {
    const mockSetProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(null),
        setProperty: mockSetProperty,
        deleteProperty: mockDeleteProperty,
      }),
    });

    uploadVaccinationRecord('rabies.pdf', 'application/pdf', 'base64data==', 'test-token');

    expect(Utilities.newBlob).toHaveBeenCalledWith(
      [0x25, 0x50, 0x44, 0x46],
      'application/pdf',
      'rabies.pdf'
    );
    expect(mockSetProperty).not.toHaveBeenCalled();
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms upload is rejected and no file is created when the
   * MIME type is not in the allowlist.
   */
  it('throws and does not upload when mimeType is not in the allowlist', () => {
    expect(() =>
      uploadVaccinationRecord('photo.gif', 'image/gif', 'base64data==', 'test-token')
    ).toThrow('Invalid file type');
    expect(mockFolder.createFile).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms upload proceeds for all allowed MIME types with matching magic bytes.
   */
  it.each([
    ['application/pdf', 'rabies.pdf', [0x25, 0x50, 0x44, 0x46]],
    // GAS Utilities.base64Decode returns signed bytes; values > 127 are negative
    ['image/jpeg', 'rabies.jpg', [-1, -40, -1]],
    ['image/png', 'rabies.png', [-119, 80, 78, 71, 13, 10, 26, 10]],
  ])('allows upload for %s', (mimeType, fileName, magicBytes) => {
    const mockSetProperty = vi.fn();

    vi.stubGlobal('Utilities', {
      base64Decode: vi.fn().mockReturnValue(magicBytes),
      newBlob: vi.fn().mockReturnValue({}),
    });
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(mockPayload)),
        setProperty: mockSetProperty,
        deleteProperty: mockDeleteProperty,
      }),
    });

    expect(() =>
      uploadVaccinationRecord(fileName, mimeType, 'base64data==', 'test-token')
    ).not.toThrow();
  });

  /**
   * @test
   * @description Confirms upload is rejected when bytes don't match the claimed MIME type.
   */
  it.each([
    ['application/pdf', 'rabies.pdf', [-119, 80, 78, 71, 13, 10, 26, 10]],
    ['image/jpeg', 'rabies.jpg', [0x25, 0x50, 0x44, 0x46]],
    ['image/png', 'rabies.png', [-1, -40, -1]],
  ])(
    'throws when magic bytes do not match claimed mimeType %s',
    (mimeType, fileName, wrongBytes) => {
      vi.stubGlobal('Utilities', {
        base64Decode: vi.fn().mockReturnValue(wrongBytes),
        newBlob: vi.fn().mockReturnValue({}),
      });

      expect(() =>
        uploadVaccinationRecord(fileName, mimeType, 'base64data==', 'test-token')
      ).toThrow('Invalid file type');
      expect(mockFolder.createFile).not.toHaveBeenCalled();
    }
  );

  /**
   * @test
   * @description Confirms mimeType is normalized to lowercase before validation.
   */
  it('accepts mixed-case mimeType', () => {
    const mockSetProperty = vi.fn();

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(mockPayload)),
        setProperty: mockSetProperty,
        deleteProperty: mockDeleteProperty,
      }),
    });

    expect(() =>
      uploadVaccinationRecord('rabies.pdf', 'Application/PDF', 'base64data==', 'test-token')
    ).not.toThrow();
  });

  /**
   * @test
   * @description Confirms DriveApp errors propagate to the caller (and are
   * caught by google.script.run's withFailureHandler on the client).
   */
  it('propagates DriveApp errors', () => {
    DriveApp.getFolderById = vi.fn().mockImplementation(() => {
      throw new Error('Drive folder not found');
    });

    expect(() =>
      uploadVaccinationRecord('rabies.pdf', 'application/pdf', 'base64data==', 'test-token')
    ).toThrow('Drive folder not found');
  });
});

// ============================================================================
// sendBatchUploadNotification
// ============================================================================

/**
 * sendBatchUploadNotification
 *
 * @description Tests for the batch upload notification. Covers the happy path
 * with multiple stored file URLs, no-op when the token is missing, and no-op
 * when the payload has no uploads.
 */
describe('sendBatchUploadNotification', () => {
  const mockPayloadForBatch = {
    customerId: 'cus_001',
    firstName: 'Jane',
    lastName: 'Smith',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    serviceAgreementUrl: 'https://client.moego.pet/agreement/sign/abc123',
    smsAgreementUrl: 'https://client.moego.pet/agreement/sign/def456',
    cofUrl: 'https://client.moego.pet/payment/cof/client?c=ghi789',
    uploadCount: 2,
    uploads: [
      {
        name: 'rabies.pdf',
        size: 4,
        type: 'application/pdf',
        fileUrl: 'https://drive.google.com/file/d/abc123',
      },
      {
        name: 'bordetella.pdf',
        size: 4,
        type: 'application/pdf',
        fileUrl: 'https://drive.google.com/file/d/def456',
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(mockPayloadForBatch)),
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms a single email is sent with all stored Drive file URLs.
   */
  it('sends one email containing all stored Drive file URLs', () => {
    sendBatchUploadNotification('test-token');

    expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('https://drive.google.com/file/d/abc123');
    expect(body).toContain('https://drive.google.com/file/d/def456');
  });

  /**
   * @test
   * @description Confirms no email is sent when the token is not found.
   */
  it('does nothing when token is not found', () => {
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(null),
      }),
    });

    sendBatchUploadNotification('test-token');

    expect(MailApp.sendEmail).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms no email is sent when the payload has no uploads.
   */
  it('does nothing when payload has no uploads', () => {
    const payloadNoUploads = { ...mockPayloadForBatch, uploads: [] };

    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(payloadNoUploads)),
      }),
    });

    sendBatchUploadNotification('test-token');

    expect(MailApp.sendEmail).not.toHaveBeenCalled();
  });
});

// ============================================================================
// retriggerOnboarding
// ============================================================================

/**
 * retriggerOnboarding
 *
 * @description Tests for the retriggerOnboarding owner tool. Covers the happy
 * path with an existing sheet row, the skipped-client path with no row, customer
 * lookup failure, onboarding link failure, Short.io failure, and sheet write failure.
 */
describe('retriggerOnboarding', () => {
  const existingRowsWithClient = [
    [
      'Last Name',
      'First Name',
      'Phone',
      'Customer ID',
      'Onboarding Link',
      'Sent At',
      'Vaccination Records',
    ],
    ['Doe', 'John', '+12125551234', 'cus_001', 'https://abc.short.gy/old', '2026-04-01 10:00', ''],
  ];

  const existingRowsWithoutClient = [
    [
      'Last Name',
      'First Name',
      'Phone',
      'Customer ID',
      'Onboarding Link',
      'Sent At',
      'Vaccination Records',
    ],
  ];

  function makeMockSheet(rows: unknown[][]) {
    return {
      appendRow: vi.fn(),
      getDataRange: vi.fn().mockReturnValue({ getValues: vi.fn().mockReturnValue(rows) }),
      getLastRow: vi.fn().mockReturnValue(rows.length),
      insertRowBefore: vi.fn(),
      getRange: vi.fn().mockReturnValue({ setValues: vi.fn() }),
    };
  }

  beforeEach(() => {
    vi.stubGlobal('console', { log: vi.fn() });
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the existing sheet row is updated and a success email
   * is sent when the client already has a row.
   */
  it('updates existing sheet row and sends success email when client row exists', () => {
    const mockSheet = makeMockSheet(existingRowsWithClient);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
      mockShortIoResponse,
    ]);

    retriggerOnboarding('cus_001');

    // updateClientOnboardingLink updates cols E-F on row 2
    expect(mockSheet.getRange).toHaveBeenCalledWith(2, 5, 1, 2);
    expect(mockSheet.insertRowBefore).not.toHaveBeenCalled();
    expect(mockSheet.appendRow).not.toHaveBeenCalled();
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });

  /**
   * @test
   * @description Confirms a new sheet row is inserted and a success email is
   * sent when the client was previously skipped and has no existing row.
   */
  it('inserts new sheet row and sends success email when client has no existing row', () => {
    const mockSheet = makeMockSheet(existingRowsWithoutClient);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
      mockShortIoResponse,
    ]);

    retriggerOnboarding('cus_001');

    expect(mockSheet.appendRow).toHaveBeenCalled();
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });

  /**
   * @test
   * @description Confirms a full failure email is sent when customer lookup fails.
   */
  it('sends full failure email when customer lookup fails', () => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({
        getActiveSheet: vi.fn().mockReturnValue(makeMockSheet(existingRowsWithClient)),
      }),
    });
    stubUrlFetchApp(mockErrorResponse);

    retriggerOnboarding('cus_001');

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Unavailable'),
      expect.stringContaining('cus_001')
    );
  });

  /**
   * @test
   * @description Confirms a full failure email is sent when any onboarding
   * link fetch fails.
   */
  it('sends full failure email when onboarding link fetch fails', () => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({
        getActiveSheet: vi.fn().mockReturnValue(makeMockSheet(existingRowsWithClient)),
      }),
    });
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockNotFoundResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
    ]);

    retriggerOnboarding('cus_001');

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Unavailable'),
      expect.stringContaining('cus_001')
    );
  });

  /**
   * @test
   * @description Confirms a Short.io failure email is sent when URL shortening fails.
   */
  it('sends Short.io failure email when URL shortening fails', () => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({
        getActiveSheet: vi.fn().mockReturnValue(makeMockSheet(existingRowsWithClient)),
      }),
    });
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
      mockErrorResponse,
    ]);

    retriggerOnboarding('cus_001');

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('URL Shortening Failed'),
      expect.stringContaining('https://script.google.com/macros/s/abc/exec?token=test-uuid')
    );
  });

  /**
   * @test
   * @description Confirms a sheet write failure email is sent when the sheet
   * update throws.
   */
  it('sends sheet write failure email when sheet update fails', () => {
    const mockSheet = makeMockSheet(existingRowsWithClient);
    mockSheet.getRange = vi.fn().mockImplementation(() => {
      throw new Error('Write failed');
    });
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });
    stubUrlFetchAppSequence([
      mockCustomerResponse,
      mockServiceAgreementResponse,
      mockSmsAgreementResponse,
      mockCofResponse,
      mockShortIoResponse,
    ]);

    retriggerOnboarding('cus_001');

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      expect.stringContaining('Sheet Write Failed'),
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });
});
