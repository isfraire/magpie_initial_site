/** template.mjs — server-rendered HTML for Magpie News.
 *  Every alert is real content in the initial HTML (crawlable, sharable).
 *  app.js progressively enhances filtering/expand; the page works without JS. */

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SITE = {
  name: 'Magpie',
  title: 'Recall & Safety Alerts — Magpie',
  description: 'Major recalls and safety alerts from CPSC, NHTSA, FDA and USDA FSIS, in plain language: what\u2019s affected, why it matters and what to do. Free for everyone, watched by Magpie.',
  // Set MAGPIE_BASE_URL when deploying (e.g. https://<user>.github.io/magpie-news)
  baseUrl: process.env.MAGPIE_BASE_URL || '',
  // Set MAGPIE_FORM_ACTION to your Formspree/Buttondown endpoint to activate capture.
  formAction: process.env.MAGPIE_FORM_ACTION || '',
};

const CATS = { vehicles: 'Vehicles', food: 'Food & Agriculture', drugs: 'Drugs & Medical Devices', consumer: 'Consumer & Household' };
const SEV = { critical: 'Critical', elevated: 'Elevated', advisory: 'Advisory' };

const plume = (size = 26) => `<svg width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><path d="M60 12 C 84 40 84 78 60 108 C 36 78 36 40 60 12 Z" fill="#191A1C"/><path d="M43 60 Q 60 69 77 60 C 78 81 72 96 60 108 C 48 96 42 81 43 60 Z" fill="#12A8A0"/><path d="M60 22 L60 102" stroke="#F6F2E9" stroke-width="2.4" stroke-linecap="round"/><g stroke="#F6F2E9" stroke-width="1.7" stroke-linecap="round"><path d="M60 38 L47 32"/><path d="M60 38 L73 32"/><path d="M60 52 L44 47"/><path d="M60 52 L76 47"/></g></svg>`;

const sevIcon = {
  critical: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>`,
  elevated: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
  advisory: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
};

const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function head({ title, description, path = '/', ogType = 'website' }) {
  const url = SITE.baseUrl ? SITE.baseUrl + path : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:site_name" content="Magpie">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${url ? `<meta property="og:url" content="${esc(url)}">\n<link rel="canonical" href="${esc(url)}">` : ''}
<meta name="twitter:card" content="summary">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${path.startsWith('/alerts/') ? '../' : ''}styles.css">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(plume(32))}">
</head>`;
}

function header(rel = '') {
  return `<a class="skip-link" href="#feed">Skip to alerts</a>
<header class="site-header"><div class="wrap">
  <a class="brand" href="${rel}index.html" aria-label="Magpie home">${plume(26)}<span>magpie</span></a>
  <a class="nav-link" href="${rel}index.html#how">How it works</a>
  <a class="nav-link" href="${rel}index.html#severity">How we rate severity</a>
  <a class="cta-header" href="${rel}index.html#early-access">Get early access</a>
</div></header>`;
}

function footer(rel = '') {
  return `<footer class="site-footer"><div class="wrap">
  <div class="footer-brand">
    <a class="footer-logo" href="${rel}index.html">${plume(20)}<span>magpie</span></a>
    <p class="footer-disclaimer">Alerts are sourced from public federal databases — CPSC, NHTSA, FDA and USDA FSIS. Severity labels are Magpie's editorial classification (<a href="${rel}index.html#severity" style="color:rgba(246,242,233,0.75)">how we rate severity</a>), not the agencies'. Always follow the official notice linked on each alert.</p>
  </div>
  <nav class="footer-cols" aria-label="Footer">
    <div class="footer-col"><h2>Sources</h2>
      <a href="https://www.cpsc.gov/Recalls" rel="noopener">CPSC.gov</a>
      <a href="https://www.nhtsa.gov/recalls" rel="noopener">NHTSA.gov</a>
      <a href="https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts" rel="noopener">FDA.gov</a>
      <a href="https://www.fsis.usda.gov/recalls" rel="noopener">FSIS.USDA.gov</a>
    </div>
    <div class="footer-col"><h2>Magpie</h2>
      <a href="${rel}index.html#how">How it works</a>
      <a href="${rel}index.html#early-access">Get early access</a>
    </div>
  </nav>
</div></footer>`;
}

