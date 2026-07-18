---
name: verify
description: How to run and verify ShiftPay (single-file PWA) changes end-to-end.
---

# Verifying ShiftPay

Single-file vanilla-JS PWA. No build step. Everything lives in `index.html`; `sw.js` only caches (bump `CACHE` on line 1 for any deploy).

## Calc engine self-tests (fast)

The page has a built-in harness: serve the repo and open `/?test=1`. It seeds known bands, runs hand-computed scenarios through `splitShift`/`splitShiftByDate`, and renders a pass/fail table (count also lands in `document.title`).

Headless, without a browser: extract the inline `<script>` and eval it in node with `location.search='?test=1'`, stubbed `document`/`localStorage`, and `getElementById` returning a stub element (top-level IIFEs call `addEventListener` on it). Read the pass count from `document.title`. The script is strict-mode, so append any extra test code to the evaluated source string rather than reaching into eval scope afterwards.

## UI verification

```bash
cd repo && python3 -m http.server 8123
```

Open `http://localhost:8123`. localStorage is per-origin (and per-port), so testing never touches the live site's or the installed PWA's data — but it does persist between local runs on the same port.

Flows worth driving after engine or form changes: set a rate in Setup (band card expands in place, Save button, "Band saved" toast), log an overnight shift on the Log tab and watch the live "This shift pays" preview + ribbon, save and check the Payslips history group totals, edit the shift from the list row, and open a calendar day sheet from the Summary tab.

Gotchas: the log form layout shifts when the "Overnight shift" note appears, so re-screenshot before clicking toggles below it; the service worker caches aggressively — use a private window or DevTools "Update on reload" when re-testing changed files.
