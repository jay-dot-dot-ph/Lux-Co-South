// Copy this file into the Apps Script project bound to the 2026 WATCHES - LUX CO Sheet.
// Store the repository-scoped GitHub token in Script Properties as GITHUB_ACTIONS_TOKEN.
const LUX_SHEET_ID = '1qowXiNelPflvWPYv1lWWCf7z9AnltCL5Tem8Sus-arI';
const LUX_WORKFLOW_URL = 'https://api.github.com/repos/jay-dot-dot-ph/Lux-Co-South/actions/workflows/firebase-hosting.yml/dispatches';
const LUX_PENDING_KEY = 'LUX_PENDING_EDIT_AT';
const LUX_FIRST_PENDING_KEY = 'LUX_FIRST_PENDING_EDIT_AT';
const LUX_LAST_DISPATCH_KEY = 'LUX_LAST_DISPATCH_AT';
const LUX_LAST_ERROR_KEY = 'LUX_LAST_DISPATCH_ERROR';
const LUX_ATTEMPTS_KEY = 'LUX_DISPATCH_ATTEMPTS';
const LUX_NEXT_ATTEMPT_KEY = 'LUX_NEXT_DISPATCH_ATTEMPT_AT';
const LUX_PAUSED_KEY = 'LUX_DISPATCH_PAUSED';
const LUX_TOKEN_KEY = 'GITHUB_ACTIONS_TOKEN';
const LUX_DEBOUNCE_MS = 30 * 1000;
const LUX_MAX_WAIT_MS = 10 * 60 * 1000;
const LUX_MAX_ATTEMPTS = 5;

// Run once from the Apps Script editor after setting GITHUB_ACTIONS_TOKEN.
function setupSheetTriggers() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet || spreadsheet.getId() !== LUX_SHEET_ID) {
    throw new Error('Open the 2026 WATCHES - LUX CO spreadsheet before installing these triggers.');
  }
  if (!PropertiesService.getScriptProperties().getProperty(LUX_TOKEN_KEY)) {
    throw new Error('Set GITHUB_ACTIONS_TOKEN in Project Settings > Script Properties first.');
  }
  const handlers = ['markSheetChanged', 'dispatchPendingSheetChange'];
  for (const trigger of ScriptApp.getProjectTriggers()) {
    if (handlers.includes(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  }
  ScriptApp.newTrigger('markSheetChanged').forSpreadsheet(spreadsheet).onEdit().create();
  ScriptApp.newTrigger('markSheetChanged').forSpreadsheet(spreadsheet).onChange().create();
  ScriptApp.newTrigger('dispatchPendingSheetChange').timeBased().everyMinutes(1).create();
  return getSheetTriggerStatus();
}

// The edit and change triggers only mark the Sheet as dirty. They never send a request per cell.
function markSheetChanged(event) {
  if (!event || !event.source || event.source.getId() !== LUX_SHEET_ID) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const properties = PropertiesService.getScriptProperties();
    if (!properties.getProperty(LUX_FIRST_PENDING_KEY)) properties.setProperty(LUX_FIRST_PENDING_KEY, String(Date.now()));
    properties.setProperty(LUX_PENDING_KEY, String(Date.now()));
  } finally {
    lock.releaseLock();
  }
}

// Runs every minute and sends one rebuild request after edits have settled.
function dispatchPendingSheetChange() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const properties = PropertiesService.getScriptProperties();
    const pending = Number(properties.getProperty(LUX_PENDING_KEY));
    const firstPending = Number(properties.getProperty(LUX_FIRST_PENDING_KEY));
    if (!pending || properties.getProperty(LUX_PAUSED_KEY) === 'true') return;
    if (Date.now() - pending < LUX_DEBOUNCE_MS && Date.now() - firstPending < LUX_MAX_WAIT_MS) return;
    if (Date.now() < Number(properties.getProperty(LUX_NEXT_ATTEMPT_KEY))) return;
    const token = properties.getProperty(LUX_TOKEN_KEY);
    if (!token) {
      const error = 'GITHUB_ACTIONS_TOKEN is missing from Script Properties.';
      recordDispatchFailure(properties, error);
      throw new Error(error);
    }

    let response;
    try {
      response = UrlFetchApp.fetch(LUX_WORKFLOW_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + token,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        payload: JSON.stringify({ ref: 'main' }),
        muteHttpExceptions: true,
      });
    } catch (error) {
      recordDispatchFailure(properties, 'GitHub request failed');
      throw error;
    }
    const status = response.getResponseCode();
    if (status !== 200 && status !== 204) {
      const error = 'GitHub workflow dispatch returned HTTP ' + status;
      recordDispatchFailure(properties, error);
      throw new Error(error);
    }
    properties.deleteProperty(LUX_PENDING_KEY);
    properties.deleteProperty(LUX_FIRST_PENDING_KEY);
    properties.deleteProperty(LUX_LAST_ERROR_KEY);
    properties.deleteProperty(LUX_ATTEMPTS_KEY);
    properties.deleteProperty(LUX_NEXT_ATTEMPT_KEY);
    properties.setProperty(LUX_LAST_DISPATCH_KEY, String(Date.now()));
  } finally {
    lock.releaseLock();
  }
}

function recordDispatchFailure(properties, message) {
  const attempts = Number(properties.getProperty(LUX_ATTEMPTS_KEY)) + 1;
  properties.setProperty(LUX_ATTEMPTS_KEY, String(attempts));
  properties.setProperty(LUX_LAST_ERROR_KEY, message);
  if (attempts >= LUX_MAX_ATTEMPTS) {
    properties.setProperty(LUX_PAUSED_KEY, 'true');
  } else {
    properties.setProperty(LUX_NEXT_ATTEMPT_KEY, String(Date.now() + Math.pow(2, attempts - 1) * 60 * 1000));
  }
}

// Run this once after setup to verify a workflow dispatch without editing a product.
function requestCatalogRefresh() {
  const properties = PropertiesService.getScriptProperties();
  properties.deleteProperty(LUX_PAUSED_KEY);
  properties.deleteProperty(LUX_ATTEMPTS_KEY);
  properties.deleteProperty(LUX_NEXT_ATTEMPT_KEY);
  properties.setProperty(LUX_FIRST_PENDING_KEY, String(Date.now() - LUX_DEBOUNCE_MS));
  properties.setProperty(LUX_PENDING_KEY, String(Date.now() - LUX_DEBOUNCE_MS));
  dispatchPendingSheetChange();
  return getSheetTriggerStatus();
}

function getSheetTriggerStatus() {
  const properties = PropertiesService.getScriptProperties();
  const timestamp = (key) => {
    const value = properties.getProperty(key);
    return value ? new Date(Number(value)).toISOString() : null;
  };
  return {
    installedTriggers: ScriptApp.getProjectTriggers().map((trigger) => trigger.getHandlerFunction()),
    pendingEditAt: timestamp(LUX_PENDING_KEY),
    lastDispatchAt: timestamp(LUX_LAST_DISPATCH_KEY),
    lastError: properties.getProperty(LUX_LAST_ERROR_KEY),
    retryAttempts: Number(properties.getProperty(LUX_ATTEMPTS_KEY)) || 0,
    paused: properties.getProperty(LUX_PAUSED_KEY) === 'true',
    tokenConfigured: Boolean(properties.getProperty(LUX_TOKEN_KEY)),
  };
}
