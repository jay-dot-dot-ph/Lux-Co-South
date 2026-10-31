import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const base = 'http://127.0.0.1:4173';
const env = await initializeTestEnvironment({ projectId: 'demo-lux-co-south', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
const errors = [];
async function account(label) {
  const email = `lux-${label}-${Date.now()}@example.com`, password = 'TestPassword123!';
  const result = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const user = await result.json();
  assert(result.ok, JSON.stringify(user));
  return { email, password, uid: user.localId };
}
async function login(page, user) {
  await page.goto(`${base}/admin/`);
  await page.locator('#login-form').waitFor();
  await page.locator('input[name=email]').fill(user.email);
  await page.locator('input[name=password]').fill(user.password);
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('.lux-admin-header').waitFor();
}
try {
  await env.clearFirestore();
  const owner = await account('owner'), staff = await account('staff'), admin = await account('admin');
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'luxStaff', owner.uid), { role: 'owner', active: true, displayName: 'Owner', email: owner.email });
    await setDoc(doc(db, 'luxStaff', admin.uid), { role: 'admin', active: true, displayName: 'Admin', email: admin.email });
  });

  const ownerPage = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  ownerPage.on('pageerror', error => errors.push('owner: ' + error.message));
  await ownerPage.goto(`${base}/admin/`);
  await ownerPage.locator('#login-form').waitFor();
  assert.equal(await ownerPage.locator('html').getAttribute('data-theme'), 'dark');
  const darkBackground = await ownerPage.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
  await ownerPage.locator('button[data-theme]').click();
  assert.equal(await ownerPage.locator('html').getAttribute('data-theme'), 'light');
  assert.notEqual(await ownerPage.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), darkBackground);
  await ownerPage.reload();
  await ownerPage.locator('#login-form').waitFor();
  assert.equal(await ownerPage.locator('html').getAttribute('data-theme'), 'light');
  await ownerPage.locator('button[data-theme]').click();
  await login(ownerPage, owner);

  const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
  guest.on('pageerror', error => errors.push('guest: ' + error.message));
  await guest.goto(`${base}/watch/AP-W001/`);
  await guest.locator('[data-inquire=AP-W001]').first().waitFor();
  await guest.locator('[data-inquire=AP-W001]').first().click();
  await guest.locator('#lux-message').fill('Is this watch available?');
  await guest.locator('.lux-chat-form button').click();
  await guest.locator('.lux-chat-bubble.out').filter({ hasText: 'Is this watch available?' }).waitFor();

  await ownerPage.locator('.lux-inbox-row').first().waitFor();
  await ownerPage.locator('.lux-inbox-row').first().click();
  await ownerPage.locator('.lux-product-button').waitFor();
  const image = ownerPage.locator('.lux-product-photo img').first();
  await image.waitFor({ state: 'visible' });
  let imageBox;
  for (let attempt = 0; attempt < 10; attempt++) {
    imageBox = await image.boundingBox().catch(() => null);
    if (imageBox?.width >= 85) break;
    await ownerPage.waitForTimeout(150);
  }
  assert(imageBox?.width >= 85, 'Product thumbnail is larger');
  await image.hover();
  await ownerPage.waitForTimeout(300);
  assert.notEqual(await image.evaluate(el => getComputedStyle(el).transform), 'none', 'Hover zoom scales the image');
  await ownerPage.locator('.lux-product-button').first().click();
  await ownerPage.locator('.lux-image-modal').waitFor();
  assert.match(await ownerPage.locator('.lux-image-modal').innerText(), /AP-W001/);
  await ownerPage.setViewportSize({ width: 390, height: 844 });
  assert.equal(await ownerPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await ownerPage.keyboard.press('Escape');
  assert.equal(await ownerPage.locator('.lux-image-modal').count(), 0);
  await ownerPage.locator('.lux-product-button').first().click();
  await ownerPage.locator('.lux-image-backdrop').click({ position: { x: 5, y: 5 } });
  assert.equal(await ownerPage.locator('.lux-image-modal').count(), 0);
  await ownerPage.setViewportSize({ width: 1280, height: 820 });

  const reply = ownerPage.locator('#admin-message');
  await reply.fill('   ');
  await reply.press('Enter');
  assert.equal(await ownerPage.locator('.lux-chat-bubble.out').count(), 0, 'Blank reply is not sent');
  await reply.fill('First line');
  await reply.press('Shift+Enter');
  await reply.type('second line');
  assert.match(await reply.inputValue(), /First line\nsecond line/);
  await reply.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })));
  assert.match(await reply.inputValue(), /First line\nsecond line/);
  await reply.press('Enter');
  await ownerPage.locator('.lux-chat-bubble.out').filter({ hasText: 'First line' }).waitFor();
  assert.equal(await ownerPage.locator('.lux-chat-bubble.out').filter({ hasText: 'First line' }).count(), 1, 'Reply is sent once');
  await guest.locator('.lux-chat-bubble.in').filter({ hasText: 'First line' }).waitFor();
  assert.equal(await ownerPage.locator('#admin-message').inputValue(), '');
  await ownerPage.waitForFunction(() => document.activeElement?.id === 'admin-message');
  await ownerPage.evaluate(() => {
    window.__chimeCount = 0;
    const Original = window.AudioContext;
    window.AudioContext = class extends Original { constructor() { super(); window.__chimeCount++; } };
  });
  await guest.locator('#lux-message').fill('One more question');
  await guest.locator('.lux-chat-form button').click();
  await ownerPage.locator('.lux-chat-bubble.in').filter({ hasText: 'One more question' }).waitFor();
  assert((await ownerPage.evaluate(() => window.__chimeCount)) >= 1, 'Incoming message triggers a notification sound');
  await ownerPage.locator('[data-status]').selectOption('open');
  await ownerPage.locator('[data-view=staff]').click();
  await ownerPage.locator('#staff-form').waitFor();
  await ownerPage.locator('input[name=uid]').fill(staff.uid);
  await ownerPage.locator('input[name=name]').fill('Support Staff');
  await ownerPage.locator('input[name=email]').fill(staff.email);
  await ownerPage.locator('#staff-form button').click();
  await ownerPage.locator('.lux-staff-row').filter({ hasText: staff.uid }).waitFor().catch(async error => {
    console.error('Staff form diagnostic:', await ownerPage.locator('.lux-chat-error').allTextContents(), await ownerPage.locator('#staff-form input').evaluateAll(inputs => inputs.map(input => [input.name, input.value])));
    throw error;
  });
  ownerPage.once('dialog', dialog => dialog.accept());
  await ownerPage.locator(`[data-staff-active="${staff.uid}"]`).click();
  await ownerPage.locator('.lux-staff-row').filter({ hasText: staff.uid }).filter({ hasText: 'Disabled' }).waitFor();
  await ownerPage.locator(`[data-staff-active="${staff.uid}"]`).click();
  await ownerPage.locator('.lux-staff-row').filter({ hasText: staff.uid }).filter({ hasText: 'Active' }).waitFor();

  const staffPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  staffPage.on('pageerror', error => errors.push('staff: ' + error.message));
  await login(staffPage, staff);
  assert.equal(await staffPage.locator('[data-view=staff]').count(), 0);
  assert.equal(await staffPage.locator('.lux-inbox-row').count(), 0);
  await ownerPage.locator('[data-view=chat]').click();
  await ownerPage.locator('.lux-inbox-row').first().click();
  await ownerPage.locator('[data-assign]').selectOption(staff.uid);
  await staffPage.locator('.lux-inbox-row').first().waitFor();
  await staffPage.locator('.lux-inbox-row').first().click();
  assert.equal(await staffPage.locator('[data-block]').count(), 0);
  assert.equal(await staffPage.locator('[data-delete-chat]').count(), 0);
  assert.equal(await staffPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

  const adminPage = await browser.newPage();
  adminPage.on('pageerror', error => errors.push('admin: ' + error.message));
  await login(adminPage, admin);
  await adminPage.locator('.lux-inbox-row').first().click();
  assert.equal(await adminPage.locator('[data-block]').count(), 1);
  assert.equal(await adminPage.locator('[data-delete-chat]').count(), 0);
  adminPage.once('dialog', dialog => dialog.accept());
  await adminPage.locator('[data-block]').click();
  await adminPage.locator('[data-block]').filter({ hasText: 'Unblock' }).waitFor();
  await adminPage.locator('[data-block]').click();
  await adminPage.locator('[data-block]').filter({ hasText: 'Block' }).waitFor();
  await adminPage.waitForFunction(() => {
    const button = document.querySelector('[data-block]');
    return button && !button.disabled && button.textContent.trim() === 'Block';
  });
  ownerPage.once('dialog', dialog => dialog.accept());
  await ownerPage.locator('[data-delete-chat]').click();
  await ownerPage.locator('.lux-inbox-row').waitFor({ state: 'detached' }).catch(async error => {
    console.error('Delete diagnostic:', await ownerPage.locator('.lux-chat-error').allTextContents());
    throw error;
  });
  assert.deepEqual(errors, []);
  console.log('Admin parity browser: theme colors and persistence, roles, staff grant and disable, assignment, status, image modal and zoom, Enter/Shift+Enter/IME, blank and duplicate reply guards, focus, real-time reply and sound, block/unblock, delete, mobile layout passed.');
} finally {
  await browser.close();
  await env.cleanup();
}
