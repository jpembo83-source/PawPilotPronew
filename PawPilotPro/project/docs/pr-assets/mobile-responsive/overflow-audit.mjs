// Visits staff-app routes at 390px and reports any page wider than the
// viewport, plus the elements that stick out past the right edge.
import { chromium } from '@playwright/test';
const { setup } = await import('./.audit-setup.mjs');
const ROUTES = ['/', '/daycare', '/daycare/check-in', '/daycare/check-out', '/daycare/attendance',
  '/daycare/bookings', '/customers', '/customers/hh-1', '/customers/pets/pet-1',
  '/incidents', '/capacity', '/settings'];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await setup(ctx);
for (const route of ROUTES) {
  await page.goto(`http://localhost:5173${route}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const result = await page.evaluate(() => {
    const crashed = !!document.body.textContent?.includes('Something went wrong');
    const vw = window.innerWidth;
    // Any container whose content is wider than itself can horizontally
    // scroll or clip on a phone. Report the ROOTS only, and skip opt-in
    // horizontal scrollers (explicit overflow-x-auto utility = intentional).
    const roots = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
        const cls = typeof el.className === 'string' ? el.className : '';
        if (cls.includes('overflow-x-auto') || cls.includes('scrollbar-hide')) continue;
        if (roots.some((r) => r.el.contains(el))) continue;
        roots.push({ el, tag: el.tagName.toLowerCase(), cls: cls.slice(0, 110), sw: el.scrollWidth, cw: el.clientWidth });
      }
    }
    return {
      crashed,
      viewport: vw,
      offenders: roots.slice(0, 8).map(({ tag, cls, sw, cw }) => ({ tag, cls, sw, cw })),
    };
  });
  const status = result.crashed ? 'CRASH(fixture)' : result.offenders.length ? `OVERFLOW x${result.offenders.length}` : 'ok';
  console.log(`\n${route}: ${status}`);
  for (const o of result.offenders) console.log(`   <${o.tag}> content=${o.sw}px box=${o.cw}px class="${o.cls}"`);
}
await browser.close();
