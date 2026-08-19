# Updating the HSE pay scales

When the Department of Health publishes a new Consolidated Salary Scales edition (watch https://healthservice.hse.ie/staff/pay/pay-scales/):

1. Download the new PDF into `docs/hse/sources/` alongside the old ones.
2. Update `data/nchd_scales_june_2026.json` (rename to the new edition date): add the new effective-date row to each grade's `scales`, keep the previous rows so old shifts still price correctly, and update `_meta`. Hand-check every NCHD figure against pp 5-7 of the PDF; a new row should be within about 1 percent of the previous one, anything else is a transcription error.
3. Bump the edition string shown in the app (the "HSE scale ..." label comes from the newest key in the JSON, so verify it displays the new date).
4. Run the test suite (`?test=1`) and update the expected hourly figures in the HSE test block.
5. Update the About panel source link if the PDF URL changed, and bump the service worker cache version in `sw.js` so installed phones fetch the new data file.
