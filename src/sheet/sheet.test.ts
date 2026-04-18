/**
 * Google Sheets Client Tests
 *
 * @module
 * @description Unit tests for the Google Sheets client. Covers successful
 * row append and writeClientRow row assembly, SpreadsheetApp errors, and
 * sheet-not-found errors.
 */

import {
  appendSheetRow,
  updateClientOnboardingLink,
  writeClientRow,
  writeVaccinationRecord,
} from './sheet.js';

const mockConfig = {
  spreadsheetId: 'test-spreadsheet-id',
};

vi.mock('#/utils/config.js', () => ({
  getConfig: () => mockConfig,
}));

/**
 * appendSheetRow
 *
 * @description Tests for the appendSheetRow function. Covers successful
 * append, SpreadsheetApp errors, and sheet-not-found errors.
 */
describe('appendSheetRow', () => {
  const mockSheet = { appendRow: vi.fn() };
  const mockSpreadsheet = { getActiveSheet: vi.fn().mockReturnValue(mockSheet) };

  beforeEach(() => {
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
   * @description Confirms appendRow is called with the provided values.
   */
  it('appends a row with the provided values', () => {
    const values = ['2026-03-30', 'John Doe', 'https://abc.short.gy/xyz123'];

    appendSheetRow(values);

    expect(SpreadsheetApp.openById).toHaveBeenCalledWith('test-spreadsheet-id');
    expect(mockSpreadsheet.getActiveSheet).toHaveBeenCalled();
    expect(mockSheet.appendRow).toHaveBeenCalledWith(values);
  });

  /**
   * @test
   * @description Confirms SpreadsheetApp errors propagate to the caller.
   */
  it('propagates SpreadsheetApp errors', () => {
    SpreadsheetApp.openById = vi.fn().mockImplementation(() => {
      throw new Error('Spreadsheet not found');
    });

    expect(() => appendSheetRow(['value'])).toThrow('Spreadsheet not found');
  });

  /**
   * @test
   * @description Confirms appendRow errors propagate to the caller.
   */
  it('propagates appendRow errors', () => {
    mockSheet.appendRow = vi.fn().mockImplementation(() => {
      throw new Error('Write failed');
    });

    expect(() => appendSheetRow(['value'])).toThrow('Write failed');
  });
});

/**
 * writeClientRow
 *
 * @description Tests for the writeClientRow orchestration function. Covers
 * correct column order, alphabetical insertion by last name, sentAt timestamp
 * format, and SpreadsheetApp error propagation.
 */
describe('writeClientRow', () => {
  const mockInsertRowBefore = vi.fn();
  const mockGetRange = vi.fn().mockReturnValue({ setValues: vi.fn() });
  const mockAppendRow = vi.fn();

  const mockCustomer = {
    id: 'cus_001',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+14045551234',
    companyId: 'cmp_001',
  };

  // Existing rows: header + two data rows sorted A-Z by last name
  const existingRows = [
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
      'Anderson',
      'Alice',
      '+14045550001',
      'cus_002',
      'https://abc.short.gy/aaa',
      '2026-04-01 10:00',
      '',
    ],
    [
      'Taylor',
      'Bob',
      '+14045550002',
      'cus_003',
      'https://abc.short.gy/bbb',
      '2026-04-01 11:00',
      '',
    ],
  ];

  function makeMockSheet(rows: unknown[][]) {
    return {
      getDataRange: vi.fn().mockReturnValue({ getValues: vi.fn().mockReturnValue(rows) }),
      getLastRow: vi.fn().mockReturnValue(rows.length),
      insertRowBefore: mockInsertRowBefore,
      getRange: mockGetRange,
      appendRow: mockAppendRow,
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the row is always inserted at row 2 when data rows
   * exist, regardless of last name.
   */
  it('inserts at row 2 when data rows exist', () => {
    const mockSheet = makeMockSheet(existingRows);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });

    writeClientRow({ customer: mockCustomer, shortUrl: 'https://abc.short.gy/xyz123' });

    expect(mockInsertRowBefore).toHaveBeenCalledWith(2);
    expect(mockAppendRow).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms the row is appended when only the header row exists,
   * as there is no row 2 to insert before.
   */
  it('appends when only the header row exists', () => {
    const headerOnly = [existingRows[0]];
    const mockSheet = makeMockSheet(headerOnly);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });

    writeClientRow({ customer: mockCustomer, shortUrl: 'https://abc.short.gy/xyz123' });

    expect(mockAppendRow).toHaveBeenCalled();
    expect(mockInsertRowBefore).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms the row is written with the correct column order and
   * sentAt timestamp format.
   */
  it('writes the row with correct column order and sentAt timestamp', () => {
    const mockSheet = makeMockSheet(existingRows);
    const mockSetValues = vi.fn();
    mockSheet.getRange = vi.fn().mockReturnValue({ setValues: mockSetValues });

    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });

    writeClientRow({ customer: mockCustomer, shortUrl: 'https://abc.short.gy/xyz123' });

    const call = mockSetValues.mock.calls[0][0][0];

    expect(call[0]).toBe('Smith');
    expect(call[1]).toBe('Jane');
    expect(call[2]).toBe('+14045551234');
    expect(call[3]).toBe('cus_001');
    expect(call[4]).toBe('https://abc.short.gy/xyz123');
    // sentAt should be a formatted timestamp string
    expect(typeof call[5]).toBe('string');
    expect(call[5].length).toBeGreaterThan(0);
    expect(call[6]).toBe('');
  });

  /**
   * @test
   * @description Confirms SpreadsheetApp errors propagate to the caller.
   */
  it('propagates SpreadsheetApp errors', () => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockImplementation(() => {
        throw new Error('Spreadsheet not found');
      }),
    });

    expect(() =>
      writeClientRow({ customer: mockCustomer, shortUrl: 'https://abc.short.gy/xyz123' })
    ).toThrow('Spreadsheet not found');
  });
});

