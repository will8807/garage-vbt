import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 14
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function shot(name, url, extra) {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (extra) await extra(page);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
}

await shot('01-home', 'http://localhost:5173/');
await shot('02-new-session', 'http://localhost:5173/new');
await shot('03-lift-setup-squat', 'http://localhost:5173/setup/squat');
await shot('04-lift-setup-dropoff', 'http://localhost:5173/setup/bench', async (p) => {
  await p.getByText('Drop-off').click();
});
await shot('05-history', 'http://localhost:5173/history');
await shot('06-charts', 'http://localhost:5173/charts');
await shot('07-settings', 'http://localhost:5173/settings');

await browser.close();
console.log('Done.');
