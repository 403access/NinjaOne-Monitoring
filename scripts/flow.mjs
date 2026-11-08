import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(String(err)));
const base = 'http://localhost:3100';
async function shot(path, out, action) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (action) await action();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out, fullPage: false });
  console.log('shot', out);
}
await shot('/alerts', '/tmp/alert-drawer.png', async () => { await page.locator('.alert-row').first().click(); await page.waitForTimeout(500); });
await shot('/conditions', '/tmp/condition-drawer.png', async () => { await page.locator('.condition-row').first().click(); await page.waitForTimeout(500); });
await shot('/causality?tab=suppressed', '/tmp/causality-suppressed.png');
await shot('/causality?tab=rules', '/tmp/causality-rules.png');
await shot('/tasks', '/tmp/task-drawer.png', async () => { await page.locator('.task-card').first().click(); await page.waitForTimeout(500); });
await shot('/devices', '/tmp/device-drawer.png', async () => { await page.locator('.data-table tbody tr').first().click(); await page.waitForTimeout(500); });
await shot('/', '/tmp/command.png', async () => { await page.keyboard.press('Meta+k'); await page.waitForTimeout(500); });
await shot('/', '/tmp/light.png', async () => { await page.locator('.topbar__right .icon-btn').last().click(); await page.waitForTimeout(700); });
await page.setViewportSize({ width: 390, height: 844 });
await shot('/', '/tmp/mobile-dashboard.png');
await shot('/alerts', '/tmp/mobile-alerts.png');
await shot('/causality', '/tmp/mobile-causality.png');
console.log('ERRORS', errors);
await browser.close();
