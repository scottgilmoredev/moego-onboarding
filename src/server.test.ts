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
  const mockSheet = { appendRow: vi.fn() };
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
 * filename prefixing, token invalidation, fallback for missing token, and
 * propagation of DriveApp errors.
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

  beforeEach(() => {
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
    vi.stubGlobal('DriveApp', {
      getFolderById: vi.fn().mockReturnValue(mockFolder),
    });
    vi.stubGlobal('Utilities', {
      base64Decode: vi.fn().mockReturnValue([1, 2, 3]),
      newBlob: vi.fn().mockReturnValue({}),
    });
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: vi.fn().mockReturnValue({
        getProperty: vi.fn().mockReturnValue(JSON.stringify(mockPayload)),
        deleteProperty: mockDeleteProperty,
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the file is created with a client-prefixed filename,
   * the token is marked as uploaded, and the owner is notified with the Drive URL.
   */
  it('creates a prefixed file, marks the token as uploaded, and notifies the owner', () => {
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
      [1, 2, 3],
      'application/pdf',
      'Jane_Smith_rabies.pdf'
    );
    expect(mockFolder.createFile).toHaveBeenCalled();
    expect(mockSetProperty).toHaveBeenCalledWith(
      'test-token',
      JSON.stringify({ ...mockPayload, uploaded: true })
    );
    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'Vaccination Record Uploaded — Jane S.',
      expect.stringContaining('https://drive.google.com/file/d/abc123')
    );
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

    expect(Utilities.newBlob).toHaveBeenCalledWith([1, 2, 3], 'application/pdf', 'rabies.pdf');
    expect(mockSetProperty).not.toHaveBeenCalled();
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
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
