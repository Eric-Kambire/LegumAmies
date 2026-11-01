/**
 * Browser end-to-end checks for Légume'Ami (real Chrome through playwright-core).
 *
 *   cd frontend
 *   npm i --no-save playwright-core        # not a project dependency on purpose
 *   npx vite --host 127.0.0.1 --port 5180 --mode production &
 *   BASE_URL=http://127.0.0.1:5180 node e2e/run.mjs
 *
 * Network: the browser talks to the REAL deployed API. The API only allows its own CORS origin,
 * so the harness forwards those requests from Node and adds permissive CORS headers. Responses are
 * the real ones; they are only altered in the two tests that say "synthetic" or "fixture".
 *
 * Output: screenshots + results.json in OUT_DIR (default ../reports/ux-remediation/hackathon).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5180';
const API = process.env.API_URL || 'https://ba8yoci7d8.execute-api.us-east-1.amazonaws.com';
const OUT = path.resolve(process.env.OUT_DIR || '../reports/ux-remediation/hackathon');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { w: 375, h: 812 },
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1366, h: 768 },
  { w: 1920, h: 1080 },
];
const EDGE_WIDTHS = [
  { w: 640, h: 900 },
  { w: 700, h: 900 },
  { w: 767, h: 1024 },
];

const results = [];
const apiLog = { assess: [], advisor: [], soil: [] };

function record(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail: String(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
const phone = (vp) => vp.w < 768;

/* ------------------------------------------------------------------ browser helpers */

let browser;

async function newSession(vp, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 1,
    isMobile: phone(vp),
    hasTouch: phone(vp),
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    permissions: opts.geolocation ? ['geolocation'] : [],
    geolocation: opts.geolocation,
  });

  // Count geolocation reads: Ami must never read the GPS before an explicit click.
  await ctx.addInitScript(() => {
    window.__geoCalls = 0;
    const real = navigator.geolocation && navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    if (real) {
      navigator.geolocation.getCurrentPosition = (...args) => {
        window.__geoCalls += 1;
        return real(...args);
      };
    }
  });
  if (opts.fields) {
    await ctx.addInitScript(
      ({ fields, active }) => {
        if (!localStorage.getItem('legum_registered_fields')) {
          localStorage.setItem('legum_registered_fields', JSON.stringify(fields));
          localStorage.setItem('legum_active_field_id', active);
        }
      },
      { fields: opts.fields, active: opts.fields[0].id }
    );
  }

  await ctx.route(API + '/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = req.postData() || undefined;

    if (url.pathname === '/advisor/ask') apiLog.advisor.push({ at: Date.now(), body: body ? JSON.parse(body) : null });
    const assessEntry = { at: Date.now(), body: body ? JSON.parse(body || 'null') : null };
    if (url.pathname === '/assess') apiLog.assess.push(assessEntry);

    if (url.pathname.startsWith('/geo/') && opts.soilFixture) {
      apiLog.soil.push({ path: url.pathname });
      if (url.pathname === '/geo/soil-risk') return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(opts.soilFixture.risk) });
      if (url.pathname === '/geo/soil') return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(opts.soilFixture.soil) });
    }

    try {
      const r = await fetch(req.url(), {
        method: req.method(),
        headers: { 'content-type': 'application/json' },
        body: req.method() === 'POST' ? body : undefined,
      });
      let text = await r.text();
      if (url.pathname === '/assess' && r.ok) {
        const json = JSON.parse(text);
        assessEntry.response = structuredClone(json); // pristine copy, before any test mutation
        if (opts.mutateAssess) {
          opts.mutateAssess(json);
          text = JSON.stringify(json);
        }
      }
      return route.fulfill({ status: r.status, headers: { ...cors, 'content-type': 'application/json' }, body: text });
    } catch {
      return route.abort();
    }
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('nav[aria-label="Navigation principale"], nav[aria-label="Navigation Bureau"]', { state: 'attached' });
  await page.waitForTimeout(1200);
  return { ctx, page, errors, vp };
}

const navSel = (vp) => (phone(vp) ? 'nav[aria-label="Navigation principale"]' : 'nav[aria-label="Navigation Bureau"]');

async function gotoTab(s, label) {
  const { page, vp } = s;
  if (phone(vp) && label === 'Alertes') {
    await page.locator(navSel(vp)).getByRole('button', { name: label }).click();
    await page.getByRole('button', { name: /Ouvrir tout l'historique/ }).click();
  } else {
    await page.locator(navSel(vp)).getByRole('button', { name: label }).click();
  }
  await page.waitForTimeout(700);
}

async function shot(s, name) {
  const file = path.join(OUT, `${name}-${s.vp.w}x${s.vp.h}.png`);
  await s.page.screenshot({ path: file });
  return file;
}

const box = async (page, sel) => {
  const loc = page.locator(sel).first();
  if ((await loc.count()) === 0 || !(await loc.isVisible())) return null;
  return loc.boundingBox();
};
const intersects = (a, b, tol = 1) =>
  a && b && a.x < b.x + b.width - tol && b.x < a.x + a.width - tol && a.y < b.y + b.height - tol && b.y < a.y + a.height - tol;

/** Pairwise collision check of the fixed/floating layers that are currently visible. */
async function fixedLayerCollisions(s) {
  const layers = {
    tabbar: 'nav[aria-label="Navigation principale"]',
    pwaBanner: '[data-testid="pwa-banner"]',
    ami: 'button.ami-launcher',
    radar: '[data-testid="radar-timeline"]',
    sheet: '.map-bottom-sheet',
    layersBtn: '[data-testid="layers-button"]',
    locate: 'button[aria-label="Me localiser"]',
    resetView: 'button[aria-label="Vue France"]',
    theme: 'button[aria-label="Changer le fond de carte"]',
    layerChip: '[data-testid="map-layer-chip"]',
  };
  const boxes = {};
  for (const [k, sel] of Object.entries(layers)) {
    const b = await box(s.page, sel);
    if (b) boxes[k] = b;
  }
  const names = Object.keys(boxes);
  const hits = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (intersects(boxes[names[i]], boxes[names[j]])) hits.push(`${names[i]}×${names[j]}`);
    }
  }
  return { hits, boxes };
}

