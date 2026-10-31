# Lux Co South optimization report

Measured locally on the same 669-watch, 23-brand catalog. Browser values are Chromium CDP encoded transfer bytes from `http://127.0.0.1:4173` with the local server simulating Hosting cache headers. Tests rejected production watch-image requests and unexpected third-party origins. Google Fonts and Firebase CDN bytes are excluded from the local Hosting totals.

| Metric | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Total Hosting artifact | 162,007,163 bytes | 73,636,880 bytes | 54.5% |
| Product image files | 153,984,586 bytes | 70,742,042 bytes | 54.1% |
| Homepage cold desktop transfer | 5,692,432 bytes | 1,000,412 bytes | 82.4% |
| Catalog first 24 cold desktop transfer | 6,986,647 bytes | 1,244,728 bytes | 82.2% |
| Catalog image transfer | 6,509,669 bytes | 747,651 bytes | 88.5% |
| Catalog image requests | 27 requests | 27 requests | 0.0% |
| Catalog repeat visit transfer | 0 bytes | 0 bytes | n/a |
| Homepage JavaScript and CSS transfer | 180,912 bytes | 168,615 bytes | 6.8% |
| Homepage cold mobile transfer | 4,642,722 bytes | 792,422 bytes | 82.9% |

Product image file count: 668 before, 1318 after. The after artifact contains separate thumbnail and detail variants. Exact duplicate image copies: 9 before, 0 after.

The repeat-visit benchmark transferred zero bytes in both builds because the local server provided cache headers and Chromium reused its cache. The image-request count also remained the same; each request now transfers a smaller image. Monthly Firebase Hosting bandwidth, Google Sheets API calls, Firestore reads, and deployment storage were not measured here and cannot be inferred from these local values.

The public Sheet export intermittently returned empty brand tabs (CHARRIOL during the first build attempt and Bvlgari during the latest source check). This artifact optimizes the previously deployed catalog snapshot and marks its provenance as `cached-hosting-catalog`. The staged full-build path validates all tabs before replacing `dist`; a fresh Sheet build needs healthy exports before publication. No production services or data were changed.

Checks: catalog routes and product references, all image decodes and bounds, image content hashes and duplicates, local-origin browser network, desktop and mobile transfer, Firestore rules, and admin browser behavior. See `reports/network-before.json`, `reports/network-after.json`, and `dist/api/image-pipeline-report.json` for raw evidence.
