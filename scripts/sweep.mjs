#!/usr/bin/env node
/**
 * sweep.mjs — Magpie recall sweep
 *
 * Pulls recent recalls from four federal sources and normalizes them into
 * data/alerts.json. Designed to run on a schedule (GitHub Actions cron).
 *
 * Sources:
 *   CPSC       https://www.saferproducts.gov/RestWebServices/Recall  (JSON, no key)
 *   FDA        https://api.fda.gov/{food,drug,device}/enforcement.json (openFDA, no key)
 *   USDA FSIS  https://www.fsis.usda.gov/fsis/api/recall/v/1 (JSON, no key)
 *   NHTSA      https://static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL.zip (daily flat file)
 *
 * Every alert links to the official notice. Severity is derived, not invented:
 * FDA/FSIS Class I/II/III map directly; CPSC and NHTSA use documented keyword
 * heuristics (see severityFromText / NHTSA park-it flags). The mapping is
 * published on the site at /#severity.
 *
 * No source failure is fatal: partial sweeps are recorded per-source in
 * data/sweep-meta.json and surfaced honestly in the UI.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

const WINDOW_DAYS = Number(process.env.SWEEP_WINDOW_DAYS || 45);
const MAX_PER_SOURCE = Number(process.env.SWEEP_MAX_PER_SOURCE || 25);
const UA = 'MagpieRecallSweep/1.0 (+contact: set CONTACT_EMAIL env var)';

const now = new Date();
const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86400_000);

const iso = (d) => d.toISOString().slice(0, 10);
const yyyymmdd = (d) => iso(d).replaceAll('-', '');

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function truncate(s, n = 420) {
  if (!s) return '';
  const clean = String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + '…' : clean;
}

/** Documented CPSC severity heuristic (published at /#severity). */
function severityFromText(text) {
  const t = (text || '').toLowerCase();
  if (/\b(death|fatal|serious injury|entrapment|strangulation|suffocation|asphyx|fire hazard.*infant|infant.*fire|lead poisoning|carbon monoxide|drowning)\b/.test(t)) return 'critical';
  if (/\b(fire|burn|choking|laceration|injur|fall hazard|shock|electrocution|crash|contaminat|e\. coli|listeria|salmonella|undeclared allergen)\b/.test(t)) return 'elevated';
  return 'advisory';
}

const classMap = { 'Class I': 'critical', 'Class II': 'elevated', 'Class III': 'advisory' };

/* ---------------------------------------------------------------- CPSC */
async function sweepCPSC() {
  const url = `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${iso(windowStart)}&RecallDateEnd=${iso(now)}`;
  const rows = await getJSON(url);
  return rows
    .filter((r) => r.RecallDate && new Date(r.RecallDate) >= windowStart)
    .slice(0, MAX_PER_SOURCE)
    .map((r) => {
      const hazard = (r.Hazards || []).map((h) => h.Name).join(' ');
      const remedy = (r.Remedies || []).map((x) => x.Name).join(' ');
      const product = (r.Products || [])[0] || {};
      const retailer = ((r.Retailers || [])[0] || {}).Name || '';
      return {
        id: `cpsc-${r.RecallNumber || r.RecallID}`,
        source: 'CPSC',
        official: true,
        category: 'consumer',
        severity: severityFromText(`${r.Title} ${hazard}`),
        date: String(r.RecallDate).slice(0, 10),
        headline: r.Title,
        affected: truncate([product.Name, product.NumberOfUnits && `${product.NumberOfUnits} units`, retailer].filter(Boolean).join(' — '), 260),
        why: truncate(hazard, 420),
        action: truncate(remedy, 420),
        url: r.URL,
        units: product.NumberOfUnits || '',
        injuries: truncate(((r.Injuries || [])[0] || {}).Name || '', 220),
        remedy: ((r.RemedyOptions || [])[0] || {}).Option || '',
      };
    });
}

