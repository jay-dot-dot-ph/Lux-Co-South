# Automatic updates from the Lux Co South Sheet

The production catalog is built from the [2026 WATCHES - LUX CO Google Sheet](https://docs.google.com/spreadsheets/d/1qowXiNelPflvWPYv1lWWCf7z9AnltCL5Tem8Sus-arI/edit). The Sheet-bound Apps Script dispatches the first manual edit immediately. Further edits are combined into at most one request per minute. GitHub checks the public brand tabs every five minutes as a fallback and runs a full build hourly for photo-only changes. The build and Firebase deployment take additional time after a request is dispatched.

## One-time GitHub Hosting credential

Add the Firebase service-account JSON for project `lux-co-south` as the repository Actions secret `FIREBASE_SERVICE_ACCOUNT_LUX_CO_SOUTH`. The service account needs Firebase Hosting deployment permission. Store the JSON only in the GitHub secret, never in this repository. The workflow cannot publish without this credential.

After the secret is set, run [Refresh catalog and deploy Firebase Hosting](https://github.com/jay-dot-dot-ph/Lux-Co-South/actions/workflows/firebase-hosting.yml) once using **Run workflow**. The workflow builds, validates, and publishes the live site. Later Sheet changes are handled by the scheduled checks even if the Apps Script is not installed.

## Install the one-minute edit trigger

1. Create a [fine-grained GitHub personal access token](https://github.com/settings/personal-access-tokens/new) for `jay-dot-dot-ph/Lux-Co-South` with repository **Actions: Read and write** permission. Set an expiration reminder. Do not paste the token into chat or source code.
2. Open the source Sheet, choose **Extensions > Apps Script**, and paste [sheet-edit-trigger.gs](sheet-edit-trigger.gs) into `Code.gs`. A standalone Apps Script project also works if you have edit access to the Sheet.
3. In **Project Settings > Script Properties**, add `GITHUB_ACTIONS_TOKEN` with the token as its value.
4. Run `setupSheetTriggers` once and approve the Google authorization prompts. This installs edit, change, and one-minute timer triggers. Run `requestCatalogRefresh` once to verify a new `workflow_dispatch` run appears in GitHub Actions.

`getSheetTriggerStatus` reports installed triggers, the last dispatch, pending edits, and failures without exposing the token. A failed request retries up to five times, then pauses; correct the access problem and run `requestCatalogRefresh`. Edits made by scripts or APIs may not fire the Sheet edit trigger, so the scheduled GitHub check remains necessary. If a build fails, the last deployed site remains live and the GitHub run shows the error.

After each successful deployment, the workflow keeps the current live release and deletes older finalized Hosting versions. This prevents old rollouts from accumulating in Hosting storage.
