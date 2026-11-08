import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const base = 'http://localhost:3100';
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(String(err)));
async function shot(path, file) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `docs/screenshots/${file}`, fullPage: false });
  console.log(file);
}
await shot('/', 'dashboard-dark.png');
await shot('/conditions', 'conditions.png');
await shot('/alerts', 'alerts.png');
await shot('/causality', 'causality.png');
await shot('/tasks', 'tasks.png');
await shot('/devices', 'devices.png');
await shot('/settings', 'settings.png');
// Light dashboard
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.locator('.topbar__right .icon-btn').last().click();
await page.waitForTimeout(700);
await page.screenshot({ path: 'docs/screenshots/dashboard-light.png', fullPage: false });
// restore dark via API
await page.request.patch(base + '/api/settings', { data: { theme: 'dark' } });
// Mobile
await page.setViewportSize({ width: 390, height: 844 });
await shot('/alerts', 'mobile-alerts.png');
console.log('ERRORS', errors);
await browser.close();