/* ----------------------------------------------------------------- FDA */
async function sweepFDA() {
  const kinds = [
    ['food', 'food'],
    ['drug', 'drugs'],
    ['device', 'drugs'], // devices shown under Drugs & Medical Devices
  ];
  const out = [];
  for (const [endpoint, category] of kinds) {
    const url = `https://api.fda.gov/${endpoint}/enforcement.json?search=report_date:[${yyyymmdd(windowStart)}+TO+${yyyymmdd(now)}]&sort=report_date:desc&limit=${MAX_PER_SOURCE}`;
    try {
      const json = await getJSON(url);
      for (const r of json.results || []) {
        const date = r.recall_initiation_date || r.report_date || '';
        out.push({
          id: `fda-${(r.recall_number || '').replace(/\W+/g, '') || `${endpoint}-${date}-${out.length}`}`,
          source: 'FDA',
          official: true,
          category,
          severity: classMap[r.classification] || 'advisory',
          date: date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : iso(now),
          headline: truncate(`${r.recalling_firm || 'Firm'} recalls ${r.product_description || 'product'}`, 180),
          affected: truncate([r.product_description, r.code_info && `Codes: ${r.code_info}`, r.distribution_pattern && `Distribution: ${r.distribution_pattern}`].filter(Boolean).join(' · '), 300),
          why: truncate(`${r.reason_for_recall || ''}${r.classification ? ` (FDA ${r.classification}${r.classification === 'Class I' ? ' — reasonable probability of serious adverse health consequences' : ''}.)` : ''}`, 420),
          action: truncate(`Check codes above. ${r.voluntary_mandated ? `${r.voluntary_mandated} recall. ` : ''}Stop using matching product; contact the point of sale or ${r.recalling_firm || 'the firm'} for the remedy. See the official enforcement report for details.`, 420),
          url: 'https://www.accessdata.fda.gov/scripts/ires/index.cfm', // FDA IRES search; enforcement reports have no stable per-item public URL
          units: '', injuries: '', remedy: '',
          recallNumber: r.recall_number || '',
        });
      }
    } catch (e) {
      // A 404 from openFDA means "no results in range" — treat as empty, not error.
      if (!String(e.message).startsWith('404')) throw e;
    }
  }
  return out;
}

/* ------------------------------------------------------------ USDA FSIS */
async function sweepFSIS() {
  const rows = await getJSON('https://www.fsis.usda.gov/fsis/api/recall/v/1');
  return rows
    .filter((r) => (r.langcode || 'English') === 'English')
    .map((r) => {
      // Prefer the recall/alert date fields FSIS provides; fall back to year.
      const raw = r.field_recall_date || r.field_closed_date || '';
      return { r, date: raw ? String(raw).slice(0, 10) : `${r.field_year || ''}-01-01` };
    })
    .filter(({ date }) => date && new Date(date) >= windowStart)
    .slice(0, MAX_PER_SOURCE)
    .map(({ r, date }) => {
      const cls = (r.field_recall_classification || '').trim();
      const risk = (r.field_risk_level || '').toLowerCase();
      const severity = classMap[cls] || (risk.includes('high') ? 'critical' : risk.includes('low') ? 'elevated' : 'advisory');
      const slugTitle = r.field_title || 'FSIS recall';
      return {
        id: `fsis-${(r.field_recall_number || slugTitle).toString().replace(/\W+/g, '-').slice(0, 60)}`,
        source: 'USDA FSIS',
        official: true,
        category: 'food',
        severity,
        date,
        headline: truncate(slugTitle, 180),
        affected: truncate([r.field_product_items, r.field_states && `States: ${r.field_states}`].filter(Boolean).join(' · '), 300),
        why: truncate(`${r.field_recall_reason || ''}${cls ? ` (FSIS ${cls}.)` : ''} ${truncate(r.field_summary, 220)}`, 420),
        action: 'Do not consume. Discard or return to the place of purchase. Check establishment number and dates in the official FSIS notice.',
        url: r.field_recall_url ? `https://www.fsis.usda.gov${r.field_recall_url}` : 'https://www.fsis.usda.gov/recalls',
        units: '', injuries: '', remedy: 'Discard or return',
      };
    });
}

/* --------------------------------------------------------------- NHTSA */
/**
 * NHTSA has no "latest recalls" JSON endpoint. The documented route is the
 * daily flat file (pipe-delimited, ~100MB zipped, all years). We stream it,
 * keep rows whose RCDATE falls in the window, and normalize.
 * Layout: static.nhtsa.gov/odi/ffdd/rcl/RCL.txt (see NHTSA datasets page).
 */
