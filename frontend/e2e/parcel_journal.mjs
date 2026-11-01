/**
 * Focused end-to-end checks for the two new jury-release features that the main
 * harness (run.mjs) does not cover: parcel polygon drawing + hectare computation,
 * and the per-field activity journal (persistence + isolation).
 *
 *   cd frontend
 *   BASE_URL=http://127.0.0.1:5180 CHROME_PATH=/usr/bin/google-chrome node e2e/parcel_journal.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5180';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const OUT = path.resolve(process.env.OUT_DIR || '../reports/ux-remediation/hackathon');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail: String(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const FIELD_A = {
  id: 'pj_a', name: 'Parcelle A', latitude: 43.3183, longitude: 1.9538,
  commune: 'Castelnaudary', departmentCode: '11', cropType: 'pois_chiche',
  growthStage: 'floraison', areaHectares: 12,
  createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-01T08:00:00Z',
};
const FIELD_B = { ...FIELD_A, id: 'pj_b', name: 'Parcelle B', cropType: 'lentille', latitude: 43.32, longitude: 1.96 };

const DESKTOP_NAV = 'nav[aria-label="Navigation Bureau"]';

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function session(seedFields) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  if (seedFields) {
    await ctx.addInitScript(({ fields, active }) => {
      // Seed only on first load; reloads must keep whatever the app has persisted.
      if (!localStorage.getItem('legum_registered_fields')) {
        localStorage.setItem('legum_registered_fields', JSON.stringify(fields));
        localStorage.setItem('legum_active_field_id', active);
      }
    }, { fields: seedFields, active: seedFields[0].id });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector(DESKTOP_NAV, { state: 'attached' });
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}

const gotoParcelles = async (page) => {
  await page.locator(DESKTOP_NAV).getByRole('button', { name: 'Parcelles' }).click();
  await page.waitForTimeout(500);
};

/* ---------------- 1. Parcel drawing ---------------- */
try {
  const { ctx, page, errors } = await session([FIELD_A]);
  await gotoParcelles(page);
  await page.getByRole('button', { name: /Nouvelle parcelle/ }).click();
  await page.waitForSelector('#field-wizard-title');
  await page.locator('input[type="text"]').first().fill('Parcelle dessinée E2E');

  // enter drawing mode and click four corners on the Leaflet canvas
  await page.getByRole('button', { name: /Dessiner le contour/ }).click();
  const map = page.locator('[aria-label="Carte interactive pour dessiner la parcelle"]');
  const b = await map.boundingBox();
  const corners = [
    { x: b.x + b.width * 0.35, y: b.y + b.height * 0.35 },
    { x: b.x + b.width * 0.65, y: b.y + b.height * 0.35 },
    { x: b.x + b.width * 0.65, y: b.y + b.height * 0.65 },
    { x: b.x + b.width * 0.35, y: b.y + b.height * 0.65 },
  ];
  for (const c of corners) { await page.mouse.click(c.x, c.y); await page.waitForTimeout(250); }
  const areaText = await page.locator('text=/ha calculés/').first().innerText();
  record('[parcel] Four-corner polygon computes a positive hectare area', /\d/.test(areaText) && parseFloat(areaText.replace(',', '.')) > 0, areaText.trim());

  await page.getByRole('button', { name: /Terminer/ }).click();
  const notice = await page.getByRole('status').filter({ hasText: /Contour enregistré/ }).first().innerText().catch(() => '');
  record('[parcel] "Terminer" confirms the saved contour with its area', /Contour enregistré/.test(notice), notice.trim());

  // walk the wizard to the end and save
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: /Continuer/ }).click(); await page.waitForTimeout(250); }
  await page.getByRole('button', { name: /Enregistrer la parcelle/ }).click();
  await page.waitForTimeout(800);
  const cardText = await page.locator('h3', { hasText: 'Parcelle dessinée E2E' }).first().isVisible();
  record('[parcel] New drawn field appears in the list', cardText);

  // persists across reload
  await page.reload();
  await page.waitForTimeout(1500);
  await gotoParcelles(page);
  const stillThere = await page.locator('h3', { hasText: 'Parcelle dessinée E2E' }).first().isVisible();
  record('[parcel] Drawn field persists after a full page refresh', stillThere);

  // editing re-opens with the stored polygon and recomputes area
  await page.getByRole('button', { name: /Modifier Parcelle dessinée E2E/ }).click();
  await page.waitForSelector('#field-wizard-title');
  const reopenArea = await page.locator('text=/ha calculés/').first().innerText().catch(() => '');
  record('[parcel] Editing the field restores its polygon (area recomputed)', /ha calculés/.test(reopenArea) && parseFloat(reopenArea.replace(',', '.')) > 0, reopenArea.trim());
  record('[parcel] No page error during the parcel workflow', errors.length === 0, errors.join(' | '));
  await ctx.close();
} catch (err) {
  record('[parcel] workflow aborted', false, err.message.split('\n')[0]);
}

/* ---------------- 2. Activity journal: persistence + isolation ---------------- */
try {
  const { ctx, page, errors } = await session([FIELD_A, FIELD_B]);
  await gotoParcelles(page);

  const openJournal = async (fieldName) => {
    await page.getByRole('button', { name: new RegExp('Journal.*' + fieldName) }).click();
    await page.getByRole('dialog', { name: 'Journal de parcelle' }).waitFor();
  };
  const addEvent = async (label, qty) => {
    await page.getByRole('combobox').first().selectOption({ label });
    if (qty) await page.locator('input[type="number"]').first().fill(String(qty));
    await page.getByRole('button', { name: /Enregistrer l.intervention/ }).click();
    await page.waitForTimeout(250);
  };
  const historyCount = async () => {
    const h = await page.getByRole('heading', { name: /Historique/ }).innerText();
    return Number(h.match(/\((\d+)\)/)?.[1] ?? '-1');
  };

  // Field A: irrigation + fertilizer
  await openJournal('Parcelle A');
  await addEvent('Irrigation', 25);
  await addEvent('Engrais / fertilisation', 120);
  record('[journal] Field A records two interventions', (await historyCount()) === 2, `count=${await historyCount()}`);
  await page.getByRole('button', { name: 'Fermer' }).click();

  // Field B must start empty (isolation), then add biostimulant + crop rotation
  await openJournal('Parcelle B');
  record('[journal] Field B journal is isolated (starts empty)', (await historyCount()) === 0, `count=${await historyCount()}`);
  await addEvent('Biostimulant / inoculant', 2);
  await addEvent('Rotation / culture précédente');
  record('[journal] Field B records its own two interventions', (await historyCount()) === 2, `count=${await historyCount()}`);
  await page.getByRole('button', { name: 'Fermer' }).click();

  // Reload: both fields keep their own events
  await page.reload();
  await page.waitForTimeout(1500);
  await gotoParcelles(page);
  await openJournal('Parcelle A');
  const aAfter = await historyCount();
  record('[journal] Field A events persist after refresh', aAfter === 2, `count=${aAfter}`);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await openJournal('Parcelle B');
  const bAfter = await historyCount();
  record('[journal] Field B events persist and stay isolated after refresh', bAfter === 2, `count=${bAfter}`);
  await page.getByRole('button', { name: 'Fermer' }).click();
  record('[journal] No page error during the journal workflow', errors.length === 0, errors.join(' | '));
  await ctx.close();
} catch (err) {
  record('[journal] workflow aborted', false, err.message.split('\n')[0]);
}

await browser.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'parcel_journal_results.json'), JSON.stringify({ base: BASE, generatedAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed.`);
process.exit(failed.length ? 1 : 0);
