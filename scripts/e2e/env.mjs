// Loads .env.local and exposes the e2e configuration.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(ROOT, '.env.local'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

function normalizeStore(s) {
  if (!s) return '';
  return String(s).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

const store = normalizeStore(process.env.SHOPIFY_STORE);
const host = store && !store.includes('.') ? `${store}.myshopify.com` : store;

export const CFG = {
  store: host,
  baseURL: (process.env.BASE_URL || (host ? `https://${host}` : '')).replace(/\/+$/, ''),
  password: process.env.STOREFRONT_PASSWORD || '',
  previewThemeId: process.env.PREVIEW_THEME_ID || '',
};

export const MISSING_MESSAGE =
  'Skipped: set SHOPIFY_STORE (e.g. my-store.myshopify.com) or BASE_URL in .env.local. ' +
  'Optional: STOREFRONT_PASSWORD (password-protected stores) and PREVIEW_THEME_ID (test an unpublished theme).';

export const hasTarget = () => Boolean(CFG.baseURL);

/** Append the preview_theme_id query parameter when configured. */
export function withPreview(url) {
  if (!CFG.previewThemeId) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}preview_theme_id=${encodeURIComponent(CFG.previewThemeId)}`;
}
