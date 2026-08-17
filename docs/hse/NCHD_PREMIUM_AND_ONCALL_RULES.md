# NCHD premium, overtime and off-site on-call rules — handoff for Claude Code

Scope: **medical (NCHD) grades only** — Intern, SHO, Registrar, SpR, Senior Registrar. Basic salaries are in `nchd_scales_june_2026.json`. This file covers what sits on top of basic.

**Important:** none of the on-call / premium logic is in the HSE pay-scales PDF. It lives in the **NCHD Contract 2010 (as amended, July 2020 version)**, Sections 11–13 and Appendix I:
https://www.imo.ie/i-am-a/nchd/nchd-contract/NCHD-Contract-2010-July-2020.pdf

Download that PDF into `data/sources/` too.

---

## 1. Base hourly

`hourly = annual_salary_point / 52.18 / 39`  (39-hour contracted week incl. paid lunch — Contract s.5a)

Overtime is measured against **39 h/week averaged over a 4-week roster period (156 h)** — s.12a. Hours above that are overtime.

## 2. Premiums on rostered/core hours (Contract s.11)

| Situation | Rate | Notes |
|---|---|---|
| Sunday, normal rostered hours | **T + 1** (single time extra → 2T total) | per hour worked |
| Public holiday, normal rostered hours | **T + 1** (2T total) | PH = midnight eve → midnight PH |
| Night duty 20:00–08:00 | **T × 1.25** | Only if rostered *through* the night (≥3 h between 00:00–07:00). Not for 24-h call or twilight shifts. Window extends to 17:00–08:00 if the duty starts at 17:00 and runs through. |
| ED continuous rotating shift (24/7 cycle) | shift premium **T + 1/6** on core 39 h | s.10b |

## 3. Overtime = on-call **on-site** beyond 39 h avg (Contract s.12; rates per HSE HR Circular 031/2021 & 016/2023)

| Day | Rate (current, since 1 July 2021) |
|---|---|
| Mon–Sat | **T × 1.5** (time and a half) |
| Sunday (Sat 24:00 → Sun 24:00) | **T × 2** |
| Public holiday | **T × 2** |

History, so nobody "corrects" it back: the 2010 contract had T×1.5; Haddington Road (July 2013) cut it to T×1.25 — that is the figure printed in Appendix I of the July 2020 contract PDF; **Building Momentum s.4.1.1 restored pre-HRA rates from 1 July 2021**, implemented by DoH Circular 12/2021 / HSE HR Circular 031/2021 ("Revised Arrangements re Compensation for Overtime and Twilight Payments… restoration to pre-HRA"), with a revised Appendix A reissued as HR Circular 016/2023. That circular states on-call on-site is overtime and NCHDs get double time for all Sunday hours. So: **1.5 Mon–Sat, 2.0 Sun/PH.** Still keep it as a config value.

Sources:
- HSE HR Circular 031/2021: https://www.hse.ie/eng/staff/resources/hr-circulars/hr-circular-031-2021-revised-arrangements-re-compensation-for-overtime-and-twilight-payments-in-the-public-health-sector-restoration-of-the-tool-allowance-to-pre-hra-level-.pdf
- HSE HR Circular 016/2023 Appendix A (revised): https://www.hse.ie/eng/staff/resources/hr-circulars/hr-circular-016-2023-appendix-a-revised-.pdf
- IMT, 25 Jun 2021 "Overtime rate increase from July 1 flagged to NCHDs": https://www.imt.ie/news/overtime-rate-increase-from-july-1-flagged-to-nchds-25-06-2021/

Unrostered overtime is payable if approved by the consultant/CD (s.12e).

## 4. Off-site on-call (Contract s.13 + Appendix I) — the complicated bit

Definition: rostered off-site but available for emergency work. **Reference period is one week, Monday–Sunday.** All off-site hours in the week are pooled.

Payment for the pooled week:

