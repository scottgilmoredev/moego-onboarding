/**
 * Config Module Tests
 *
 * @module
 * @description Unit tests for the environment configuration module.
 * Covers Node.js environment variable access, missing variable detection,
 * and GAS PropertiesService runtime.
 */

describe('getConfig', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  /**
   * @test
   * @description Confirms config reads from process.env in Node.js environment.
   */
  it('reads all required values from process.env in Node.js environment', async () => {
    vi.stubEnv('MOEGO_API_KEY', 'test-api-key');
    vi.stubEnv('MOEGO_COMPANY_ID', 'test-company-id');
    vi.stubEnv('MOEGO_BUSINESS_ID', 'test-business-id');
    vi.stubEnv('MOEGO_SERVICE_AGREEMENT_ID', 'test-service-agreement-id');
    vi.stubEnv('MOEGO_SMS_AGREEMENT_ID', 'test-sms-agreement-id');
    vi.stubEnv('SHORTIO_API_KEY', 'test-shortio-key');
    vi.stubEnv('BUSINESS_OWNER_EMAILS', 'owner@example.com,another-owner@example.com');
    vi.stubEnv('GOOGLE_FORM_URL', 'https://docs.google.com/forms/test');
    vi.stubEnv('FORM_ENTRY_SERVICE_AGREEMENT', 'entry.444');
    vi.stubEnv('FORM_ENTRY_SMS_AGREEMENT', 'entry.555');
    vi.stubEnv('FORM_ENTRY_COF', 'entry.666');
    vi.stubEnv('SHORTIO_DOMAIN', 'abc.short.gy');
    vi.stubEnv('MOEGO_WEBHOOK_SECRET', 'test-webhook-secret');
    vi.stubEnv('BUSINESS_NAME', 'test-business-name');
    vi.stubEnv('BUSINESS_PHONE', '+1234567890');
    vi.stubEnv('BUSINESS_LOGO_URL', 'https://example.com/logo.png');
    vi.stubEnv('DRIVE_FOLDER_ID', 'test-drive-folder-id');

    const { getConfig } = await import('#/utils/config.js');
    const config = getConfig();

    expect(config.moegoApiKey).toBe('test-api-key');
    expect(config.moegoCompanyId).toBe('test-company-id');
    expect(config.moegoBusinessId).toBe('test-business-id');
    expect(config.moegoServiceAgreementId).toBe('test-service-agreement-id');
    expect(config.moegoSmsAgreementId).toBe('test-sms-agreement-id');
    expect(config.shortIoApiKey).toBe('test-shortio-key');
    expect(config.businessOwnerEmails).toEqual(['owner@example.com', 'another-owner@example.com']);
    expect(config.googleFormUrl).toBe('https://docs.google.com/forms/test');
    expect(config.formEntryServiceAgreement).toBe('entry.444');
    expect(config.formEntrySmsAgreement).toBe('entry.555');
    expect(config.formEntryCof).toBe('entry.666');
    expect(config.shortIoDomain).toBe('abc.short.gy');
    expect(config.moegoWebhookSecret).toBe('test-webhook-secret');
    expect(config.businessName).toBe('test-business-name');
    expect(config.businessPhone).toBe('+1234567890');
    expect(config.businessLogoUrl).toBe('https://example.com/logo.png');
    expect(config.driveFolderId).toBe('test-drive-folder-id');
  });

  /**
   * @test
   * @description Confirms config throws a clear error when a required variable is missing.
   */
  it('throws when a required environment variable is missing', async () => {
    const { getConfig } = await import('#/utils/config.js');
    expect(() => getConfig()).toThrow();
  });

  /**
   * @test
   * @description Confirms config reads from PropertiesService in GAS runtime.
   */
  it('reads from PropertiesService in GAS runtime', async () => {
    vi.stubGlobal('PropertiesService', {
      getScriptProperties: () => ({
        getProperty: (key: string) => `gas-${key}`,
      }),
    });

    const { getConfig } = await import('#/utils/config.js');
    const config = getConfig();

    expect(config.moegoApiKey).toBe('gas-MOEGO_API_KEY');
    expect(config.shortIoDomain).toBe('gas-SHORTIO_DOMAIN');
  });
});
