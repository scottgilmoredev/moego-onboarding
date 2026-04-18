/* eslint-disable no-console */

/**
 * Google Sheets Client
 *
 * @module
 * @description Reads from and writes to a configured Google Sheet via SpreadsheetApp.
 */

import type { MoeGoCustomer } from '#/types/moego.js';
import { getConfig } from '#/utils/config.js';

type SheetCellValue = string | number | boolean;

/**
 * Append a row to the configured Google Sheet.
 *
 * @function appendSheetRow
 * @description Opens the configured spreadsheet and appends the provided
 * values as a new row to the active sheet. Throws on any SpreadsheetApp
 * or write failure.
 *
 * @param {SheetCellValue[]} values - The cell values to append, in column order.
 * @throws {Error} If the spreadsheet cannot be opened or the row cannot be written.
 */
export function appendSheetRow(values: SheetCellValue[]): void {
  const { spreadsheetId } = getConfig();
  const sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();

  sheet.appendRow(values);
}

/**
 * Format a timestamp as a human-readable string for sheet display.
 *
 * @function formatTimestamp
 * @description Returns an Eastern time timestamp string in `YYYY-MM-DD HH:MM` format.
 *
 * @param {number} ms - Unix timestamp in milliseconds.
 * @returns {string} Formatted timestamp string.
 */
export function formatTimestamp(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

/**
 * Write a vaccination record entry to the client's sheet row.
 *
 * @function writeVaccinationRecord
 * @description Finds the client's row by customerId (column D), then appends
 * a timestamped Drive file URL to the Vaccination Records column (column G).
 * If the cell already has content, the new entry is appended with a newline
 * separator. No-ops if the customerId is not found.
 *
 * @param {object} params - The parameters.
 * @param {string} params.customerId - The client's MoeGo customer ID.
 * @param {string} params.fileUrl - The Google Drive URL of the uploaded file.
 */
export function writeVaccinationRecord({
  customerId,
  fileUrl,
}: {
  customerId: string;
  fileUrl: string;
}): void {
  const { spreadsheetId } = getConfig();
  const sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
  const allRows = sheet.getDataRange().getValues() as string[][];

  // Find the row index (1-based) where column D matches customerId, skipping header
  const rowIndex = allRows.findIndex((r, i) => i > 0 && r[3] === customerId);

  if (rowIndex === -1) {
    console.log(`writeVaccinationRecord: customerId ${customerId} not found in sheet — skipping`);
    return;
  }

  const entry = `${formatTimestamp(Date.now())} — ${fileUrl}`;
  const existing = allRows[rowIndex][6];
  const updated = existing ? `${existing}\n${entry}` : entry;

  // Column G is column 7 (1-based), rowIndex is 0-based so add 1
  sheet.getRange(rowIndex + 1, 7).setValue(updated);
}

/**
 * Update the onboarding link and sent-at timestamp for an existing client row.
 *
 * @function updateClientOnboardingLink
 * @description Finds the client's row by customerId (column D) and overwrites
 * the Onboarding Link (column E) and Sent At (column F) with the new values.
 * Returns true if the row was found and updated, false if the customerId is not
 * present in the sheet.
 *
 * @param {object} params - The parameters.
 * @param {string} params.customerId - The client's MoeGo customer ID.
 * @param {string} params.shortUrl - The new shortened onboarding URL.
 * @returns {boolean} True if the row was found and updated, false otherwise.
 */
export function updateClientOnboardingLink({
  customerId,
  shortUrl,
}: {
  customerId: string;
  shortUrl: string;
}): boolean {
  const { spreadsheetId } = getConfig();
  const sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
  const allRows = sheet.getDataRange().getValues() as string[][];

  // Find the row index (0-based) where column D matches customerId, skipping header
  const rowIndex = allRows.findIndex((r, i) => i > 0 && r[3] === customerId);

  if (rowIndex === -1) {
    return false;
  }

  const sentAt = formatTimestamp(Date.now());

  // Columns E-F are cols 5-6 (1-based); rowIndex is 0-based so add 1
  sheet.getRange(rowIndex + 1, 5, 1, 2).setValues([[shortUrl, sentAt]]);

  return true;
}

/**
 * Write a client onboarding row to the configured Google Sheet.
 *
 * @function writeClientRow
 * @description Assembles a row from client metadata, the shortened token URL,
 * and a sentAt timestamp, then inserts it as the first data row (row 2),
 * pushing existing rows down so the most recent entries appear at the top.
 *
 * @param {object} params - The row parameters.
 * @param {MoeGoCustomer} params.customer - The client's MoeGo customer record.
 * @param {string} params.shortUrl - The shortened token URL to forward to the client.
 * @throws {Error} If the sheet write fails.
 */
export function writeClientRow({
  customer,
  shortUrl,
}: {
  customer: MoeGoCustomer;
  shortUrl: string;
}): void {
  const { spreadsheetId } = getConfig();
  const sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();

  const sentAt = formatTimestamp(Date.now());
  const row: SheetCellValue[] = [
    customer.lastName,
    customer.firstName,
    customer.phone,
    customer.id,
    shortUrl,
    sentAt,
    '',
  ];

  // Insert as the first data row; if only the header exists, append instead
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    sheet.appendRow(row);
  } else {
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, row.length).setValues([row]);
  }
}
