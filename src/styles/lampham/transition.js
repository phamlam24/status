// @ts-nocheck — plain browser script inlined as-is (apps with checkJs would flag it)
/*
  Cross-app transition driver — pairs with ./transition.css.
  Classic script, must run in <head> before first paint: SuiteHead inlines
  it (comments stripped); server-auth serves it as /assets/transition.js.
  Never delays navigation: a click only sets flags, the browser starts
  loading the next app at once and the close animation fills that wait.
  The target app comes from the link's subdomain, or data-lp-app="<id>".
*/
(function () {
  var html = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var SUB = { '': 'home', climbing: 'climb', sprout: 'sprout', learn: 'learn', status: 'status', auth: 'auth' };

  // localhost counts as the suite so local dev across ports gets the close/open (no accent morph).
  function isSuite(h) { return h === 'localhost' || h === '127.0.0.1' || h === 'lampham.space' || h.slice(-14) === '.lampham.space'; }
  function appFor(u) {
    if (u.hostname === 'lampham.space') return 'home';
    return u.hostname.slice(-14) === '.lampham.space' ? SUB[u.hostname.split('.')[0]] || null : null;
  }
  // Another suite app = suite host on a different origin (same-origin moves keep base.css's view-transition fade).
  function otherApp(u) { return u.origin !== location.origin && isSuite(u.hostname); }

  // Opening: a fresh navigation (not reload/back) from another suite app.
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    var ref = document.referrer && new URL(document.referrer);
    if (ref && otherApp(ref) && (!nav || nav.type === 'navigate')) {
      html.setAttribute('data-lp-enter', '');
      setTimeout(function () { html.removeAttribute('data-lp-enter'); }, 600);
    }
  } catch (e) {}

  // Closing: click on a link to another suite app.
  var origApp = html.getAttribute('data-app'), origLabel = null, safety;

  function reset() {
    html.removeAttribute('data-lp-leaving');
    if (origApp) html.setAttribute('data-app', origApp);
    var crumb = document.querySelector('[data-lp-crumb]');
    if (crumb && origLabel !== null) crumb.textContent = origLabel;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    var u = new URL(a.href, location.href);
    if (!otherApp(u)) return;

    var to = a.getAttribute('data-lp-app') || appFor(u);
    var crumb = document.querySelector('[data-lp-crumb]');
    if (to) {
      html.setAttribute('data-app', to);
      if (crumb) { if (origLabel === null) origLabel = crumb.textContent; crumb.textContent = to; }
    }
    html.setAttribute('data-lp-leaving', '');
    var pop = document.querySelector('.lp-switcher:popover-open');
    if (pop) pop.hidePopover();
    // If the navigation never commits (download, 204, blocked), come back.
    clearTimeout(safety);
    safety = setTimeout(reset, 8000);
  });

  // Back/forward cache restores the page mid-"closed": undo it.
  addEventListener('pageshow', function (e) { if (e.persisted) { clearTimeout(safety); reset(); } });
})();