async function sweepNHTSA() {
  const zipUrl = 'https://static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL.zip';
  const tmp = path.join(DATA, 'FLAT_RCL.zip');
  const res = await fetch(zipUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} for ${zipUrl}`);
  await writeFile(tmp, Buffer.from(await res.arrayBuffer()));
  const { stdout } = await execFileP('unzip', ['-p', tmp], { maxBuffer: 1024 * 1024 * 1024 });

  // FLAT_RCL columns (tab-delimited), per NHTSA layout doc:
  // 0 RECORD_ID, 1 CAMPNO, 2 MAKETXT, 3 MODELTXT, 4 YEARTXT, 5 MFGCAMPNO,
  // 6 COMPNAME, 7 MFGNAME, 8 BGMAN, 9 ENDMAN, 10 RCLTYPECD, 11 POTAFF,
  // 12 ODATE, 13 INFLUENCED_BY, 14 MFGTXT, 15 RCDATE, 16 DATEA, 17 RPNO,
  // 18 FMVSS, 19 DESC_DEFECT, 20 CONSEQUENCE_DEFECT, 21 CORRECTIVE_ACTION,
  // 22 NOTES, 23 RCL_CMPT_ID, 24 MFR_COMP_NAME, 25 MFR_COMP_DESC, 26 MFR_COMP_PTNO
  const byCampaign = new Map();
  for (const line of stdout.split('\n')) {
    const c = line.split('\t');
    if (c.length < 22) continue;
    const rcdate = c[15]; // YYYYMMDD
    if (!rcdate || rcdate < yyyymmdd(windowStart)) continue;
    const camp = c[1];
    const entry = byCampaign.get(camp) || {
      campaign: camp, makes: new Set(), models: new Set(), years: new Set(),
      component: c[6], mfg: c[7], potaff: c[11], date: rcdate,
      defect: c[19], consequence: c[20], action: c[21], notes: c[22] || '',
    };
    entry.makes.add(c[2]); entry.models.add(`${c[2]} ${c[3]} ${c[4]}`.trim()); entry.years.add(c[4]);
    byCampaign.set(camp, entry);
  }

  return [...byCampaign.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_PER_SOURCE)
    .map((e) => {
      const text = `${e.defect} ${e.consequence} ${e.notes}`;
      const parkIt = /do not drive|park it|stop driving/i.test(text);
      const parkOutside = /park outside|away from structures/i.test(text);
      const severity = parkIt || parkOutside || /crash without warning|loss of control|fire/i.test(e.consequence || '')
        ? 'critical' : 'elevated';
      const models = [...e.models].slice(0, 6).join(', ') + (e.models.size > 6 ? ` and ${e.models.size - 6} more` : '');
      return {
        id: `nhtsa-${e.campaign}`,
        source: 'NHTSA',
        official: true,
        category: 'vehicles',
        severity,
        date: `${e.date.slice(0, 4)}-${e.date.slice(4, 6)}-${e.date.slice(6, 8)}`,
        headline: truncate(`${e.mfg || [...e.makes].join('/')} recalls ${models} — ${(e.component || 'safety defect').toLowerCase()}`, 180),
        affected: truncate(`${models}${e.potaff ? ` · ~${Number(e.potaff).toLocaleString('en-US')} vehicles potentially affected` : ''}`, 300),
        why: truncate(`${e.defect} ${e.consequence}`, 420),
        action: truncate(`${e.action || 'Dealers will remedy free of charge.'}${parkIt ? ' NHTSA advises: DO NOT DRIVE until repaired.' : ''}${parkOutside ? ' Park outside and away from structures until repaired.' : ''} Check your VIN at nhtsa.gov/recalls.`, 420),
        url: `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(e.campaign)}`,
        units: e.potaff || '', injuries: '', remedy: 'Free dealer remedy',
      };
    });
}

/* ---------------------------------------------------------------- main */
const sourceRuns = [
  ['CPSC', sweepCPSC],
  ['FDA', sweepFDA],
  ['USDA FSIS', sweepFSIS],
  ['NHTSA', sweepNHTSA],
];

await mkdir(DATA, { recursive: true });

let existing = [];
try { existing = JSON.parse(await readFile(path.join(DATA, 'alerts.json'), 'utf8')); } catch {}

const meta = { sweptAt: new Date().toISOString(), sources: {} };
const collected = [];

for (const [name, fn] of sourceRuns) {
  try {
    const items = await fn();
    collected.push(...items);
    meta.sources[name] = { ok: true, count: items.length };
    console.log(`✓ ${name}: ${items.length} alerts`);
  } catch (err) {
    // Keep the most recent existing items from this source so a transient
    // outage doesn't blank the feed; report the failure honestly.
    const kept = existing.filter((a) => a.source === name);
    collected.push(...kept);
    meta.sources[name] = { ok: false, count: kept.length, error: String(err.message).slice(0, 200) };
    console.error(`✗ ${name}: ${err.message} (kept ${kept.length} prior items)`);
  }
}

// De-dupe by id, sort severity then date desc, cap total.
const sevRank = { critical: 0, elevated: 1, advisory: 2 };
const seen = new Set();
const alerts = collected
  .filter((a) => a && a.id && !seen.has(a.id) && seen.add(a.id))
  .filter((a) => new Date(a.date) >= windowStart || existing.some((e) => e.id === a.id))
  .sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]) || b.date.localeCompare(a.date))
  .slice(0, 120);

await writeFile(path.join(DATA, 'alerts.json'), JSON.stringify(alerts, null, 2));
await writeFile(path.join(DATA, 'sweep-meta.json'), JSON.stringify(meta, null, 2));
console.log(`\nWrote ${alerts.length} alerts · ${Object.values(meta.sources).filter((s) => s.ok).length}/4 sources reporting`);