1. **Half of all off-site hours, capped at 10 hours** → paid at **T × 1.25**
2. **All remaining off-site hours** → paid at **T × 0.5**
3. **Sunday uplift (additive, separate from the 10-hour cap):** the first 8 off-site hours between Sat midnight and Sun midnight get **an additional 0.75T** on top of whichever tier rate they already fall into. Those 8 hours are still counted in the Mon–Sun pool for steps 1–2 — they are not a third bucket and do not consume or sit inside the 10-hour tier-1 cap. Contract wording: "paid an additional 3/4 time on top of the otherwise applicable rate"; Appendix I: "an additional Sunday premium rate is due on top of the basic on call off-site rate… for a maximum of 8 hours @ ¾ time". Sunday hours after the first 8 get no extra.
4. **Called in / attend on-site:** those hours are paid at the **normal overtime rate** from s.12 (see table above), i.e. Mon–Sat OT rate, Sunday/PH 2T.

Employer also pays landline installation + rental (s.13e) — ignore for the app.

### Pseudocode

```python
def offsite_oncall_pay(hourly, week_offsite_hours, sunday_offsite_hours):
    # week_offsite_hours: total rostered off-site hours Mon–Sun (excluding hours actually worked on-site)
    # sunday_offsite_hours: how many of those fall between midnight Sat night and midnight Sun night (max 24)
    tier1 = min(week_offsite_hours / 2, 10)          # at 1.25T
    tier2 = week_offsite_hours - tier1                # at 0.5T
    sunday_uplift_hours = min(sunday_offsite_hours, 8)  # +0.75T each
    return hourly * (tier1 * 1.25 + tier2 * 0.5 + sunday_uplift_hours * 0.75)
```

Hours actually called in on-site are removed from `week_offsite_hours` and priced separately as overtime.

Equivalent closed form (easier to reason about): every off-site hour earns 0.5T; the protected hours (half of H, max 10) earn a further 0.75T; up to 8 Sunday hours earn a further 0.75T.

`pay = hourly × (0.5·H + 0.75·min(H/2, 10) + 0.75·min(S, 8))`

For any week with H ≥ 20 that collapses to `hourly × (0.5·H + 7.5 + 0.75·min(S, 8))`. Implement the general form; use the collapsed one for unit-test sanity checks.

### Worked example (SHO point 1, June 2026)

- hourly = 55,292 / 52.18 / 39 = **€27.17**
- Rostered off-site: Mon 17:00–Tue 09:00 (16 h), Wed 17:00–Thu 09:00 (16 h), Sat 09:00–Sun 09:00 (24 h, of which 9 h fall on Sunday) → 56 h off-site, 9 Sunday hours
- Called in Wed 02:00–04:00 (2 h) → off-site pool becomes 54 h; 2 h priced as Mon–Sat overtime
- tier1 = min(54/2, 10) = 10 h × 1.25 = 12.5 T-hours
- tier2 = 44 h × 0.5 = 22 T-hours
- Sunday uplift = min(9, 8) = 8 h × 0.75 = 6 T-hours
- Off-site total = 40.5 T-hours × €27.17 = **€1,100**
- Call-in = 2 h × 1.5 × €27.17 = **€82**

## 5. Ambiguities to surface in the UI / confirm with a payslip

- Whether off-site pay **keeps accruing** during a call-in, or is replaced by the OT rate for those hours. Contract wording ("once called… paid the normal overtime rate") reads as *replaced*. Model it as replaced; label it.
- The "half of all hours up to a maximum of 10" wording — I've read it as: paid hours in tier 1 = min(total/2, 10). An alternative reading (cap the *hours halved* at 20) gives the same answer whenever total ≥ 20 h, which is nearly always. Not worth agonising over.
- Public holiday falling on a weekday during off-site call: contract is silent on a PH uplift for **off-site** hours (only Sunday). Don't invent one; note it.

## 6. Where each rule comes from (for the tooltip / audit trail)

| Rule | Source |
|---|---|
| 39 h week, paid lunch | Contract s.5(a) |
| 4-week averaging for OT | Contract s.12(a) |
| Sunday/PH single time extra | Contract s.11 |
| Night premium T×1.25 | Contract s.11 |
| ED shift premium T+1/6 | Contract s.10(b) |
| OT multipliers (1.5 Mon–Sat, 2.0 Sun/PH) | HSE HR Circular 031/2021 (Building Momentum restoration, 1 Jul 2021); Appendix A revised in HR Circular 016/2023 |
| Off-site tiers, Sunday 8h uplift, Mon–Sun period | Contract s.13(c) + Appendix I |
| Call-in paid at OT rate | Contract s.13(d) |
| Salary → weekly ÷52.18 | HSE Consolidated Scales, Guide to the Scales |
