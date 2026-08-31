# HSE NCHD pay rules — portable specification

This document is a self-contained export of the pay logic implemented in ShiftPay's HSE edition, written to be re-implemented in any language or app. It captures the rules, the constants, the edge cases, the modelling assumptions, and a set of verification vectors so a port can prove it produces identical numbers.

Sources: NCHD Contract 2010 (July 2020 version), s.5, s.10-13, Appendix I; HSE HR Circular 031/2021 (Appendix A reissued in HR Circular 016/2023); HSE Consolidated Salary Scales, 1 June 2026. Both PDFs are archived in `docs/hse/sources/`.

Companion data files (ship them with the port, they are the canonical datasets):

- `data/nchd_scales_june_2026.json` — five NCHD grades, every salary point, at both the 1 Feb 2026 and 1 June 2026 rates.
- `data/ie_public_holidays.json` — Irish public holidays 2026-2027.

---

## 1. Basic hourly rate

```
hourly = annual_salary_point / 52.18 / 39
```

- 52.18 = weeks per year (from the Guide to the Scales in the HSE pay-scales PDF). 39 = the contracted basic week in hours (Contract s.5a).
- **Date-aware scale selection:** each grade has multiple effective-date rows. For a shift dated D, use the newest row whose effective date <= D; if D precedes all rows, use the earliest. (A shift on 15 May 2026 prices on the 1 Feb 2026 row; 15 June 2026 on the 1 June row.)
- Grades and their point counts: Intern (1), SHO (7), Registrar (6), Specialist Registrar (7), Senior Registrar (7). Grade codes 1554, 1012, 1538, 1628, 1627.
- The user may override the computed hourly with a manual figure; the override then feeds every rule below identically.
- Sanity anchor: SHO point 1, June 2026 = 55,292 / 52.18 / 39 = **EUR 27.17/hr**.

## 2. Time model

All pricing walks the shift in **15-minute slots**. Each slot knows its calendar date (overnight shifts roll into the next day), its Irish day-of-week (Monday=0 ... Sunday=6), and its time of day. Hours accumulate at 0.25 per slot. Every rule below is a per-slot decision; a shift's pay is the sum of its slots.

- Sunday = midnight Saturday night to midnight Sunday night (the calendar Sunday).
- Public holidays come from the data file and run midnight to midnight; no user flag, purely date-driven.
- Unpaid breaks do not exist in the HSE flow (break minutes are forced to zero).

## 3. Slot classification (ordinary shifts)

Standard (core) hours are **Monday-Thursday 09:00-17:00 and Friday 09:00-16:00** (= exactly 39 h/week). Classification per slot, first match wins:

| Condition | Label | Rate |
|---|---|---|
| Slot date is a public holiday | Public holiday | 2.0 x T |
| Slot is on Sunday | Sunday | 2.0 x T |
| Slot inside the standard window | Basic | 1.0 x T |
| Anything else | Overtime | 1.5 x T |

- Overtime multipliers (1.5 Mon-Sat, 2.0 Sun/PH) are the post-1-July-2021 restored rates per HR Circular 031/2021. Keep them as configuration, not inline literals.
- **Shift work premium** (Contract s.10b, T+1/6): if the user's profile flag is on, add 1/6 x T to every *Basic* slot (never to overtime). Contractually this premium is for continuous rotating shift work in Emergency Departments; the app exposes it as a generic "Shift work" opt-in.

## 4. Rostered night shifts (Contract s.11)

A per-shift flag marks a shift as rostered night duty **within the core 39 hours** (not overtime). When set, classification above is replaced for that shift:

- Every slot earns **Basic 1.0 x T**.
- Plus, per slot, exactly one premium (no stacking, listed by precedence):
  - Public holiday slot: **+1.0 x T** ("Public holiday premium")
  - Sunday slot: **+1.0 x T** ("Sunday premium")
  - Slot in the night window, if the duty qualifies: **+0.25 x T** ("Night premium")
- Qualification: the duty must include **at least 3 hours between 00:00 and 07:00**. A 16:00-00:00 twilight marked as rostered night gets no night premium (all Basic).
- Night window: **20:00-08:00**, extended to **17:00-08:00 when the duty starts at exactly 17:00**.
- Shift work premium, when on, adds **+1/6 x T to every slot** of a rostered night shift (rotating rosters are what s.10b covers).

