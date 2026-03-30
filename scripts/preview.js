/**
 * Preview script — substitutes GAS scriptlets with real values so templates
 * can be opened directly in a browser without deploying to GAS.
 *
 * Usage: node scripts/preview.js [landing|error]
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const template = process.argv[2] ?? 'landing';
const validTemplates = ['landing', 'error'];

if (!validTemplates.includes(template)) {
  console.error(`Usage: node scripts/preview.js [${validTemplates.join('|')}]`);
  process.exit(1);
}

const styles = readFileSync(`src/templates/styles.html`, 'utf8');
const html = readFileSync(`src/templates/${template}.html`, 'utf8');

// Per-client values injected into the landing page via the token payload
const dummyPayload = {
  serviceAgreementUrl: 'https://example.com/service-agreement',
  smsAgreementUrl: 'https://example.com/sms-agreement',
  cofUrl: 'https://example.com/card-on-file',
};

// Business-level values injected from config — not per-client
const dummyVars = {
  businessName: 'Zoomin Groomin - Decatur',
  businessPhone: '555-555-5555',
  businessLogoUrl:
    'https://thumbnail.moego.pet/moegonew/Public/Uploads/128xAUTO/173888807808adcf4aab76434f9b930a9ce8498cfc.jpeg',
};

const rendered = html
  // Inline the shared stylesheet in place of the HtmlService include scriptlet
  .replace(`<?!= HtmlService.createHtmlOutputFromFile('styles').getContent() ?>`, styles)
  // Substitute top-level template variables (businessName, businessPhone, businessLogoUrl)
  .replace(/<\?=\s*(\w+)\s*\?>/g, (_, key) => dummyVars[key] ?? '')
  // Substitute payload variables (serviceAgreementUrl, smsAgreementUrl, cofUrl)
  .replace(/<\?=\s*payload\.(\w+)\s*\?>/g, (_, key) => dummyPayload[key] ?? '');

const outPath = `/tmp/preview-${template}.html`;
writeFileSync(outPath, rendered);

console.log(`Wrote ${outPath}`);
execSync(`open ${outPath}`);
