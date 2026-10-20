# Lux Co South watch catalog

This site uses the **2026 WATCHES - LUX CO** Google Sheet as its catalog source. The build reads the 23 watch brand tabs, exports embedded photos, and creates a static storefront in `dist/`. Visitors can search and filter watches, view product details and stock, save favorites in their browser, copy an inquiry, and continue on the same Graceful Gifts Manila contact channels requested for this site. The production address is <https://lux-co-south.web.app>.

## Build and preview

Use Node.js 22 or newer. The Sheet must allow public Viewer access so the build can read its CSV, page preview, and workbook exports.

```powershell
npm run build
npm run check
node scripts/serve.mjs
```

Open `http://127.0.0.1:4173`. The build downloads the workbook once to recover photos that the Google Sheet page preview does not expose. That download is about 334 MB for the current catalog. Image files are hosted with the site; visitors do not need Google credentials.

Product, price, and stock changes in the Sheet are picked up by the scheduled GitHub workflow after its one-time Firebase credential is configured. See [automatic update setup](automation/README.md). The source Sheet is read only. Favorites are local to each visitor's browser; there are no accounts, cart, checkout, or payments.

## Firebase Hosting

The Firebase project is `lux-co-south`; `firebase.json` deploys `dist/`. After building and checking, deploy with:

```powershell
firebase deploy --only hosting --project lux-co-south
```

The black and gold design uses the original logo in `src/logo.jpg` and a unified design system in `src/styles.css`. The build copies both to `dist/`. GitHub Actions builds and deploys changes after the Firebase service account secret is configured.

Product URLs use `/watch/{Watch ID}/` and inquiries include the Watch ID, displayed price, and product link. Contact links currently point to Graceful Gifts Manila as requested. The GitHub repository contains the source and Firebase configuration; generated `dist/` assets are rebuilt from the Sheet before release.
