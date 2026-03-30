/**
 * Google Sheets Client
 *
 * @module
 * @description Appends rows to a configured Google Sheet via SpreadsheetApp.
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
 * Append a client onboarding row to the configured Google Sheet.
 *
 * @function writeClientRow
 * @description Assembles a row from client metadata, the shortened token URL,
 * and an optional Drive file link, then appends it via appendSheetRow.
 *
 * @param {object} params - The row parameters.
 * @param {MoeGoCustomer} params.customer - The client's MoeGo customer record.
 * @param {string} params.shortUrl - The shortened token URL to forward to the client.
 * @param {string} [params.driveFileUrl] - URL of the uploaded vaccination record in Drive.
 * @throws {Error} If the sheet write fails.
 */
export function writeClientRow({
  customer,
  shortUrl,
  driveFileUrl = '',
}: {
  customer: MoeGoCustomer;
  shortUrl: string;
  driveFileUrl?: string;
}): void {
  appendSheetRow([customer.firstName, customer.lastName, customer.phone, shortUrl, driveFileUrl]);
}