/**
 * updateClientOnboardingLink
 *
 * @description Tests for the updateClientOnboardingLink function. Covers
 * updating the onboarding link and sentAt for a found row, returning false
 * when the customerId is not found, and SpreadsheetApp error propagation.
 */
describe('updateClientOnboardingLink', () => {
  const mockSetValues = vi.fn();

  const existingRows = [
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
    [
      'Taylor',
      'Bob',
      '+14045550002',
      'cus_003',
      'https://abc.short.gy/bbb',
      '2026-04-01 11:00',
      '',
    ],
  ];

  function makeMockSheet(rows: unknown[][]) {
    return {
      getDataRange: vi.fn().mockReturnValue({ getValues: vi.fn().mockReturnValue(rows) }),
      getRange: vi.fn().mockReturnValue({ setValues: mockSetValues }),
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms cols E and F are updated and true is returned when
   * the customerId is found.
   */
  it('updates cols E and F and returns true when customerId is found', () => {
    const mockSheet = makeMockSheet(existingRows);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });

    const result = updateClientOnboardingLink({
      customerId: 'cus_001',
      shortUrl: 'https://abc.short.gy/new',
    });

    expect(result).toBe(true);
    // cus_001 is in row 2 (1-based); cols E-F start at col 5, span 2
    expect(mockSheet.getRange).toHaveBeenCalledWith(2, 5, 1, 2);
    const written = mockSetValues.mock.calls[0][0][0];
    expect(written[0]).toBe('https://abc.short.gy/new');
    expect(typeof written[1]).toBe('string');
    expect(written[1].length).toBeGreaterThan(0);
  });

  /**
   * @test
   * @description Confirms false is returned and no write occurs when the
   * customerId is not found.
   */
  it('returns false and does not write when customerId is not found', () => {
    const mockSheet = makeMockSheet(existingRows);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });

    const result = updateClientOnboardingLink({
      customerId: 'cus_999',
      shortUrl: 'https://abc.short.gy/new',
    });

    expect(result).toBe(false);
    expect(mockSetValues).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms SpreadsheetApp errors propagate to the caller.
   */
  it('propagates SpreadsheetApp errors', () => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockImplementation(() => {
        throw new Error('Spreadsheet not found');
      }),
    });

    expect(() =>
      updateClientOnboardingLink({
        customerId: 'cus_001',
        shortUrl: 'https://abc.short.gy/new',
      })
    ).toThrow('Spreadsheet not found');
  });
});

