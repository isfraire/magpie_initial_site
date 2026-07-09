/* app.js — progressive enhancement for Magpie News.
   The page is fully readable without this file; here we add filtering,
   live search, accessible expand/collapse, capture prefill and sharing. */
(function () {
  'use strict';

  /* ── Expand / collapse (keyboard-accessible, aria-synced) ── */
  document.querySelectorAll('.card-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.alert-card');
      var detail = document.getElementById(btn.getAttribute('aria-controls'));
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      card.setAttribute('data-open', String(!open));
      if (detail) detail.hidden = open;
    });
  });

  /* ── Filters + live search ── */
  var controls = document.querySelector('[data-controls]');
  if (controls) {
    controls.hidden = false; // controls are JS-only; hidden for no-JS readers
    var state = { cat: 'all', agency: 'all', q: '' };
    var cards = Array.prototype.slice.call(document.querySelectorAll('.alert-card'));
    var countEl = document.querySelector('[data-count]');
    var emptyEl = document.querySelector('[data-empty]');
    var clearBtns = document.querySelectorAll('[data-clear]');
    var featured = document.querySelector('.featured');
    var captureInFeed = document.querySelectorAll('.capture');

    function apply() {
      var q = state.q.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (c) {
        var ok =
          (state.cat === 'all' || c.dataset.cat === state.cat) &&
          (state.agency === 'all' || c.dataset.src === state.agency) &&
          (!q || c.textContent.toLowerCase().indexOf(q) !== -1);
        c.hidden = !ok;
        if (ok) shown++;
      });
      var dirty = state.cat !== 'all' || state.agency !== 'all' || q !== '';
      if (countEl) countEl.textContent = shown + ' alert' + (shown === 1 ? '' : 's') + ' · severity, then newest';
      if (emptyEl) emptyEl.hidden = shown !== 0;
      clearBtns.forEach(function (b) { b.hidden = !dirty; });
      if (featured) featured.style.display = dirty ? 'none' : '';
      captureInFeed.forEach(function (s) { s.style.display = dirty && shown === 0 ? 'none' : ''; });
    }

    controls.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        state.cat = chip.dataset.cat;
        controls.querySelectorAll('.chip').forEach(function (c) {
          c.setAttribute('aria-pressed', String(c === chip));
        });
        apply();
      });
    });

    var qInput = document.getElementById('q');
    if (qInput) qInput.addEventListener('input', function () { state.q = qInput.value; apply(); });

    var agency = document.getElementById('agency');
    if (agency) agency.addEventListener('change', function () { state.agency = agency.value; apply(); });

    clearBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        state = { cat: 'all', agency: 'all', q: '' };
        if (qInput) qInput.value = '';
        if (agency) agency.value = 'all';
        controls.querySelectorAll('.chip').forEach(function (c) {
          c.setAttribute('aria-pressed', String(c.dataset.cat === 'all'));
        });
        apply();
      });
    });

    apply();
  }

  /* ── "Own one?" → prefill capture interest ── */
  document.querySelectorAll('[data-watch]').forEach(function (link) {
    link.addEventListener('click', function () {
      var field = document.querySelector('[data-watch-field]');
      if (field) field.value = link.getAttribute('data-watch') || '';
      var email = document.getElementById('capture-email');
      if (email) setTimeout(function () { email.focus(); }, 350);
    });
  });

  /* ── Capture form: handle unconfigured endpoint honestly ── */
  var form = document.querySelector('[data-capture]');
  if (form && form.hasAttribute('data-unconfigured')) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = form.parentElement.querySelector('.fineprint');
      if (note) note.textContent = 'Signups open shortly — this build has no form endpoint configured yet (set MAGPIE_FORM_ACTION and rebuild).';
    });
  }

  /* ── Share (permalink pages) ── */
  document.querySelectorAll('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var payload = { title: btn.getAttribute('data-title') || document.title, url: location.href };
      if (navigator.share) { navigator.share(payload).catch(function () {}); return; }
      navigator.clipboard.writeText(location.href).then(function () {
        btn.textContent = 'Link copied';
        setTimeout(function () { btn.textContent = 'Share'; }, 1800);
      });
    });
  });
})();