## 5. Unrostered overtime (the rostered-until boundary)

A per-shift optional time, `rosteredUntil` = when the shift was *rostered* to finish. Semantics:

- Convert to absolute minutes from shift start (if the time is before the start time-of-day, add 24 h — same wrap rule as everything else).
- Every slot at or after the boundary is **Unrostered overtime**: rate 2.0 x T on Sunday/public-holiday slots, otherwise 1.5 x T. This **overrides all other classification** — including the standard window (staying 09:00-10:00 after a night shift is unrostered overtime, not basic time) and the night rules. No shift-work premium on these slots.
- Boundary equal to the shift start = the whole shift is unrostered.
- Empty/invalid boundary = no unrostered segment (not an error).
- Purpose: rostered and unrostered overtime are routed to different payslips (s.8), and the contract treats unrostered overtime as its own approved category (s.12e).

## 6. Off-site on-call (Contract s.13 + Appendix I)

A per-shift flag `offsite` marks the whole span as on-call from home, with optional `callIns: [{start, end}, ...]` segments for time actually worked on site. Call-in times wrap like breaks: a time before the shift start belongs to the next day; segments must fall inside the shift and not overlap.

**Pooling:** all off-site hours are pooled per week, **Monday to Sunday**; a shift belongs to the week containing its start date. For each shift: `H_e` = off-site hours excluding call-ins, `S_e` = those falling on Sunday. Week totals `H = sum(H_e)`, `S = sum(S_e)`.

