import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', msg => { 
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

await page.goto('http://localhost:3000/works/12', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);
const workContent = await page.textContent('body');
await page.screenshot({ path: '/tmp/work12-hydrated.png', fullPage: true });
console.log('Work page text (first 800):', workContent?.slice(0, 800));
console.log('Errors:', JSON.stringify(errors));

await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/landing-hydrated.png', fullPage: true });

await browser.close();

// Already run, do remaining pages
import { chromium } from 'playwright';
const browser2 = await chromium.launch({ args: ['--no-sandbox'] });
const p2 = await browser2.newPage();

await p2.goto('http://localhost:3000/upload', { waitUntil: 'networkidle', timeout: 20000 });
await p2.waitForTimeout(2000);
await p2.screenshot({ path: '/tmp/upload.png', fullPage: true });

await p2.goto('http://localhost:3000/verify', { waitUntil: 'networkidle', timeout: 20000 });
await p2.waitForTimeout(2000);
await p2.screenshot({ path: '/tmp/verify.png', fullPage: true });

await p2.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 20000 });
await p2.waitForTimeout(2000);
await p2.screenshot({ path: '/tmp/dashboard.png', fullPage: true });

await browser2.close();
console.log('remaining pages done');
