import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`PAGE ERROR: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE ERROR: ${m.text()}`); });

function log(label, extra = '') {
  console.log(`\n=== ${label} === url:${page.url()} ${extra}`);
}

async function bodyText() {
  return (await page.textContent('body')).replace(/\s+/g, ' ').slice(0, 500);
}

// 1. HOME
await page.goto('http://localhost:5174');
await page.waitForLoadState('networkidle');
log('HOME');
console.log(await bodyText());

// 2. → /new
await page.click('text=Start a session');
await page.waitForURL('**/new');
log('NEW SESSION');
console.log(await bodyText());

// 3. Pick Squat (tile button with label "squat")
await page.locator('.tile', { hasText: 'Squat' }).first().click();
await page.waitForURL('**/setup/**');
log('LIFT SETUP');
console.log(await bodyText());

// 4. Set load to 80 kg
const loadInput = page.locator('input[type="number"]').last();
await loadInput.fill('80');
await page.waitForTimeout(200);

// 5. Start set → /record
await page.click('text=Start set');
await page.waitForURL('**/record');
log('RECORD SET (idle)');
console.log(await bodyText());

// 6. Start recording (simulated analyzer kicks in)
await page.click('text=Start recording');
log('RECORDING STARTED');
await page.waitForTimeout(500);
console.log(await bodyText());

// 7. Wait for reps to appear (simulated, ~2.4s each, 5 reps)
console.log('\n--- waiting for reps (up to 20s) ---');
await page.waitForSelector('.rep-line', { timeout: 20000 });
console.log('First rep appeared.');

// Wait for set to auto-stop or manually stop after 10s
const stopped = await Promise.race([
  page.waitForSelector('text=End set', { state: 'hidden', timeout: 15000 }).then(() => 'auto-stopped'),
  page.waitForTimeout(12000).then(() => 'timeout'),
]);
console.log('Set result:', stopped);

if (stopped === 'timeout') {
  await page.click('text=End set').catch(() => {});
}

// 8. Post-set
await page.waitForURL('**/post-set', { timeout: 5000 }).catch(() => {});
log('POST SET');
console.log(await bodyText());

// 9. Navigate to History
await page.click('text=History');
await page.waitForURL('**/history');
log('HISTORY');
console.log(await bodyText());

// 10. Navigate to Charts
await page.click('text=Charts');
await page.waitForURL('**/charts');
log('CHARTS');
console.log(await bodyText());

await browser.close();

if (errors.length) {
  console.log('\n--- ERRORS ---');
  errors.forEach((e) => console.log(e));
  process.exit(1);
} else {
  console.log('\nAll smoke checks passed, no console errors.');
}