**Weekly formula** (equivalent to the contract's tiers):

```
protected = min(H / 2, 10)        # hours, at +0.75 T on top of the 0.5 T
sundayUp  = min(S, 8)             # hours, at +0.75 T on top
week_T_hours = 0.5*H + 0.75*protected + 0.75*sundayUp
```

**Per-shift attribution** (the app shows ONE on-call figure per shift):

```
share_T = 0.5*H_e + 0.75*protected*(H_e/H) + 0.75*sundayUp*(S_e/S)   # S term 0 if S == 0
amount  = share_T * that_shift's_hourly
```

**Call-ins** are paid *instead of* (never on top of) the off-site rate for those slots, at the ordinary overtime rates: 1.5 x T Mon-Sat, 2.0 x T Sunday/PH; a call-in slot inside the standard window still prices as overtime (you were not rostered on site). If the shift has a `rosteredUntil` boundary, call-in slots after it route to the unrostered payslip bucket ("Called in (unrostered)") — same rate, different payslip.

- No public-holiday uplift exists on off-site hours (the contract only provides the Sunday one). PH-day off-site hours pool like any others.
- Off-site shifts have no shift-work or night premiums; the pool formula is everything.

## 7. Payslip routing (arrears)

Four independent buckets, each 0 / 1 / 2 payslips in arrears, user-configured:

| Bucket | Covers |
|---|---|
| Basic pay | Basic rows (and rostered-night Basic rows) |
| Rostered overtime and premiums | Overtime, Sunday, Public holiday, Night/Sunday/PH premiums, ED/shift-work premium, ordinary call-ins |
| Unrostered overtime | Unrostered overtime rows, call-in portions after the boundary |
| Off-site call | The pooled on-call figure |

**Snapshot principle (load-bearing):** at save time, each shift stores its own copy of: hourly, annual, scale edition, grade, point, shift-work flag, rostered-night flag, rosteredUntil, and the four bucket settings. All later recomputation uses the shift's stored values. Changing any profile setting affects only future shifts; history stays priced and routed as it was actually worked and paid.

## 8. Attribution across days

Overnight shifts split their pay across the calendar days they cover (per-slot dates). The pooled off-site amount is attributed to a shift's days pro-rata by off-site hours per day. Day-level attribution feeds payslip-period assignment; each row then shifts by its bucket's arrears setting.

## 9. Documented modelling assumptions

State these to users; they are deliberate simplifications or decisions where the contract is silent:

1. Overtime is what falls outside the standard window / after the boundary. The contract's 4-week averaging of the 39-hour week (s.12a) is **not** modelled.
2. During a call-in, off-site pay is **replaced** by the overtime rate (s.13d read as replacement, not stacking).
3. No public-holiday uplift on off-site hours.
4. On rostered nights, Sunday/PH premium **replaces** the night premium where they overlap (higher wins; stacking unspecified in the contract).
5. Shift-work premium never applies to overtime hours.
6. The standard-hours window assumes the common daytime core roster; rostered nights are handled by the explicit flag, not inferred.
7. Every figure is a gross estimate to be checked against a payslip.

## 10. Verification vectors

All with SHO point 1, June 2026: `T = 55292/52.18/39 = 27.170247.../hr` (display 27.17). Amounts to the cent; a port should match within +/- EUR 0.02. Dates chosen so Mon 2026-07-13 ... Sun 2026-07-19; 2026-06-01 is a public holiday (Monday).

| # | Input | Expected |
|---|---|---|
| 1 | Sun 2026-07-19, 10:00-11:00, ordinary | 1h Sunday @2T = 54.34 |
| 2 | PH Mon 2026-06-01, 10:00-11:00, ordinary | 1h Public holiday @2T = 54.34 |
| 3 | Wed 2026-07-15, 09:00-10:00, shift-work flag on | (1+1/6)T = 31.70 |
| 4 | Wed 2026-07-15, 20:00-08:00, ordinary | 12h Overtime @1.5T = 489.06 |
| 5 | Wed 2026-07-15, 16:00-00:00, ordinary | 1h Basic + 7h Overtime = 312.46 |
| 6 | Wed 2026-07-15, 20:00-08:00, rostered night | 12h Basic + 12h night prem @0.25T = 15T = 407.55 |
| 7 | Wed 2026-07-15, 17:00-08:00, rostered night (17:00 window ext.) | 15T + 3.75T = 18.75T = 509.44 |
| 8 | Sun 2026-07-19, 20:00-08:00, rostered night | 12 Basic + 4 Sunday prem + 8x0.25 night = 18T = 489.06 |
| 9 | Wed 2026-07-15, 16:00-00:00, rostered night (fails 3h test) | 8h Basic only = 217.36 |
| 10 | Wed 2026-07-15, 20:00-08:00, rostered night + shift work | 15T + 12/6 T = 17T = 461.89 |
| 11 | Wed 2026-07-15, 09:00-21:00, rosteredUntil 19:00 | 8 Basic + 2 OT@1.5 + 2 UnroOT@1.5 = 14T = 380.38 |
| 12 | Rostered night Wed 20:00-10:00, rosteredUntil 08:00 | 12 Basic + 3 night prem + 2h UnroOT@1.5 = 18T = 489.06 (the 09:00-10:00 hour is unrostered OT, not basic) |
| 13 | Sat 2026-07-18, 20:00-10:00, rosteredUntil 08:00 | Unrostered rows: 2h on Sunday @2T = 108.68 |
| 14 | Wed 2026-07-15, 10:00-12:00, rosteredUntil 10:00 | whole shift unrostered: 2h @1.5T = 81.51 |
| 15 | Off-site formula direct: H=54, S=9 | 40.5 T-hours = 1100.40 |
| 16 | Off-site edge: H=12, S=0 | 10.5 T-hours (protected below cap) |
| 17 | Off-site edge: S=24 | Sunday uplift capped at 8h |
| 18 | Off-site Wed 17:00-09:00, call-in 07:00-09:00, rosteredUntil 08:00 | Called in 1h + Called in (unrostered) 1h, both @1.5T |

**Full worked week** (the contract's Appendix I example, logged as three shifts):

- Mon 2026-07-13 17:00-09:00 off-site, no call-ins (H_e=16, S_e=0)
- Wed 2026-07-15 17:00-09:00 off-site, call-in 02:00-04:00 (H_e=14, S_e=0, CI 2h)
- Sat 2026-07-18 09:00-09:00 (24h) off-site (H_e=24, S_e=9)

Week: H=54, S=9, protected=10, sundayUp=8. Expected per shift: Mon on-call 277.74; Wed on-call 243.02 + call-in 81.51; Sat on-call 579.63 (includes the whole Sunday share). **Week total 1181.91** = pooled 1100.40 + call-in 81.51.

## 11. Updating the data

See `docs/hse/UPDATING.md`: a new pay-scales edition is a data change (add the new effective-date row per grade, keep old rows for old shifts), not a code change. Public holidays need a new year's dates added annually.