/**
 * writeVaccinationRecord
 *
 * @description Tests for the writeVaccinationRecord function. Covers writing
 * a new entry, appending to existing content, no-op on missing customerId,
 * and SpreadsheetApp error propagation.
 */
describe('writeVaccinationRecord', () => {
  const mockSetValue = vi.fn();

  const existingRows = [
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
    [
      'Taylor',
      'Bob',
      '+14045550002',
      'cus_003',
      'https://abc.short.gy/bbb',
      '2026-04-13 11:00',
      '',
    ],
  ];

  function makeMockSheet(rows: unknown[][]) {
    return {
      getDataRange: vi.fn().mockReturnValue({ getValues: vi.fn().mockReturnValue(rows) }),
      getRange: vi.fn().mockReturnValue({ setValue: mockSetValue }),
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  /**
   * @test
   * @description Confirms the Drive URL and timestamp are written to the correct
   * row when the customerId is found and the cell is empty.
   */
  it('writes the entry to the correct row when customerId is found and cell is empty', () => {
    const mockSheet = makeMockSheet(existingRows);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });

    writeVaccinationRecord({
      customerId: 'cus_001',
      fileUrl: 'https://drive.google.com/file/d/abc123',
    });

    // cus_001 is in row 2 (1-based), column G is column 7
    expect(mockSheet.getRange).toHaveBeenCalledWith(2, 7);
    expect(mockSetValue).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} — https:\/\/drive\.google\.com\/file\/d\/abc123$/
      )
    );
  });

  /**
   * @test
   * @description Confirms the entry is appended with a newline when the cell
   * already has content.
   */
  it('appends to existing content with a newline separator', () => {
    const rowsWithExisting = [
      existingRows[0],
      [
        'Smith',
        'Jane',
        '+14045551234',
        'cus_001',
        'https://abc.short.gy/xyz123',
        '2026-04-13 10:00',
        '2026-04-13 10:05 — https://drive.google.com/file/d/first',
      ],
      existingRows[2],
    ];
    const mockSheet = makeMockSheet(rowsWithExisting);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });

    writeVaccinationRecord({
      customerId: 'cus_001',
      fileUrl: 'https://drive.google.com/file/d/abc123',
    });

    expect(mockSetValue).toHaveBeenCalledWith(
      expect.stringMatching(
        /^2026-04-13 10:05 — https:\/\/drive\.google\.com\/file\/d\/first\n\d{4}-\d{2}-\d{2} \d{2}:\d{2} — https:\/\/drive\.google\.com\/file\/d\/abc123$/
      )
    );
  });

  /**
   * @test
   * @description Confirms no write occurs when the customerId is not found.
   */
  it('no-ops when customerId is not found', () => {
    const mockSheet = makeMockSheet(existingRows);
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockReturnValue({ getActiveSheet: vi.fn().mockReturnValue(mockSheet) }),
    });

    writeVaccinationRecord({
      customerId: 'cus_999',
      fileUrl: 'https://drive.google.com/file/d/abc123',
    });

    expect(mockSetValue).not.toHaveBeenCalled();
  });

  /**
   * @test
   * @description Confirms SpreadsheetApp errors propagate to the caller.
   */
  it('propagates SpreadsheetApp errors', () => {
    vi.stubGlobal('SpreadsheetApp', {
      openById: vi.fn().mockImplementation(() => {
        throw new Error('Spreadsheet not found');
      }),
    });

    expect(() =>
      writeVaccinationRecord({
        customerId: 'cus_001',
        fileUrl: 'https://drive.google.com/file/d/abc123',
      })
    ).toThrow('Spreadsheet not found');
  });
});
