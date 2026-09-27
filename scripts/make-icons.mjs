// Renders PNG icons + iOS splash screens from the SVG art using Playwright's Chromium.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { iconSvg } from './icon-art.mjs';

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('icons/favicon.svg', out), iconSvg({ size: 64, rounded: true }));

const browser = await chromium.launch();
const page = await browser.newPage();
async function shot(html, w, h, file) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.screenshot({ path: new URL(file, out).pathname, omitBackground: false });
  console.log('wrote', file);
}
await shot(iconSvg({ size: 192 }), 192, 192, 'icons/icon-192.png');
await shot(iconSvg({ size: 512 }), 512, 512, 'icons/icon-512.png');
await shot(iconSvg({ size: 512, pad: 0.22 }), 512, 512, 'icons/maskable-512.png');
await shot(iconSvg({ size: 180 }), 180, 180, 'icons/apple-touch-icon.png');

for (const [w, h] of [[1170, 2532], [1179, 2556], [1284, 2778]]) {
  const html = `<div style="width:${w}px;height:${h}px;background:#F7F3EC;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif">
    <div style="width:${w * 0.42}px;height:${w * 0.42}px;border-radius:${w * 0.1}px;overflow:hidden">${iconSvg({ size: w * 0.42 })}</div>
    <div style="margin-top:${w * 0.06}px;font-size:${w * 0.07}px;font-weight:600;color:#2F3A34">My Day</div></div>`;
  await shot(html, w, h, `splash/iphone-${w}x${h}.png`);
}
await browser.close();
