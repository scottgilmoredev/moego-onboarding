/**
 * Email Module Tests
 *
 * @module
 * @description Unit tests for the email delivery module. Covers success email,
 * partial failure email, full failure email, and Short.io fallback email
 * composition and delivery via GmailApp.
 */

import { sendSuccessEmail, sendPartialFailureEmail } from './email.js';

const mockConfig = {
  businessOwnerEmail: 'owner@example.com',
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
    vi.stubGlobal('GmailApp', {
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

    expect(GmailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com',
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

    const body = (GmailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
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

    const body = (GmailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('URL shortening failed');
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
    vi.stubGlobal('GmailApp', {
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

    expect(GmailApp.sendEmail).toHaveBeenCalledWith(
      'owner@example.com',
      'Action Required — Incomplete Onboarding for John D.',
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

    const body = (GmailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
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

    const body = (GmailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
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

    const body = (GmailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
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

    const body = (GmailApp.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][2] as string;
    expect(body).toContain('manual');
  });
});
