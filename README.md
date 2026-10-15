# ShiftPay

A simple web app for shift workers to calculate gross pay across different pay bands (standard hours, nights, weekends, bank holidays etc.).

Each user sets up their own hourly rates on their device. Log shifts and the app automatically calculates how hours split across bands and totals up gross pay.

## How to use

Open the link, go to Setup and enter your hourly rates, then use Log Shift to record shifts. Summary shows your running total.

## Live app

[shiftpay](https://aoibhintb.github.io/Shiftpay/)

## Editions

ShiftPay is one app that can present itself as different editions. The edition is chosen by the link a person first opens; the device remembers it after that, so the link is only needed once.

There are two, split on which payroll a person is on, because that is what decides how their deductions work.

| Audience | Link |
|---|---|
| HSE payroll | https://aoibhintb.github.io/Shiftpay/?for=hse |
| Agency, locum or anyone else (the default) | https://aoibhintb.github.io/Shiftpay/?for=locum |
| Plain link, same as locum | https://aoibhintb.github.io/Shiftpay/ |

`base` is kept internally as an alias of `locum` so that devices which stored it before the two were merged keep working untouched.

The part after the `?` is read by the app itself in the browser, not by the server, so every link serves the same page. GitHub Pages has no list of these links; this table is the record of them.

Editions change what is visible, which defaults are set up, and which deduction model the net pay estimate uses: the locum edition assumes agency PAYE, the HSE edition assumes HSE payroll. Gross pay calculation is identical in both, so shifts already logged keep their totals if a device ever changes edition.

## Developing

No build step. Edit `index.html`, bump the cache version string at the top of `sw.js`, and deploy by pushing to `main` (GitHub Pages serves the repo root).

To run locally: `python3 -m http.server 8000` in the repo folder, then open `http://localhost:8000`. Append `?for=hse` or `?for=locum` to try an edition, and `?test=1` to run the built-in calculation test suite. Local data is stored per browser and per port, so localhost testing never touches the live app's data.