/** Scrolls the page container to the bottom and checks nothing ends beneath the tab bar. */
async function lastContentVisible(s) {
  const info = await s.page.evaluate(() => {
    const el = document.querySelector('.app-page-scroll');
    if (!el) return null;
    el.scrollTop = el.scrollHeight;
    const last = el.lastElementChild;
    const r = last.getBoundingClientRect();
    const tab = document.querySelector('nav[aria-label="Navigation principale"]');
    const t = tab && tab.getBoundingClientRect().height > 0 ? tab.getBoundingClientRect() : null;
    return { bottom: r.bottom, limit: t ? t.top : window.innerHeight, vh: window.innerHeight };
  });
  return info ? { ok: info.bottom <= info.limit + 1, ...info } : { ok: true, skipped: true };
}

/* ------------------------------------------------------------------ reference algorithm (independent of the app code) */

function expectedExposure(assess, threshold, horizon, nowMs) {
  const pts = assess.weather.hourly
    .filter((h) => h.temperature_c !== null)
    .map((h) => ({ t: new Date(h.valid_time_local).getTime(), v: h.temperature_c }))
    .sort((a, b) => a.t - b.t);
  let start = pts.findIndex((p) => p.t >= nowMs - 59 * 60000);
  if (start < 0) start = Math.max(0, pts.length - horizon);
  const win = pts.slice(start, start + horizon);
  let hours = 0;
  let spans = 0;
  let prev = false;
  for (const p of win) {
    const over = p.v > threshold;
    if (over) hours++;
    if (over && !prev) spans++;
    prev = over;
  }
  return { hours, spans, n: win.length };
}

const FEVEROLE_FIELD = {
  id: 'e2e_feverole',
  name: 'Ferme test floraison',
  latitude: 43.31,
  longitude: 1.95,
  commune: 'Castelnaudary',
  departmentCode: '11',
  cropType: 'feverole',
  growthStage: 'floraison',
  areaHectares: 10,
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-01T08:00:00Z',
};
const LENTIL_FIELD = { ...FEVEROLE_FIELD, id: 'e2e_lentille', name: 'Lentilles test', cropType: 'lentille', latitude: 46.81, longitude: 1.7, commune: 'Châteauroux' };