function alertCard(a, { linkBase = 'alerts/' } = {}) {
  return `<li class="alert-card" data-id="${esc(a.id)}" data-cat="${esc(a.category)}" data-src="${esc(a.source)}" data-sev="${esc(a.severity)}" data-date="${esc(a.date)}" data-open="false">
  <button class="card-toggle" aria-expanded="false" aria-controls="detail-${esc(a.id)}">
    <span class="sev-icon ${esc(a.severity)}">${sevIcon[a.severity]}</span>
    <span class="card-main">
      <span class="meta-row">
        <span class="sev-pill ${esc(a.severity)}">${SEV[a.severity]}</span>
        <span class="src-pill">${esc(a.source)}</span>
        <time datetime="${esc(a.date)}">${fmtDate(a.date)}</time>
        <span class="cat">· ${CATS[a.category] || esc(a.category)}</span>
      </span>
      <span class="card-headline">${esc(a.headline)}</span>
      <span class="card-affected">${esc(a.affected)}</span>
    </span>
    <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  <div class="card-detail" id="detail-${esc(a.id)}" hidden>
    <div class="detail-grid">
      <div><div class="detail-label">WHY IT MATTERS</div><p>${esc(a.why)}</p></div>
      <div><div class="detail-label">WHAT TO DO</div><p>${esc(a.action)}</p></div>
    </div>
    <div class="detail-actions">
      <a class="btn btn-dark btn-sm" href="${esc(a.url)}" rel="noopener">Official notice · ${esc(a.source)} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg></a>
      <a class="btn btn-teal btn-sm" href="#early-access" data-watch="${esc(a.headline.slice(0, 90))}">Own one? Get alerts for your stuff</a>
      <a class="btn btn-sm" style="color:var(--meta)" href="${linkBase}${esc(a.id)}.html">Permalink</a>
    </div>
  </div>
</li>`;
}

export function renderIndex(alerts, meta) {
  const okCount = Object.values(meta.sources).filter((s) => s.ok).length;
  const sweptDate = fmtDate(meta.sweptAt.slice(0, 10));
  const featured = alerts.find((a) => a.severity === 'critical') || alerts[0];
  const rest = alerts.filter((a) => a !== featured);
  const capturePos = Math.min(3, rest.length);
  const sources = [...new Set(alerts.map((a) => a.source))];

  const captureModule = `
<section class="capture" id="early-access" aria-labelledby="capture-h">
  <div>
    <h2 id="capture-h">This page can't tell you which recall is about <em>your</em> stuff. Magpie will.</h2>
    <p class="lede">Snap a photo of a product or receipt and Magpie logs it, then watches all four federal databases for you — and tracks your warranties too. Be first in line when it launches, and get the recalls that matter in the meantime.</p>
    <form method="POST" action="${esc(SITE.formAction)}" data-capture ${SITE.formAction ? '' : 'data-unconfigured'}>
      <label for="capture-email" class="sr-only" style="position:absolute;left:-9999px">Email address</label>
      <input id="capture-email" type="email" name="email" required placeholder="you@example.com" autocomplete="email" inputmode="email">
      <input type="hidden" name="interested_product" value="" data-watch-field>
      <button class="btn btn-teal-solid" type="submit">Get early access</button>
    </form>
    <p class="fineprint">One or two emails a month, only when it matters. Unsubscribe anytime. No data sold, ever.</p>
  </div>
  <figure class="vignette">
    <div class="phone-note">
      <span class="app-ico">${plume(18)}</span>
      <span><strong>Magpie · Recall match</strong><span>A CPSC recall matches the safety gate in your nest — added from a receipt photo 8 months ago. Tap for what to do.</span></span>
    </div>
    <figcaption>Illustration of a Magpie match alert — this is the product, not this page.</figcaption>
  </figure>
</section>`;

  const feedCards = [];
  rest.forEach((a, i) => {
    feedCards.push(alertCard(a));
    if (i === capturePos - 1) feedCards.push(`</ul>${captureModule}<ul class="feed" aria-label="More alerts">`);
  });

  return `${head({ title: SITE.title, description: SITE.description, path: '/' })}
<body>
${header()}
<div class="page-hero"><div class="wrap">
  <div class="hero-copy">
    <span class="hero-eyebrow">Updated ${esc(sweptDate)} · swept on a schedule</span>
    <h1>In the news</h1>
    <p class="hero-sub">Major recalls and safety alerts from CPSC, NHTSA, FDA and USDA FSIS — in plain language: what's affected, why it matters and what to do. Free for everyone, watched by Magpie.</p>
  </div>
  <p class="status-pill ${okCount === 4 ? 'status-ok' : 'status-part'}"><span class="dot" aria-hidden="true"></span>${okCount} of 4 sources reporting · swept ${esc(sweptDate)}</p>
</div></div>

<main class="wrap" id="feed">
${featured ? `
<section class="featured" aria-labelledby="featured-h">
  <div class="glow" aria-hidden="true"></div>
  <div class="pill-row"><span class="pill-crit-dark">${SEV[featured.severity]} · ${esc(featured.source)} recall</span><time datetime="${esc(featured.date)}">${fmtDate(featured.date)}</time></div>
  <h2 id="featured-h">${esc(featured.headline)}</h2>
  <p>${esc(featured.why)} ${esc(featured.action)}</p>
  <div class="actions">
    <a class="btn btn-light" href="${esc(featured.url)}" rel="noopener">Official notice <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg></a>
    <a class="btn btn-ghost-dark" href="#early-access" data-watch="${esc(featured.headline.slice(0, 90))}">Own one? Get alerts for your stuff</a>
  </div>
</section>` : ''}

<div class="controls" data-controls hidden>
  <div class="chip-row" role="group" aria-label="Filter by category">
    <button class="chip" data-cat="all" aria-pressed="true">All</button>
    <button class="chip" data-cat="vehicles" aria-pressed="false">Vehicles</button>
    <button class="chip" data-cat="food" aria-pressed="false">Food &amp; Agriculture</button>
    <button class="chip" data-cat="drugs" aria-pressed="false">Drugs &amp; Medical Devices</button>
    <button class="chip" data-cat="consumer" aria-pressed="false">Consumer &amp; Household</button>
  </div>
  <div class="filter-row">
    <div class="search-box">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
      <label for="q" style="position:absolute;left:-9999px">Search alerts</label>
      <input id="q" type="search" placeholder="Search alerts, brands, models…" autocomplete="off">
    </div>
    <div class="select-wrap"><label for="agency" style="position:absolute;left:-9999px">Filter by agency</label>
      <select id="agency"><option value="all">All agencies</option>${sources.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></div>
    <button class="clear-btn" data-clear hidden>✕ Clear</button>
    <span class="count-line" data-count aria-live="polite"></span>
  </div>
</div>

<ul class="feed" aria-label="Recall and safety alerts">
${feedCards.join('\n')}
</ul>
${rest.length < capturePos + 1 ? captureModule : ''}

<div class="empty-state" data-empty hidden>
  <span class="plume">${plume(34)}</span>
  <h2>Nothing matches this view</h2>
  <p>No alerts match your current filters. Loosen them, or enjoy the quiet.</p>
  <button class="btn btn-dark btn-sm" data-clear>Clear filters</button>
</div>

<section class="severity-note" id="severity" aria-labelledby="sev-h">
  <h2 id="sev-h">How we rate severity</h2>
  <p><strong>Critical</strong>, <strong>Elevated</strong> and <strong>Advisory</strong> are Magpie's labels, not the agencies'. FDA and USDA FSIS recall classes map directly (Class I → Critical, Class II → Elevated, Class III → Advisory). NHTSA recalls are Critical when the agency advises "do not drive" or "park outside," or when the defect can cause loss of control or fire; otherwise Elevated. CPSC recalls are rated from the stated hazard: risks of death, entrapment, strangulation, poisoning or serious injury are Critical; fire, choking, laceration and fall hazards are Elevated; everything else is Advisory. When in doubt, read the official notice — it is always linked, and it always wins.</p>
</section>

<section class="severity-note" id="how" aria-labelledby="how-h">
  <h2 id="how-h">How this page works</h2>
  <p>Magpie sweeps the four federal recall databases on a schedule and republishes what matters, in plain language, with a direct link to every official notice. The page you're reading is the free, public half of Magpie. The other half — coming soon — knows what's in <em>your</em> home, because you photographed it once, and warns you the moment something you own is recalled or a warranty is about to lapse. <a href="#early-access">Get early access.</a></p>
</section>
</main>

<div class="sticky-cta"><a class="btn btn-dark" href="#early-access">Get early access</a></div>
${footer()}
<script src="app.js" defer></script>
</body></html>`;
}

