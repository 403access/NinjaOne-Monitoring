import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(String(err)));
const base = 'http://localhost:3100';
const log = (...a) => console.log(...a);

// Signal modal
await page.goto(base + '/causality?signal=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/signal-modal.png' });
log('signal modal visible', await page.locator('.modal').isVisible());
await page.locator('.modal .field input').first().fill('Stromausfall Test Potsdam');
await page.locator('.modal .field select').first().selectOption('POWER');
await page.waitForTimeout(300);
await page.locator('.modal__footer .btn--primary').click();
await page.waitForTimeout(1200);
log('signal created toast', await page.locator('.toast').first().innerText().catch(()=>'none'));
await page.screenshot({ path: '/tmp/after-signal.png' });

// Bulk task modal
await page.goto(base + '/alerts', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('.alert-row__check').first().check();
await page.waitForTimeout(300);
log('bulk bar', await page.locator('.bulk-bar').isVisible());
await page.locator('.bulk-bar .btn--primary').click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/bulk-modal.png' });
await page.locator('.modal__footer .btn--primary').click();
await page.waitForTimeout(900);
log('bulk toast', await page.locator('.toast').first().innerText().catch(()=>'none'));

// New task modal
await page.goto(base + '/tasks?new=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('.modal .field input').first().fill('Playwright Testaufgabe');
await page.locator('.modal .field textarea').fill('Interaktionstest');
await page.locator('.modal__footer .btn--primary').click();
await page.waitForTimeout(900);
log('new task toast', await page.locator('.toast').first().innerText().catch(()=>'none'));
await page.screenshot({ path: '/tmp/after-task.png' });

// Conditions search + grouping
await page.goto(base + '/conditions', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const before = await page.locator('.condition-row').count();
await page.locator('.toolbar__search input').fill('PACS');
await page.waitForTimeout(400);
const after = await page.locator('.condition-row').count();
log('condition search counts', before, after);
await page.locator('.toolbar__search input').fill('');
await page.locator('.toolbar select').first().selectOption('category');
await page.waitForTimeout(400);
log('flat groups', await page.locator('.flat-group').count());

// Settings live fallback
await page.goto(base + '/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('.mode-option').nth(1).click();
await page.waitForTimeout(1500);
log('stale banner', await page.locator('.stale-banner').isVisible().catch(()=>false));
await page.screenshot({ path: '/tmp/live-fallback.png' });
await page.locator('.mode-option').first().click();
await page.waitForTimeout(1200);

// Mobile alert drawer
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + '/alerts', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('.alert-row').first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/mobile-drawer.png' });

log('ERRORS', errors);
await browser.close();