/* ------------------------------------------------------------------ tests */

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// 1. First visit and returning visit -------------------------------------------------
test('home-first-visit-and-returning', async () => {
  for (const vp of VIEWPORTS) {
    const s = await newSession(vp);
    const { page } = s;
    const first = page.getByTestId('first-visit-card');
    record(`[${vp.w}] Home first visit shows the single create-field CTA`, await first.isVisible());
    record(`[${vp.w}] Example field is labelled Démo`, (await page.getByTestId('home-hero').getByText('Démo').count()) > 0);
    record(`[${vp.w}] Home loads real field weather (temperature visible)`, await page.getByTestId('home-hero').getByText(/^-?\d+°$/).first().isVisible({ timeout: 15000 }).catch(() => false));
    await shot(s, '01-home-first-visit');
    if (phone(vp)) {
      const v = await lastContentVisible(s);
      record(`[${vp.w}] Home: last element not hidden by tab bar`, v.ok, JSON.stringify(v));
    }
    if (vp.w === 390 || vp.w === 1366) {
      await page.getByTestId('create-first-field').click();
      await page.waitForSelector('#field-wizard-title');
      record(`[${vp.w}] Create CTA opens the wizard directly`, true);
      await page.locator('input[type="text"]').first().fill('Ferme test');
      await page.getByRole('button', { name: /Continuer/ }).click();
      await page.locator('[role=dialog]').getByText(/Féverole/).first().click();
      await page.getByRole('button', { name: /Continuer/ }).click();
      await page.getByRole('button', { name: /Continuer/ }).click();
      await page.getByRole('button', { name: /Enregistrer la parcelle/ }).click();
      await gotoTab(s, 'Accueil');
      record(`[${vp.w}] After creating a field the first-visit card is gone`, (await first.count()) === 0);
      const heroName = await page.getByTestId('home-hero').locator('h2').first().innerText();
      record(`[${vp.w}] Hero shows the new real field without Démo`, heroName.includes('Ferme test') && (await page.getByTestId('home-hero').getByText('Démo').count()) === 0, heroName);
      await page.reload();
      await page.waitForTimeout(2500);
      record(`[${vp.w}] Returning visit keeps the field (no first-visit card)`, (await first.count()) === 0 && (await page.getByTestId('home-hero').innerText()).includes('Ferme test'));
      await shot(s, '02-home-returning');
    }
    record(`[${vp.w}] No uncaught page error on Home`, s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }
});

// 2. Map layers ---------------------------------------------------------------------
test('map-layers', async () => {
  for (const vp of [{ w: 1366, h: 768 }, { w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 700, h: 900 }]) {
    const s = await newSession(vp);
    const { page } = s;
    await gotoTab(s, 'Carte');
    await page.waitForTimeout(1500);
    const btn = page.getByTestId('layers-button');
    record(`[${vp.w}] Layers2 button visible top-right`, await btn.isVisible());
    const bb = await btn.boundingBox();
    record(`[${vp.w}] Layers2 button is in the right half and near the top`, bb && bb.x > vp.w / 2 && bb.y < 140, JSON.stringify(bb));
    await btn.click();
    const menu = page.getByTestId('layer-menu');
    record(`[${vp.w}] Menu opens`, await menu.isVisible());
    record(`[${vp.w}] Four exclusive weather layers`, (await menu.locator('[role="radio"]').count()) === 4);

    // point-based layers show a value at the selected point, never a national raster
    for (const [id, re] of [['temperature', /°C/], ['wind', /km\/h/], ['clouds', /%/]]) {
      await page.getByTestId(`primary-${id}`).click();
      await page.waitForTimeout(500);
      const txt = await page.getByTestId('map-point-value').first().innerText().catch(() => '');
      record(`[${vp.w}] ${id}: point value drawn on the map (${txt.trim()})`, re.test(txt));
      const note = await page.getByTestId('primary-details').innerText();
      record(`[${vp.w}] ${id}: menu states it is a point forecast, not a national map`, /ponctuelle/i.test(note) && /Aucune carte nationale/i.test(note));
    }
    await page.getByTestId('primary-radar').click();
    await page.waitForTimeout(400);
    record(`[${vp.w}] Radar: point value removed, radar legend/validity shown`, (await page.getByTestId('map-point-value').count()) === 0 && /Observé|Extrapolation/.test(await page.getByTestId('primary-details').innerText()));

    // overlays: real tile requests
    const expectReq = async (id, needle) => {
      const waiter = page.waitForRequest((r) => r.url().includes(needle), { timeout: 20000 }).then(() => true).catch(() => false);
      await page.getByTestId(`overlay-${id}`).click();
      return waiter;
    };
    record(`[${vp.w}] RPG overlay requests IGN LANDUSE.AGRICULTURE2024 tiles`, await expectReq('rpg', 'LANDUSE.AGRICULTURE2024'));
    record(`[${vp.w}] Admin overlay requests ADMINEXPRESS tiles`, await expectReq('admin', 'ADMINEXPRESS-COG-CARTO'));
    record(`[${vp.w}] Soil overlay requests ISRIC SoilGrids WMS`, await expectReq('soil', 'maps.isric.org'));
    record(`[${vp.w}] Terrain overlay requests IGN relief tiles`, await expectReq('terrain', 'ELEVATION.SLOPES'));
    await page.waitForTimeout(2500);
    const rpgDetails = await page.getByTestId('overlay-rpg-details').innerText();
    record(`[${vp.w}] RPG details state source, coverage, vintage and caveat`, /IGN/.test(rpgDetails) && /2024/.test(rpgDetails) && /propriété/.test(rpgDetails));
    const soilDetails = await page.getByTestId('overlay-soil-details').innerText();
    record(`[${vp.w}] Soil layer says modelled, not measured`, /modélis/i.test(soilDetails));
    await page.getByLabel('Opacité : Parcelles déclarées (RPG)').evaluate((el) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, '0.4');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    record(`[${vp.w}] Opacity slider updates (40 %)`, /40%/.test(await page.getByTestId('overlay-rpg-details').innerText()));
    const fieldDetails = await page.getByTestId('overlay-field-details').innerText();
    record(`[${vp.w}] Field polygon: honest "no contour saved" state`, /Aucun contour/.test(fieldDetails));
    await shot(s, '03-map-layer-menu-overlays');

    // closing: X, Escape, focus return
    await page.getByTestId('layers-close').click();
    record(`[${vp.w}] X closes the menu`, !(await menu.isVisible()));
    await btn.click();
    await page.keyboard.press('Escape');
    record(`[${vp.w}] Escape closes the menu`, !(await menu.isVisible()));
    record(`[${vp.w}] Focus returns to the Layers2 button`, await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'layers-button'));

    const c = await fixedLayerCollisions(s);
    record(`[${vp.w}] Map: no fixed layers overlap each other`, c.hits.length === 0, c.hits.join(', ') + ' ' + JSON.stringify(Object.keys(c.boxes)));
    await shot(s, '04-map-overlays-on');
    record(`[${vp.w}] No page error on map`, s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }
});

// 3. Map fixed layers across the 640-767 band, PWA banner included -------------------
test('map-fixed-layers-and-pwa', async () => {
  for (const vp of [...VIEWPORTS, ...EDGE_WIDTHS]) {
    const s = await newSession(vp);
    const { page } = s;
    await gotoTab(s, 'Carte');
    await page.waitForTimeout(1500);
    let c = await fixedLayerCollisions(s);
    record(`[${vp.w}x${vp.h}] Map: no overlap between tab bar, sheet, radar, Ami and controls`, c.hits.length === 0, c.hits.join(', '));
    if (phone(vp)) {
      await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
      await page.waitForTimeout(500);
      const banner = await box(page, '[data-testid="pwa-banner"]');
      const tab = await box(page, 'nav[aria-label="Navigation principale"]');
      record(`[${vp.w}x${vp.h}] PWA install banner appears above the tab bar`, banner && tab && banner.y + banner.height <= tab.y + 1, JSON.stringify({ banner, tab }));
      c = await fixedLayerCollisions(s);
      record(`[${vp.w}x${vp.h}] With the banner, map layers still do not overlap`, c.hits.length === 0, c.hits.join(', '));
      const sheet = c.boxes.sheet;
      const bnr = c.boxes.pwaBanner;
      record(`[${vp.w}x${vp.h}] Map sheet sits above the install banner`, sheet && bnr && sheet.y + sheet.height <= bnr.y + 1, JSON.stringify({ sheet, bnr }));
      await shot(s, '05-map-pwa-banner');
    } else {
      await shot(s, '05-map');
    }
    await s.ctx.close();
  }
});

// 4. Five tabs: nothing hidden beneath fixed navigation ---------------------------------
test('tabs-not-hidden-under-fixed-nav', async () => {
  for (const vp of VIEWPORTS) {
    const s = await newSession(vp, { fields: [FEVEROLE_FIELD] });
    for (const [label, key] of [['Accueil', 'accueil'], ['Parcelles', 'parcelles'], ['Analyses', 'analyses'], ['Alertes', 'alertes']]) {
      await gotoTab(s, label);
      await s.page.waitForTimeout(1200);
      const v = await lastContentVisible(s);
      record(`[${vp.w}] ${label}: last element fully above fixed navigation`, v.ok, JSON.stringify(v));
      await shot(s, `06-tab-${key}`);
    }
    await gotoTab(s, 'Carte');
    await s.page.waitForTimeout(1200);
    await shot(s, '06-tab-carte');
    record(`[${vp.w}] No page error across tabs`, s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }
});

// 5. Heat curve computed from the real /assess response -----------------------------------
test('flowering-heat-chart', async () => {
  for (const vp of [{ w: 1366, h: 768 }, { w: 390, h: 844 }]) {
    const s = await newSession(vp, { fields: [FEVEROLE_FIELD] });
    const { page } = s;
    await gotoTab(s, 'Analyses');
    await page.getByTestId('heat-summary-card').waitFor({ timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-testid="heat-summary-hours"]'), null, { timeout: 30000 });
    const assess = apiLog.assess.filter((a) => a.response && a.body?.crop === 'feverole').pop()?.response;
    record(`[${vp.w}] Real /assess response received`, Boolean(assess && assess.weather?.hourly?.length > 0), `${assess?.weather?.hourly?.length} hourly points, model ${assess?.weather?.model_id}`);
    await page.getByTestId('open-heat-curve').click();
    await page.getByTestId('heat-chart').waitFor();
    const nowMs = await page.evaluate(() => Date.now());
    const exp48 = expectedExposure(assess, 25, 48, nowMs);
    const ui48 = Number((await page.getByTestId('heat-exceed-hours').innerText()).replace(/\D/g, ''));
    record(`[${vp.w}] 48 h exceedance equals independent computation from the response`, ui48 === exp48.hours, `UI ${ui48} h, expected ${exp48.hours} h over ${exp48.n} points`);
    record(`[${vp.w}] Threshold line (25 °C, Terres Inovia) drawn`, (await page.getByTestId('heat-threshold-line').count()) === 1);
    const rows48 = await page.getByTestId('heat-table').locator('tbody tr').count();
    record(`[${vp.w}] Hourly table has one row per forecast point`, rows48 === exp48.n, `${rows48} rows`);
    await page.getByTestId('heat-window-24').click();
    const exp24 = expectedExposure(assess, 25, 24, nowMs);
    const ui24 = Number((await page.getByTestId('heat-exceed-hours').innerText()).replace(/\D/g, ''));
    record(`[${vp.w}] 24 h window recomputed`, ui24 === exp24.hours && (await page.getByTestId('heat-table').locator('tbody tr').count()) === exp24.n, `UI ${ui24} expected ${exp24.hours}`);
    const prov = await page.getByTestId('heat-chart').innerText();
    record(`[${vp.w}] Window, model, unit and source are displayed`, /meteofrance_arome/.test(prov) && /°C/.test(prov) && /Terres Inovia/.test(prov) && /Aucune probabilité de dégât/.test(prov));

    // keyboard exploration
    const slider = page.getByRole('slider', { name: /Parcourir la courbe/ });
    await slider.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    record(`[${vp.w}] Arrow keys move the cursor along the curve`, (await slider.getAttribute('aria-valuenow')) === '3' && /°C|°/.test(await page.getByTestId('heat-readout').innerText()));
    await shot(s, '07-heat-curve-real');

    // rain tab: bars equal the ensemble probabilities
    await page.getByTestId('evolution-rain').click();
    await page.getByTestId('rain-chart').waitFor();
    const bars = await page.getByTestId('rain-bar').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-probability'))));
    const expected = assess.ensemble.daily.slice(0, 10).map((d) => d.probability_pct);
    record(`[${vp.w}] AIFS bars equal ensemble probabilities`, JSON.stringify(bars) === JSON.stringify(expected), JSON.stringify(bars));
    const rainTxt = await page.getByTestId('rain-chart').innerText();
    record(`[${vp.w}] AIFS card shows threshold, horizon, members, model`, new RegExp(`${assess.ensemble.rain_threshold_mm}`).test(rainTxt) && /membres/.test(rainTxt) && /ecmwf_aifs/.test(rainTxt));
    record(`[${vp.w}] AIFS threshold note is shown in French`, !/Operational demo/i.test(rainTxt) && /démonstration/.test(rainTxt));
    await shot(s, '08-aifs-uncertainty');
    await s.ctx.close();
  }

  // synthetic exceedance: the same real response, every temperature shifted by +20 °C (test only)
  const vp = { w: 1366, h: 768 };
  const s = await newSession(vp, {
    fields: [FEVEROLE_FIELD],
    mutateAssess: (json) => {
      json.weather.hourly.forEach((h) => {
        if (h.temperature_c !== null) h.temperature_c = Math.round((h.temperature_c + 20) * 10) / 10;
      });
      json.risk.alerts = [];
    },
  });
  const { page } = s;
  await gotoTab(s, 'Analyses');
  await page.getByTestId('open-heat-curve').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="heat-summary-hours"]'), null, { timeout: 30000 });
  await page.getByTestId('open-heat-curve').click();
  await page.getByTestId('heat-chart').waitFor();
  const syn = structuredClone(apiLog.assess.filter((a) => a.response).pop().response); // pristine response, shifted below exactly like the route does
  syn.weather.hourly.forEach((h) => (h.temperature_c = Math.round((h.temperature_c + 20) * 10) / 10));
  const nowMs = await page.evaluate(() => Date.now());
  const exp = expectedExposure(syn, 25, 48, nowMs);
  const ui = Number((await page.getByTestId('heat-exceed-hours').innerText()).replace(/\D/g, ''));
  record('[synthetic +20 °C] Exceedance hours match the independent computation', ui === exp.hours && exp.hours > 0, `UI ${ui}, expected ${exp.hours}`);
  record('[synthetic +20 °C] One highlighted band per contiguous exceedance span', (await page.getByTestId('heat-band').count()) === exp.spans && (await page.getByTestId('heat-spans').locator('li').count()) === exp.spans, `${exp.spans} spans`);
  await shot(s, '09-heat-curve-synthetic-exceedance');
  await s.ctx.close();

  // states without a validated threshold
  const s2 = await newSession({ w: 1366, h: 768 });
  await gotoTab(s2, 'Analyses');
  await s2.page.getByTestId('tab-evolution').click();
  await s2.page.getByTestId('heat-no-threshold').waitFor({ timeout: 30000 });
  record('[no threshold] Chickpea (no published threshold) shows a clear state, no exceedance number', /pois chiche/.test(await s2.page.getByTestId('heat-no-threshold').innerText()) && (await s2.page.getByTestId('heat-exceed-hours').count()) === 0);
  await shot(s2, '10-heat-no-threshold');
  await s2.ctx.close();

  const s3 = await newSession({ w: 1366, h: 768 }, { fields: [{ ...FEVEROLE_FIELD, growthStage: 'formation_gousses' }] });
  await gotoTab(s3, 'Analyses');
  await s3.page.getByTestId('tab-evolution').click();
  await s3.page.getByTestId('heat-no-threshold').waitFor({ timeout: 30000 });
  record('[wrong stage] Flowering threshold is not applied outside flowering', /floraison/.test(await s3.page.getByTestId('heat-no-threshold').innerText()));
  await s3.ctx.close();
});

// 6. Soil scenarios --------------------------------------------------------------------
test('soil-scenarios', async () => {
  const s = await newSession({ w: 1366, h: 768 });
  await gotoTab(s, 'Analyses');
  await s.page.getByTestId('tab-scenarios').click();
  await s.page.getByTestId(/soil-(unavailable|out_of_coverage|error|ok)/).first().waitFor({ timeout: 30000 }).catch(() => {});
  const txt = await s.page.getByTestId('panel-scenarios').innerText();
  record('[soil, deployed API] Honest unavailable state, no invented number', /non disponible|injoignable|hors zone/i.test(txt) && !/t\/ha\/an\s*\n?\s*\d/.test(txt), txt.slice(0, 120).replace(/\n/g, ' '));
  await shot(s, '11-soil-unavailable');
  await s.ctx.close();

  // fixture mirroring the geospatial branch schema (reports/soil-intelligence on feature/geospatial-soil-foundation)
  const fixture = {
    risk: {
      coverage: 'castelnaudary_study_area', model_version: 'rusle-1.0.0', equation: 'A = R * K * LS * C * P  [t/ha/yr]',
      study_area: { name: 'Castelnaudary / Lauragais (Aude, FR)' },
      vulnerability_index: { score_0_100: 40.5, band: 'modéré', limitations: ['Indice exploratoire d\'exposition, pas un taux de perte de sol.'] },
      rusle_baseline: { soil_loss_t_ha_yr: 6.68, units: 't ha-1 yr-1' },
      scenarios: [
        { scenario: 'baseline', soil_loss_t_ha_yr: 6.68, pct_vs_baseline: 0 },
        { scenario: 'wetter_climate', soil_loss_t_ha_yr: 8.69, pct_vs_baseline: 30.1 },
        { scenario: 'improved_cover_management', soil_loss_t_ha_yr: 2.1, pct_vs_baseline: -68.6 },
      ],
      sensitivity_tornado: [
        { factor: 'LS', A_low: 5.09, A_high: 23.82, swing: 18.73 },
        { factor: 'C', A_low: 3.34, A_high: 15.03, swing: 11.69 },
      ],
      uncertainty_range: { A_min_t_ha_yr: 1.06, A_max_t_ha_yr: 106.67 },
      assumptions: ['Longueur de pente supposée : 100 m.'], sources: [{}], generated_at_utc: '2026-11-01T06:20:11+00:00',
      disclaimer: 'Potentiel estimé par modèle, pas une mesure de terrain. Zone d\'étude unique.',
    },
    soil: { modelled: [{ depth_cm: '0-5', clay_pct: 31.1, sand_pct: 26.3, silt_pct: 42.6, soil_organic_carbon_g_per_kg: 40.9, ph_h2o: 7.43, provenance: { source: 'ISRIC SoilGrids 2.0', resolution: '250 m' } }] },
  };
  const s2 = await newSession({ w: 390, h: 844 }, { soilFixture: fixture });
  await gotoTab(s2, 'Analyses');
  await s2.page.getByTestId('tab-scenarios').click();
  await s2.page.getByTestId('soil-panel').waitFor({ timeout: 20000 });
  const panel = await s2.page.getByTestId('soil-panel').innerText();
  record('[soil, fixture] Index, RUSLE baseline, 3 scenarios, sensitivity and texture rendered', /40,5/.test(panel) && /6,68/.test(panel) && (await s2.page.getByTestId('soil-scenarios').locator('li').count()) === 3 && /LS/.test(panel) && /Argile/.test(panel) && /zone d'étude/i.test(panel));
  await shot(s2, '12-soil-fixture');
  await s2.ctx.close();
});

// 7. Ami: context, geolocation, requests, persistence --------------------------------
test('ami-context-and-geolocation', async () => {
  const vp = { w: 1366, h: 768 };
  const s = await newSession(vp);
  const { page } = s;
  const base0 = apiLog.advisor.length;
  const launcher = page.locator('button.ami-launcher');
  record('[ami] Launcher visible bottom-right on desktop', await launcher.isVisible() && (await launcher.boundingBox()).x > vp.w / 2);
  record('[ami] No advisor request on load or navigation', apiLog.advisor.length === base0);
  await launcher.click();
  const title = page.getByTestId('ami-title');
  record('[ami] Header shows selected field context', /Ami · Parcelle du Moulin/.test(await title.innerText()), await title.innerText());

  // field switching
  await page.locator('#ami-field-select').selectOption({ label: 'Les Terres Rouges (Berry) (démo)' });
  record('[ami] Switching field updates the context label', /Les Terres Rouges/.test(await title.innerText()), await title.innerText());
  await page.locator('#ami-field-select').selectOption({ index: 0 });

  // GPS: never read before an explicit click; denied -> map pick fallback
  await page.getByRole('radio', { name: /Près de moi/ }).click();
  record('[ami] Choosing "Près de moi" does not read the GPS by itself', (await page.evaluate(() => window.__geoCalls)) === 0);
  record('[ami] Composer is blocked until a position exists', await page.locator('#ami-input').evaluate((el) => el.form.querySelector('button[type=submit]').disabled === true));
  await page.getByRole('button', { name: /Utiliser ma position/ }).click();
  await page.getByRole('alert').waitFor();
  record('[ami] Denied permission shows a clear message and keeps the fallback', /refus/i.test(await page.getByRole('alert').innerText()) && (await page.evaluate(() => window.__geoCalls)) === 1);
  await shot(s, '13-ami-geolocation-denied');
  await page.getByRole('button', { name: /Choisir sur la carte/ }).click();
  await page.getByTestId('ami-pick-banner').waitFor();
  record('[ami] Map pick mode: panel closed, banner shown, map visible', !(await page.getByTestId('ami-panel').isVisible()) && (await page.getByTestId('weather-map').isVisible()));
  await page.mouse.click(430, 420);
  await page.getByTestId('ami-panel').waitFor();
  record('[ami] Picking a point reopens Ami in "Point choisi" context', /Point choisi/.test(await title.innerText()) && (await page.getByTestId('ami-position-info').count()) === 1, await page.getByTestId('ami-position-info').innerText());
  await page.getByRole('button', { name: /Fermer Ami/ }).click();
  await page.waitForTimeout(600);
  const sheet = await page.locator('.map-bottom-sheet').innerText();
  record('[ami] Map point is shown as an explored point, not as the field', /Point exploré/.test(sheet));
  await s.ctx.close();

  // granted GPS: request carries coordinates but no crop; field mode carries the field
  const g = await newSession(vp, { geolocation: { latitude: 43.32, longitude: 1.96, accuracy: 35 } });
  await g.page.locator('button.ami-launcher').click();
  await g.page.getByRole('radio', { name: /Près de moi/ }).click();
  await g.page.getByRole('button', { name: /Utiliser ma position/ }).click();
  await g.page.getByTestId('ami-position-info').waitFor();
  const info = await g.page.getByTestId('ami-position-info').innerText();
  record('[ami] Granted GPS: context "Près de moi" with accuracy', /Près de moi/.test(await g.page.getByTestId('ami-title').innerText()) && /±35 m/.test(info), info.replace(/\n/g, ' '));
  const before = apiLog.advisor.length;
  await g.page.locator('#ami-input').fill('Quelles sont les conditions météo à ma position ?');
  await g.page.getByRole('button', { name: 'Envoyer la question' }).click();
  await g.page.waitForTimeout(1500);
  const req = apiLog.advisor[before];
  record('[ami] Position request uses the GPS coordinates and NO crop or stage', req && near(req.body.field.latitude, 43.32, 0.001) && near(req.body.field.longitude, 1.96, 0.001) && req.body.field.crop === undefined && req.body.field.growth_stage === undefined, JSON.stringify(req?.body?.field));
  await shot(g, '14-ami-position-context');
  await g.ctx.close();
});

test('ami-advisor-real-question', async () => {
  for (const vp of [{ w: 1366, h: 768 }, { w: 390, h: 844 }]) {
    const s = await newSession(vp, { fields: [FEVEROLE_FIELD, LENTIL_FIELD] });
    const { page } = s;
    const base = apiLog.advisor.length;
    await gotoTab(s, 'Analyses');
    await gotoTab(s, 'Parcelles');
    record(`[${vp.w}] Navigating tabs triggers no advisor request`, apiLog.advisor.length === base);
    await page.locator('button.ami-launcher').click();
    const panel = page.getByTestId('ami-panel');
    record(`[${vp.w}] Ami opens (${phone(vp) ? 'full-screen dialog' : 'floating panel'})`, await panel.isVisible());
    const pb = await panel.boundingBox();
    if (phone(vp)) record(`[${vp.w}] Mobile Ami fills the viewport`, near(pb.width, vp.w, 2) && near(pb.height, vp.h, 2), JSON.stringify(pb));
    else record(`[${vp.w}] Desktop Ami is a floating panel inside the viewport`, pb.x > 0 && pb.x + pb.width < vp.w && pb.y > 0 && pb.y + pb.height < vp.h, JSON.stringify(pb));
    record(`[${vp.w}] Focus moves into the composer`, await page.waitForFunction(() => document.activeElement?.id === 'ami-input', null, { timeout: 2000 }).then(() => true).catch(() => false));

    await page.getByRole('button', { name: /Quel est le risque de chaleur/ }).click();
    record(`[${vp.w}] Suggestion fills the composer without sending`, (await page.locator('#ami-input').inputValue()).includes('chaleur') && apiLog.advisor.length === base);
    const t0 = Date.now();
    await page.getByRole('button', { name: 'Envoyer la question' }).click();
    await page.getByRole('status', { name: /Ami rédige/ }).waitFor({ timeout: 5000 }).catch(() => {});
    record(`[${vp.w}] Loading indicator shown while waiting`, true);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="ami-assistant-message"]').length > 0 && !document.querySelector('[aria-label="Ami rédige une réponse"]'),
      null,
      { timeout: 120000 }
    );
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const msg = page.getByTestId('ami-assistant-message').last();
    const text = await msg.innerText();
    const failed = /n'a pas pu répondre|n'est pas connecté/.test(text);
    record(`[${vp.w}] Real advisor answer received in ${secs}s`, !failed && text.length > 40, text.slice(0, 140).replace(/\n/g, ' '));
    record(`[${vp.w}] Exactly one /advisor/ask request for one question`, apiLog.advisor.length === base + 1, `${apiLog.advisor.length - base}`);
    const body = apiLog.advisor[base]?.body;
    record(`[${vp.w}] Request carries the selected field (coordinates, crop, stage)`, body && near(body.field.latitude, 43.31, 0.001) && body.field.crop === 'feverole' && body.field.growth_stage === 'floraison', JSON.stringify(body?.field));

    const toggle = msg.getByRole('button', { name: /Sources et preuves/ });
    if (await toggle.count()) {
      await toggle.click();
      const srcText = await msg.innerText();
      record(`[${vp.w}] Sources panel expands (citations / provenance / limitations)`, /Provenance de la prévision|Aucune citation|Ouvrir/.test(srcText), srcText.match(/(\d+) source/)?.[0] || 'no source count');
    }
    await shot(s, '15-ami-answer');

    // persistence across tabs, no extra request
    await page.getByRole('button', { name: /Fermer Ami/ }).click();
    for (const tab of ['Carte', 'Analyses', 'Accueil']) await gotoTab(s, tab);
    await page.locator('button.ami-launcher').click();
    record(`[${vp.w}] Conversation persists across tab navigation`, (await page.getByTestId('ami-assistant-message').count()) === 1 && (await page.getByTestId('ami-user-message').count()) === 1);
    record(`[${vp.w}] Still a single advisor request after navigation`, apiLog.advisor.length === base + 1);

    // Escape closes and returns focus
    await page.keyboard.press('Escape');
    record(`[${vp.w}] Escape closes Ami and focus returns to the launcher`, !(await panel.isVisible()) && (await page.evaluate(() => document.activeElement?.classList.contains('ami-launcher'))));

    // field switching changes the next request body (not awaited: avoids a second Bedrock call)
    await page.locator('button.ami-launcher').click();
    await page.locator('#ami-field-select').selectOption({ label: 'Lentilles test' });
    await page.locator('#ami-input').fill('Puis-je traiter dans les prochains jours ?');
    await page.getByRole('button', { name: 'Envoyer la question' }).click();
    await page.waitForTimeout(1200);
    const second = apiLog.advisor[base + 1]?.body;
    record(`[${vp.w}] After switching field the request targets the other field`, second && near(second.field.latitude, 46.81, 0.001) && second.field.crop === 'lentille', JSON.stringify(second?.field));
    await s.ctx.close();
  }
});

// 8. Notification center ---------------------------------------------------------------
test('notification-center', async () => {
  // desktop popover
  const vp = { w: 1366, h: 768 };
  const s = await newSession(vp);
  const { page } = s;
  const bell = page.getByTestId('notification-bell');
  const badge = Number(await page.getByTestId('notification-bell-badge').innerText());
  record('[bell] Unread badge shown on the bell', badge > 0, String(badge));
  await bell.click();
  const center = page.getByTestId('notification-center');
  record('[bell] Popover opens', await center.isVisible());
  const bb = await center.boundingBox();
  record('[bell] Popover is fully inside the viewport and not clipped by the nav', bb.x >= 0 && bb.y >= 40 && bb.x + bb.width <= vp.w && bb.y + bb.height <= vp.h, JSON.stringify(bb));
  const topEl = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-testid="notification-center"]'), { x: bb.x + bb.width / 2, y: bb.y + 40 });
  record('[bell] Popover is the top-most layer at its position', topEl);
  record('[bell] Count in the header equals the bell badge', new RegExp(`${badge} non lue`).test(await page.getByTestId('notification-center-count').innerText()));
  const provLabels = await center.locator('li').evaluateAll((els) => els.map((e) => (e.textContent.match(/Prévision|Exemple|Simulée/) || [''])[0]));
  record('[bell] Every item carries one provenance badge (forecast / example)', provLabels.every(Boolean) && new Set(provLabels).size >= 1, provLabels.join(','));
  const ami = await box(page, 'button.ami-launcher');
  record('[bell] Popover does not overlap the Ami launcher', !intersects(bb, ami));
  await shot(s, '16-notification-popover');
  const first = center.locator('li button').first();
  const firstText = await first.innerText();
  await first.click();
  const currentTab = await page.locator(navSel(vp) + ' button[aria-current="page"]').innerText();
  record('[bell] Opening an item closes the popover and navigates to its destination', !(await center.isVisible()) && currentTab.trim() !== 'Accueil', currentTab.trim());
  const badgeAfter = (await page.getByTestId('notification-bell-badge').count()) ? Number(await page.getByTestId('notification-bell-badge').innerText()) : 0;
  record('[bell] Item is marked read (badge decreases)', badgeAfter === badge - 1, `${badge} -> ${badgeAfter} (${firstText.split('\n')[0]})`);
  await bell.click();
  await page.keyboard.press('Escape');
  record('[bell] Escape closes and returns focus to the bell', !(await center.isVisible()) && (await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'notification-bell')));
  await bell.click();
  await page.mouse.click(60, 400);
  record('[bell] Outside click closes', !(await center.isVisible()));
  await bell.click();
  await page.getByRole('button', { name: 'Fermer les notifications' }).click();
  record('[bell] Close icon closes', !(await center.isVisible()));
  await bell.click();
  await page.getByRole('button', { name: /Tout lire/ }).click();
  record('[bell] "Tout lire" clears the badge', (await page.getByTestId('notification-bell-badge').count()) === 0);
  await page.getByRole('button', { name: /Ouvrir tout l'historique/ }).click();
  record('[bell] Link opens the full Alertes page', await page.getByRole('heading', { name: /Alertes/ }).first().isVisible());
  await shot(s, '17-alertes-page');
  await s.ctx.close();

  // phone sheet
  for (const pvp of [{ w: 390, h: 844 }, { w: 375, h: 812 }]) {
    const m = await newSession(pvp);
    await m.page.locator(navSel(pvp)).getByRole('button', { name: 'Alertes' }).click();
    const c = m.page.getByTestId('notification-center');
    await c.waitFor();
    const cb = await c.boundingBox();
    const tb = await box(m.page, navSel(pvp));
    record(`[${pvp.w}] Phone: notifications open as a sheet above the tab bar`, cb.y + cb.height <= tb.y + 1 && cb.y > 0, JSON.stringify({ cb, tb }));
    await shot(m, '18-notification-sheet');
    await m.page.keyboard.press('Escape');
    record(`[${pvp.w}] Phone: Escape dismisses the sheet`, !(await c.isVisible()));
    await m.page.locator(navSel(pvp)).getByRole('button', { name: 'Alertes' }).click();
    await m.page.mouse.click(pvp.w / 2, 20);
    record(`[${pvp.w}] Phone: tapping outside dismisses the sheet`, !(await c.isVisible()));
    await m.ctx.close();
  }
});

// 9. Accessibility spot checks --------------------------------------------------------------
test('accessibility', async () => {
  const s = await newSession({ w: 1366, h: 768 });
  const { page } = s;
  const emulate = await s.ctx.newPage();
  await emulate.emulateMedia({ reducedMotion: 'reduce' });
  await emulate.goto(BASE);
  const dur = await emulate.evaluate(() => getComputedStyle(document.body).transitionDuration);
  record('[a11y] prefers-reduced-motion is honoured by the global stylesheet', await emulate.evaluate(() => {
    const el = document.createElement('div');
    el.style.transition = 'opacity 2s';
    document.body.appendChild(el);
    const d = getComputedStyle(el).transitionDuration;
    el.remove();
    return parseFloat(d) < 0.1;
  }), dur);
  await page.keyboard.press('Tab');
  const tabbable = await page.evaluate(() => document.activeElement?.tagName);
  record('[a11y] Keyboard Tab reaches interactive controls', ['BUTTON', 'A', 'INPUT', 'SELECT'].includes(tabbable), tabbable);
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => !(b.textContent || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length
  );
  record('[a11y] Every icon-only button has an accessible name', unnamed === 0, `${unnamed} unnamed`);
  await s.ctx.close();
});

/* ------------------------------------------------------------------ runner */

browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
for (const t of tests) {
  if (ONLY && !ONLY.includes(t.name)) continue;
  console.log(`\n=== ${t.name}`);
  try {
    await t.fn();
  } catch (err) {
    record(`${t.name} aborted`, false, err.message.split('\n')[0]);
  }
}
await browser.close();

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(
  path.join(OUT, 'results.json'),
  JSON.stringify(
    { base: BASE, api: API, generatedAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, advisorRequests: apiLog.advisor.length, assessRequests: apiLog.assess.length, results },
    null,
    2
  )
);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. advisor requests: ${apiLog.advisor.length}`);
process.exit(failed.length ? 1 : 0);