export function renderAlertPage(a) {
  const title = `${a.headline.slice(0, 90)}${a.headline.length > 90 ? '…' : ''} — Magpie`;
  return `${head({ title, description: a.why.slice(0, 160), path: `/alerts/${a.id}.html`, ogType: 'article' })}
<body>
${header('../')}
<main class="wrap detail-page">
  <a class="back" href="../index.html">← All alerts</a>
  <article>
    <div class="meta-row" style="margin-bottom:10px">
      <span class="sev-pill ${esc(a.severity)}">${SEV[a.severity]}</span>
      <span class="src-pill">${esc(a.source)}</span>
      <time datetime="${esc(a.date)}">${fmtDate(a.date)}</time>
      <span class="cat">· ${CATS[a.category] || esc(a.category)}</span>
    </div>
    <h1>${esc(a.headline)}</h1>
    <div class="detail-section"><h2>What's affected</h2><p>${esc(a.affected)}</p></div>
    <div class="detail-section"><h2>Why it matters</h2><p>${esc(a.why)}</p></div>
    <div class="detail-section"><h2>What to do</h2><p>${esc(a.action)}</p></div>
    ${a.injuries ? `<div class="detail-section"><h2>Injuries reported</h2><p>${esc(a.injuries)}</p></div>` : ''}
    <div class="detail-actions" style="margin-top:22px">
      <a class="btn btn-dark" href="${esc(a.url)}" rel="noopener">Official notice · ${esc(a.source)} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg></a>
      <a class="btn btn-teal" href="../index.html#early-access">Own one? Get alerts for your stuff</a>
      <button class="btn btn-sm" style="color:var(--meta)" data-share data-title="${esc(a.headline.slice(0, 90))}">Share</button>
    </div>
    <p style="font-size:12.5px;color:var(--meta);margin-top:18px">Severity label is Magpie's classification — <a href="../index.html#severity">how we rate severity</a>. The official notice always wins.</p>
  </article>
</main>
${footer('../')}
<script src="../app.js" defer></script>
</body></html>`;
}

export function renderSitemap(alerts) {
  if (!SITE.baseUrl) return null;
  const urls = ['/', ...alerts.map((a) => `/alerts/${a.id}.html`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE.baseUrl}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
}
