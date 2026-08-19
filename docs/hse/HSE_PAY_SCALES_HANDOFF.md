# HSE pay scales → Shiftpay HSE edition: handoff for Claude Code

Goal: preload every HSE grade so a user picks their grade + point and the app pre-fills their basic hourly rate. Manual entry stays the source of truth; the pre-fill is a convenience labelled "estimate from HSE Consolidated Salary Scales, [date]".

## 1. Official sources (download these into the repo, e.g. `data/sources/`)

| What | URL | Why |
|---|---|---|
| **1 June 2026 Consolidated Salary Scales (current, 71 pp PDF)** | https://healthservice.hse.ie/documents/10686/1_June_2026_pay_scales.pdf | The dataset. Every grade, every point, current + previous rate. |
| DoH Circular 2/2026 (the June 2026 uplift: +1% basic, +1% allowances) | linked from the pay-scales index page below | Authority for the June figures |
| DoH Circular 1/2026 (Feb 2026 uplift: +1% or €500) | https://healthservice.hse.ie/documents/8108/Department_of_Health_circular_001_2026__1_February_2026_pay_adjustments.pdf | Explains the 1/2/26 rows |
| HSE pay-scales index (all historic versions) | https://healthservice.hse.ie/staff/pay/pay-scales/ | Watch this page for the next revision |
| Feb 2026 scales (previous edition, if you want a full second snapshot) | https://healthservice.hse.ie/documents/7508/February_2026_pay_scales.pdf | Optional |

There is no public XLSX/CSV — the PDF is the canonical machine-readable source. Parse it; don't rely on third-party salary sites.

## 2. How the PDF is laid out (so the parser knows what to expect)

Contents (page numbers are the PDF's own footer numbers):

- Medical & Dental Grades — pp 5–7  ← NCHDs live here (Intern 1554, SHO 1012, Registrar 1538, SpR 1628, Senior Registrar 1627)
- Nursing & Midwifery — pp 8–13
- Health & Social Care Professionals — pp 14–24
- General Support — pp 25–31
- Patient & Client Care — pp 32–36
- Clerical & Management Admin — pp 37–43
- Consultants — pp 44–59 (separate tab; different structure — current + historical rates)
- Allowances — pp 60–68 (on-call, living-out, etc.)
- Notional Scales — pp 69–71 (NOT active pay — skip)

Row shape in the MAIN section (reads across):

```
<grade_code> <GRADE DESCRIPTION> <effective_date d/m/yy> <n_points> <pt1> <pt2> ... <ptN> [LSI|LSIs]
             <prior effective_date> <pt1> ... <ptN>
```

- Grade codes are 4 chars, may contain letters (`183T`, `104X`, `233X`, `241Y`). Some rows carry two or three codes.
- Long descriptions wrap over several lines before the date; some carry a `**` note (obsolete / not for new incumbents / pension-purposes only).
- Each grade has ≥2 date rows: current (1/6/26) and at least one prior (usually 1/2/26; a few have odd dates like 13/4/26, 14/4/26, 10/3/26, 9/2/26, 28/11/25, 1/1/26).
- Trailing `LSI` / `LSIs` = the last 1–3 points are long-service increments (bold in the PDF; bold is lost in text extraction, so treat "LSI"/"LSIs" as a flag and infer count from context or the Guide: 1st LSI after 3 yrs on max, then +3, +3).
- Numbers use thousands commas (`70,276`).
- General Support / Patient & Client Care rows have an extra "Band" column (1–4) between the code and description.

## 3. Rows to exclude / flag

Exclude from the picker (keep in raw data if you like):
- Anything marked `** grade obsolete - not for use **`
- Anything marked `** not for use for new incumbents ... **` (flag, don't hide — existing staff still on it)
- Any `FOR PENSION PURPOSES` row (pre-2017 retirees)
- Anything `(NON-PAYPATH)` marked obsolete
- The whole Notional Scales section

## 4. Conversion rules (from the Guide to the Scales inside the PDF)

- Weekly = annual ÷ **52.18**
- Hourly = weekly ÷ standard weekly hours for the grade. **NCHDs: 39**. Many other grades: 37.5 (nursing/HSCP/admin post-HRA restoration) or 39 (support). Store `weekly_hours` per grade family; do NOT hard-code one divisor app-wide.
- Show the divisor used in the UI tooltip so a doctor can sanity-check against their payslip.

Sanity check for the parser: SHO point 1 (1/6/26) = 55,292 → 55,292 / 52.18 / 39 ≈ €27.17/hr basic.

## 5. Suggested data schema

```json
{
  "edition": "2026-06-01",
  "source_url": "...",
  "grades": [
    {
      "grade_code": "1012",
      "grade": "Senior House Officer",
      "category": "Medical & Dental",
      "band": null,
      "weekly_hours": 39,
      "status": "active",            // active | legacy | obsolete | pension_only
      "lsi_count": 0,
      "scales": {
        "2026-06-01": [55292, 58011, 62123, 64832, 70276, 72982, 75623],
        "2026-02-01": [54745, 57437, 61508, 64190, 69580, 72259, 74874]
      }
    }
  ]
}
```

Keep every dated row so a shift is priced at the rate in force on the shift date, not today's rate.

## 6. Build steps

1. Download the June 2026 PDF into `data/sources/`.
2. Write `scripts/parse_hse_scales.py` (pdfplumber or pymupdf; text layer is fine, no OCR needed). Emit `data/hse_scales_2026-06-01.json`.
3. Validate: (a) `len(points) == n_points` on every row; (b) every 1/6/26 point ≈ 1/2/26 point × 1.01 (±1 for rounding) — any row that fails is a parse error, not a data quirk; (c) spot-check against `nchd_scales_june_2026.json` (hand-verified subset shipped alongside this brief).
4. Wire the picker: category → grade → point → prefill hourly, with "HSE scale 1 June 2026" badge and a link to the PDF.
5. Add a `CHANGELOG`/`data/README` noting edition date; next revision lands when the pay-scales index page updates (next PSA step is scheduled for 2027 — check the page, don't assume).

## 7. Caveats to surface in the UI

- Basic salary only. On-call, overtime, unsocial-hours, living-out and other allowances are on pp 60–68 and are a separate engine — out of scope for the pre-fill.
- Agency/locum rates are NOT these scales; the pre-fill is only for HSE-employed users.
- Figures hand-checked for NCHD grades only; everything else is parser output until reviewed.
