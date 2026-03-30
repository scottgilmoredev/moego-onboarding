/**
 * Email Module Tests
 *
 * @module
 * @description Unit tests for the email delivery module. Covers success email,
 * partial failure email, full failure email, and Short.io fallback email
 * composition and delivery via MailApp.
 */

import {
  sendSuccessEmail,
  sendFullFailureEmail,
  sendPartialFailureEmail,
  sendShortIoFailureEmail,
  sendSheetWriteFailureEmail,
} from './email.js';

const mockConfig = {
  businessOwnerEmails: ['owner@example.com', 'another-owner@example.com'],
};

vi.mock('#/utils/config.js', () => ({
  getConfig: () => mockConfig,
}));

/**
 * sendSuccessEmail
 *
 * @description Tests for success email composition and delivery. Covers
 * successful shortened URL delivery and Short.io fallback advisory note.
 */
describe('sendSuccessEmail', () => {
  beforeEach(() => {
    vi.stubGlobal('MailApp', {
      sendEmail: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms success email is sent with correct recipient,
   * subject, and body when URL is shortened.
   */
  it('sends success email with shortened URL', () => {
    sendSuccessEmail({
      firstName: 'John',
      lastName: 'Doe',
      url: 'https://abc.short.gy/xyz123',
      shortened: true,
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'New Client Onboarding — John D.',
      expect.stringContaining('https://abc.short.gy/xyz123')
    );
  });

  /**
   * @test
   * @description Confirms success email does not include Short.io fallback
   * advisory note when URL is shortened.
   */
  it('does not include fallback advisory note when URL is shortened', () => {
    sendSuccessEmail({
      firstName: 'John',
      lastName: 'Doe',
      url: 'https://abc.short.gy/xyz123',
      shortened: true,
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).not.toContain('URL shortening failed');
  });

  /**
   * @test
   * @description Confirms success email includes Short.io fallback advisory
   * note when URL is not shortened.
   */
  it('includes fallback advisory note when URL is not shortened', () => {
    sendSuccessEmail({
      firstName: 'John',
      lastName: 'Doe',
      url: 'https://docs.google.com/forms/d/e/test/viewform?entry.444=https%3A%2F%2Fclient.moego.pet',
      shortened: false,
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('URL shortening failed');
  });
});

/**
 * sendFullFailureEmail
 *
 * @description Tests for full failure email composition and delivery. Covers
 * correct recipient, subject, body content including customer MoeGo ID and
 * manual recovery steps. No URL is included.
 */
describe('sendFullFailureEmail', () => {
  beforeEach(() => {
    vi.stubGlobal('MailApp', {
      sendEmail: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms full failure email is sent with correct recipient
   * and subject.
   */
  it('sends full failure email to correct recipient with correct subject', () => {
    sendFullFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'Action Required — Onboarding Links Unavailable for John D.',
      expect.any(String)
    );
  });

  /**
   * @test
   * @description Confirms full failure email body contains the customer MoeGo ID.
   */
  it('includes the customer MoeGo ID in the body', () => {
    sendFullFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('cus_001');
  });

  /**
   * @test
   * @description Confirms full failure email body contains manual recovery steps.
   */
  it('includes manual recovery steps in the body', () => {
    sendFullFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('manual');
  });

  /**
   * @test
   * @description Confirms full failure email body does not contain a URL.
   */
  it('does not include a URL in the body', () => {
    sendFullFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).not.toContain('https://');
  });
});

/**
 * sendPartialFailureEmail
 *
 * @description Tests for partial failure email composition and delivery. Covers
 * correct recipient, subject, body content including failed fields, partial URL,
 * customer MoeGo ID, and manual recovery steps.
 */
describe('sendPartialFailureEmail', () => {
  beforeEach(() => {
    vi.stubGlobal('MailApp', {
      sendEmail: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms partial failure email is sent with correct recipient
   * and subject.
   */
  it('sends partial failure email to correct recipient with correct subject', () => {
    sendPartialFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      partialUrl: 'https://abc.short.gy/xyz123',
      missingFields: ['serviceAgreementUrl'],
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'Action Required — Onboarding Links Partially Unavailable for John D.',
      expect.any(String)
    );
  });

  /**
   * @test
   * @description Confirms partial failure email body contains the partial URL.
   */
  it('includes the partial URL in the body', () => {
    sendPartialFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      partialUrl: 'https://abc.short.gy/xyz123',
      missingFields: ['serviceAgreementUrl'],
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('https://abc.short.gy/xyz123');
  });

  /**
   * @test
   * @description Confirms partial failure email body contains the customer MoeGo ID.
   */
  it('includes the customer MoeGo ID in the body', () => {
    sendPartialFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      partialUrl: 'https://abc.short.gy/xyz123',
      missingFields: ['serviceAgreementUrl'],
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('cus_001');
  });

  /**
   * @test
   * @description Confirms partial failure email body identifies each missing field.
   */
  it('identifies all missing fields in the body', () => {
    sendPartialFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      partialUrl: 'https://abc.short.gy/xyz123',
      missingFields: ['serviceAgreementUrl', 'cofUrl'],
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('serviceAgreementUrl');
    expect(body).toContain('cofUrl');
  });

  /**
   * @test
   * @description Confirms partial failure email body contains manual recovery steps.
   */
  it('includes manual recovery steps in the body', () => {
    sendPartialFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      partialUrl: 'https://abc.short.gy/xyz123',
      missingFields: ['serviceAgreementUrl'],
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('manual');
  });
});

/**
 * sendShortIoFailureEmail
 *
 * @description Tests for Short.io failure email composition and delivery. Covers
 * correct recipient, subject, full token URL, customer ID, and manual recovery steps.
 */
describe('sendShortIoFailureEmail', () => {
  beforeEach(() => {
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms email is sent to the correct recipient with correct subject.
   */
  it('sends to correct recipient with correct subject', () => {
    sendShortIoFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      fullUrl: 'https://script.google.com/macros/s/abc/exec?token=xyz',
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'Action Required — URL Shortening Failed for John D.',
      expect.any(String)
    );
  });

  /**
   * @test
   * @description Confirms the full token URL is included in the body.
   */
  it('includes the full token URL in the body', () => {
    sendShortIoFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      fullUrl: 'https://script.google.com/macros/s/abc/exec?token=xyz',
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('https://script.google.com/macros/s/abc/exec?token=xyz');
  });

  /**
   * @test
   * @description Confirms the customer ID and manual recovery steps are included.
   */
  it('includes the customer ID and manual recovery steps', () => {
    sendShortIoFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      fullUrl: 'https://script.google.com/macros/s/abc/exec?token=xyz',
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('cus_001');
    expect(body).toContain('manual');
  });
});

/**
 * sendSheetWriteFailureEmail
 *
 * @description Tests for sheet write failure email composition and delivery. Covers
 * correct recipient, subject, shortened token URL, customer ID, and manual recovery steps.
 */
describe('sendSheetWriteFailureEmail', () => {
  beforeEach(() => {
    vi.stubGlobal('MailApp', { sendEmail: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * @test
   * @description Confirms email is sent to the correct recipient with correct subject.
   */
  it('sends to correct recipient with correct subject', () => {
    sendSheetWriteFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      shortUrl: 'https://abc.short.gy/xyz123',
    });

    expect(MailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com, another-owner@example.com',
      'Action Required — Sheet Write Failed for John D.',
      expect.any(String)
    );
  });

  /**
   * @test
   * @description Confirms the shortened token URL is included in the body.
   */
  it('includes the shortened token URL in the body', () => {
    sendSheetWriteFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      shortUrl: 'https://abc.short.gy/xyz123',
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('https://abc.short.gy/xyz123');
  });

  /**
   * @test
   * @description Confirms the customer ID and manual recovery steps are included.
   */
  it('includes the customer ID and manual recovery steps', () => {
    sendSheetWriteFailureEmail({
      firstName: 'John',
      lastName: 'Doe',
      customerId: 'cus_001',
      shortUrl: 'https://abc.short.gy/xyz123',
    });

    const body = (MailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('cus_001');
    expect(body).toContain('manual');
  });
});
