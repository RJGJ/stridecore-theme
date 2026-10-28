#!/usr/bin/env node
// Theme Store settings/schema rules (section 14 of the requirements) plus
// structural validation of JSON templates and section groups.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, Report, walk, rel, read, extractSchema, lineOfIndex, parseArgs } from './lib.mjs';

const args = parseArgs();
const R = new Report('schema-rules');

/* ----------------------------- configuration ----------------------------- */

// Sections that may omit presets: templates-only sections (main-*) are allowed.
// Sections rendered only through the Section Rendering API or section groups
const NO_PRESET_ALLOWLIST = [/^main-/, /^predictive-search$/, /^pickup-availability$/];
const PROPER_NOUNS = new Set([
  'Facebook', 'Instagram', 'YouTube', 'Vimeo', 'Shopify', 'Pinterest', 'TikTok', 'Twitter', 'Snapchat', 'Tumblr',
  'Spotify', 'Google', 'Apple', 'Pay', 'Wallet', 'Shop', 'Liquid', 'JSON', 'HTML', 'CSS', 'SEO', 'URL', 'FAQ', 'RSS',
  'Klaviyo', 'Mailchimp', 'LinkedIn', 'WhatsApp', 'Stridecore', 'English', 'Maps', 'Open', 'Graph',
  'Europe', 'US', 'UK', 'EU', 'Messenger', 'Venmo', 'Amazon', 'PayPal', 'Visa', 'Mastercard', 'Shopify',
]);

const BRITISH = {
  colour: 'color', colours: 'colors', coloured: 'colored', centre: 'center', centres: 'centers', centred: 'centered',
  customise: 'customize', customised: 'customized', customisation: 'customization', organise: 'organize',
  organised: 'organized', grey: 'gray', catalogue: 'catalog', dialogue: 'dialog', cancelled: 'canceled',
  cancelling: 'canceling', favourite: 'favorite', favourites: 'favorites', behaviour: 'behavior', licence: 'license',
  optimise: 'optimize', optimised: 'optimized', personalise: 'personalize', personalised: 'personalized',
  recognise: 'recognize', analyse: 'analyze', neighbour: 'neighbor', theatre: 'theater', metre: 'meter',
  jewellery: 'jewelry', programme: 'program', travelling: 'traveling', labelled: 'labeled', modelling: 'modeling',
  fulfil: 'fulfill', enrol: 'enroll', artefact: 'artifact', aluminium: 'aluminum', apologise: 'apologize',
  minimise: 'minimize', maximise: 'maximize', summarise: 'summarize', utilise: 'utilize', realise: 'realize',
  stylise: 'stylize', visualise: 'visualize', whilst: 'while', amongst: 'among', sceptical: 'skeptical',
  tyre: 'tire', cosy: 'cozy', plough: 'plow', draught: 'draft', storey: 'story', fibre: 'fiber',
  litre: 'liter', defence: 'defense', offence: 'offense', pyjamas: 'pajamas', maths: 'math',
};

// [regex, replacement advice, severity]
const TERMS = [
  [/\bhomepage\b/i, 'home page', 'error'],
  [/\bmeta-?nav\b/i, 'top bar', 'error'],
  [/\bsearch bar\b/i, 'top bar (or "search box")', 'warn'],
  [/\bbelow footer\b/i, 'bottom bar', 'error'],
  [/\bsliders?\b/i, 'slideshow', 'error'],
  [/\bcheck out\b/i, 'checkout', 'error'],
  [/\btitles?\b/i, 'heading (when naming heading settings)', 'warn'],
  [/\bsub[-\s]headings?\b/i, 'subheading', 'error'],
  [/\bmain text\b/i, 'body text', 'error'],
  [/\bsign[-\s]ups?\b/i, 'signup', 'error'],
  [/\bshortcut icon\b|\bwebsite icon\b/i, 'favicon', 'error'],
  [/\bside bar\b/i, 'sidebar', 'error'],
  [/\bbutton name\b/i, 'button label', 'error'],
  [/\bsocial sharing\b/i, 'social media', 'error'],
  [/\bsocial media buttons\b/i, 'social media icons', 'error'],
  [/\bajax(ify)?\b/i, 'cart type', 'error'],
  [/(?<![.\w])(PNG|png)\b/, '.png', 'error'],
  [/\bCTA\b/, 'button label', 'error'],
  [/\b[XY] position\b/, 'Horizontal/Vertical position', 'error'],
  [/\bmain navigation\b|\bprimary navigation\b/i, 'main menu', 'warn'],
];

const RESOURCE_TYPES = new Set(['product', 'collection', 'blog', 'article', 'page', 'product_list', 'collection_list']);

/* ------------------------------ text helpers ----------------------------- */

const STR_SKIP = (s) => typeof s !== 'string' || s.startsWith('t:');

function isSentenceCase(str) {
  const text = str
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/\[\[[^\]]*\]\]/g, ' ');
  const sentences = text.split(/(?<=[.!?:])\s+/);
  const bad = [];
  for (const s of sentences) {
    const words = s.trim().split(/\s+/).filter(Boolean);
    words.forEach((w, i) => {
      if (i === 0) return;
      const clean = w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
      if (!clean) return;
      if (/^[A-Z][a-z]+/.test(clean) && !PROPER_NOUNS.has(clean) && !/^[A-Z]{2,}$/.test(clean)) bad.push(clean);
    });
  }
  return bad;
}

class Ctx {
  constructor(file, text, base = 0) {
    this.file = file;
    this.text = text;
    this.base = base; // char offset of the JSON inside the file
  }
  line(...needles) {
    for (const n of needles) {
      if (n === undefined || n === null || n === '') continue;
      const i = this.text.indexOf(JSON.stringify(String(n)), this.base);
      if (i >= 0) return lineOfIndex(this.text, i);
    }
    return lineOfIndex(this.text, this.base);
  }
}

function checkText(ctx, where, str, { kind = 'label', needle } = {}) {
  if (STR_SKIP(str)) return;
  const line = ctx.line(needle || str);
  const loc = `${where}: "${str}"`;
  if (/&/.test(str.replace(/&(amp|nbsp|[a-z]+|#\d+);/gi, (m) => (/^&amp;$/i.test(m) ? '&' : '')))) {
    R.error(ctx.file, line, 'no-ampersand', `${loc} contains an ampersand; write "and"`);
  }
  if (/\?\s*$/.test(str)) R.error(ctx.file, line, 'no-question', `${loc} ends with a question mark; use a declarative statement`);
  for (const [bad, good] of Object.entries(BRITISH)) {
    if (new RegExp(`\\b${bad}\\b`, 'i').test(str)) R.error(ctx.file, line, 'american-english', `${loc} uses British spelling "${bad}"; use "${good}"`);
  }
  for (const [re, advice, sev] of TERMS) {
    if (re.test(str)) R.add(sev, ctx.file, line, 'terminology', `${loc} -> use ${advice}`);
  }
  const bad = isSentenceCase(str);
  if (bad.length) {
    R.add(kind === 'info' ? 'warn' : 'error', ctx.file, line, 'sentence-case', `${loc} has capitalized word(s): ${[...new Set(bad)].join(', ')}`);
  }
}

/* ------------------------------ value checks ----------------------------- */

function checkDefault(ctx, where, s, ownerFile) {
  const line = ctx.line(s.id);
  const d = s.default;
  const t = s.type;
  if (typeof d === 'string' && d.includes('shopify://')) R.error(ctx.file, line, 'no-shopify-uri', `${where}: default contains shopify:// resource`);
  if (t === 'select' || t === 'radio') {
    const values = (s.options || []).map((o) => o.value);
    if (!s.options || !s.options.length) R.error(ctx.file, line, 'select-options', `${where}: ${t} has no options`);
    if (d === undefined) R.error(ctx.file, line, 'select-default', `${where}: ${t} setting needs a default`);
    else if (!values.includes(d)) R.error(ctx.file, line, 'select-default', `${where}: default "${d}" is not one of [${values.join(', ')}]`);
    const dup = values.filter((v, i) => values.indexOf(v) !== i);
    if (dup.length) R.error(ctx.file, line, 'select-options', `${where}: duplicate option value(s) ${dup.join(', ')}`);
    for (const o of s.options || []) {
      checkText(ctx, `${where} option`, o.label, { needle: o.label });
      if (typeof o.label === 'string' && /^\s*(option|position|style|layout|variant|choice|design)?\s*\d+\s*$/i.test(o.label) && !/color|scheme|palette/i.test(`${s.id} ${s.label}`)) {
        R.error(ctx.file, ctx.line(o.label), 'numbered-options', `${where}: option label "${o.label}" is numbered; use a descriptive name`);
      }
    }
  }
  if (t === 'range') {
    if (typeof s.unit === "string" && s.unit.length > 3) R.error(ctx.file, line, 'range', `${where}: unit "${s.unit}" is too long (max 3 characters)`);
    const { min, max, step = 1 } = s;
    if (d === undefined) R.error(ctx.file, line, 'range', `${where}: range needs a default`);
    else {
      if (d < min || d > max) R.error(ctx.file, line, 'range', `${where}: default ${d} outside ${min}-${max}`);
      const k = (d - min) / step;
      if (Math.abs(k - Math.round(k)) > 1e-9) R.error(ctx.file, line, 'range', `${where}: default ${d} is not on a step of ${step} from ${min}`);
    }
    if ((max - min) / step > 101) R.error(ctx.file, line, 'range', `${where}: more than 101 steps`);
  }
  if (t === 'richtext' && typeof d === 'string' && d.trim() && !/^\s*<p[\s>]/.test(d)) R.error(ctx.file, line, 'richtext-default', `${where}: richtext default must be wrapped in <p>`);
  if (t === 'inline_richtext' && typeof d === 'string' && (/<\/?(p|div|h[1-6]|ul|ol|li|blockquote)\b/i.test(d) || /<br\s*\/?>/i.test(d))) {
    R.error(ctx.file, line, 'inline-richtext-default', `${where}: inline_richtext default must not contain block tags or <br>`);
  }
  if (t === 'link_list') {
    const base = path.basename(ownerFile || '');
    const want = /header/i.test(base) ? 'main-menu' : /footer/i.test(base) ? 'footer' : null;
    if (want && d !== want) R.error(ctx.file, line, 'link-list-default', `${where}: link_list in ${base} needs default "${want}" (found ${JSON.stringify(d)})`);
    if (!want && d && !['main-menu', 'footer'].includes(d)) R.warn(ctx.file, line, 'link-list-default', `${where}: link_list default "${d}" may not exist in a merchant store`);
  }
  if (RESOURCE_TYPES.has(t) && d !== undefined) R.error(ctx.file, line, 'resource-default', `${where}: resource setting has a default; the resource may not exist in a merchant store`);
  if (t === 'checkbox' && d !== undefined && typeof d !== 'boolean') R.error(ctx.file, line, 'checkbox-default', `${where}: checkbox default must be boolean`);
  if (typeof d === 'string' && /lorem ipsum/i.test(d)) R.error(ctx.file, line, 'lorem', `${where}: Lorem ipsum default`);
}

function checkSettings(ctx, owner, settings, ownerFile, { theme = false } = {}) {
  if (!Array.isArray(settings)) return;
  const ids = new Set();
  settings.forEach((s, idx) => {
    const where = `${owner} > ${s.id || `${s.type}#${idx}`}`;
    const line = ctx.line(s.id, s.label, s.content);
    if (!s.type) { R.error(ctx.file, line, 'setting-type', `${where}: missing type`); return; }
    if (s.type === 'header' || s.type === 'paragraph') {
      if (!s.content) R.error(ctx.file, line, 'setting-content', `${where}: ${s.type} needs content`);
      else checkText(ctx, `${owner} ${s.type}`, s.content, { needle: s.content });
      return;
    }
    if (!s.id) R.error(ctx.file, line, 'setting-id', `${where}: setting is missing an id`);
    else if (ids.has(s.id)) R.error(ctx.file, line, 'setting-id', `${where}: duplicate id "${s.id}"`);
    else ids.add(s.id);
    if (!s.label && s.type !== 'color_scheme_group') R.error(ctx.file, line, 'label-missing', `${where}: setting has no label`);
    else {
      checkText(ctx, where, s.label);
      const colorish = /color|colour|scheme|palette/i.test(`${s.id} ${s.label}`);
      if (!colorish && /(\s|^)\d+\s*(\(.*\))?\s*$/.test(s.label) && !/\d+\s*(x|:)\s*\d+|\bpx\b|%/i.test(s.label)) {
        R.error(ctx.file, line, 'numbered-options', `${where}: label "${s.label}" is numbered; use a descriptive name`);
      }
    }
    if (s.info) checkText(ctx, `${where} info`, s.info, { kind: 'info', needle: s.info });
    if (s.placeholder) checkText(ctx, `${where} placeholder`, s.placeholder, { kind: 'info', needle: s.placeholder });
    checkDefault(ctx, where, s, ownerFile);
    if (theme && /^(social|facebook|instagram|twitter|youtube|pinterest|tiktok)/.test(s.id || '') && s.default) {
      R.error(ctx.file, line, 'social-placeholder', `${where}: social media placeholder text must be left empty`);
    }
  });
}

/* --------------------------- schema registries --------------------------- */

const sectionSchemas = new Map(); // type -> {schema, file, ctx}
const blockSchemas = new Map();
const sectionFiles = walk('sections', (f) => f.endsWith('.liquid'));
const blockFiles = walk('blocks', (f) => f.endsWith('.liquid'));

function loadLiquid(files, registry, kind) {
  for (const f of files) {
    const text = read(f);
    const ex = extractSchema(text);
    const type = path.basename(f, '.liquid');
    if (!ex) {
      if (kind === 'section' && type !== 'pickup-availability') R.error(rel(f), 1, 'schema-missing', `${kind} has no {% schema %}`);
      continue;
    }
    let schema;
    try { schema = JSON.parse(ex.raw); } catch (e) {
      R.error(rel(f), ex.startLine, 'schema-json', `invalid schema JSON: ${e.message}`);
      continue;
    }
    registry.set(type, { schema, file: rel(f), ctx: new Ctx(rel(f), text, ex.start), type });
  }
}
loadLiquid(sectionFiles, sectionSchemas, 'section');
loadLiquid(blockFiles, blockSchemas, 'block');

const jsonSections = walk('sections', (f) => f.endsWith('.json'));
const templateFiles = walk('templates', (f) => f.endsWith('.json'));
const usedInGroups = new Set();
const usedInTemplates = new Set();

/* ------------------------------ section rules ----------------------------- */

function checkBlocksDef(ctx, owner, blocks, ownerFile) {
  if (!Array.isArray(blocks)) return;
  const types = new Set();
  for (const b of blocks) {
    if (b.type === '@app' || b.type === '@theme') continue;
    if (!b.type) { R.error(ctx.file, ctx.line(b.name), 'block-type', `${owner}: block missing type`); continue; }
    if (types.has(b.type)) R.error(ctx.file, ctx.line(b.type), 'block-type', `${owner}: duplicate block type "${b.type}"`);
    types.add(b.type);
    if (!b.name) R.error(ctx.file, ctx.line(b.type), 'block-name', `${owner} > ${b.type}: block has no name`);
    else checkText(ctx, `${owner} block name`, b.name, { needle: b.name });
    checkSettings(ctx, `${owner} > block ${b.type}`, b.settings, ownerFile);
    if (b.type === 'liquid' && !(b.settings || []).some((s) => s.type === 'liquid')) {
      R.warn(ctx.file, ctx.line(b.type), 'custom-liquid', `${owner}: liquid block lacks a setting of type "liquid"`);
    }
  }
}

function validateValue(ctx, where, def, v, line) {
  if (typeof v === 'string' && v.includes('shopify://')) R.error(ctx.file, line, 'no-shopify-uri', `${where}: contains a shopify:// resource`);
  const stepOk = (x) => Math.abs((x - def.min) / (def.step || 1) - Math.round((x - def.min) / (def.step || 1))) < 1e-9;
  switch (def.type) {
    case 'select':
    case 'radio':
      if (!(def.options || []).some((o) => o.value === v)) R.error(ctx.file, line, 'template-value', `${where}: "${v}" is not a valid option [${(def.options || []).map((o) => o.value).join(', ')}]`);
      break;
    case 'richtext':
      if (typeof v === 'string' && v.trim() && !/^\s*<p[\s>]/.test(v)) R.error(ctx.file, line, 'template-value', `${where}: richtext value must start with <p>`);
      break;
    case 'inline_richtext':
      if (typeof v === 'string' && (/<\/?(p|div|h[1-6]|ul|ol|li)\b/i.test(v) || /<br/i.test(v))) R.error(ctx.file, line, 'template-value', `${where}: inline_richtext must not contain block tags or <br>`);
      break;
    case 'checkbox':
      if (typeof v !== 'boolean') R.error(ctx.file, line, 'template-value', `${where}: checkbox value must be boolean`);
      break;
    case 'range':
      if (typeof v !== 'number') R.error(ctx.file, line, 'template-value', `${where}: range value must be a number`);
      else if (v < def.min || v > def.max || !stepOk(v)) R.error(ctx.file, line, 'template-value', `${where}: ${v} not valid for range ${def.min}-${def.max} step ${def.step || 1}`);
      break;
    case 'number':
      if (typeof v !== 'number') R.error(ctx.file, line, 'template-value', `${where}: number value must be a number`);
      break;
    case 'link_list':
      if (v && !['main-menu', 'footer'].includes(v)) R.error(ctx.file, line, 'resource-handle', `${where}: specific menu handle "${v}"; only main-menu/footer are safe`);
      break;
    case 'product': case 'collection': case 'blog': case 'article': case 'page':
      if (v) R.error(ctx.file, line, 'resource-handle', `${where}: specific ${def.type} handle "${v}" in JSON`);
      break;
    case 'product_list': case 'collection_list':
      if (Array.isArray(v) && v.length) R.error(ctx.file, line, 'resource-handle', `${where}: specific resource handles in JSON`);
      break;
    default:
  }
}

function validateAgainst(ctx, where, schema, settingsObj, blocksObj, blockOrder, { isPreset = false, line } = {}) {
  const sets = new Map((schema.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
  for (const [k, v] of Object.entries(settingsObj || {})) {
    const def = sets.get(k);
    if (!def) { R.error(ctx.file, line, 'template-setting', `${where}: setting "${k}" does not exist in the section schema`); continue; }
    validateValue(ctx, `${where}.${k}`, def, v, line);
  }
  const allowed = new Map();
  let allowTheme = false;
  let allowApp = false;
  for (const b of schema.blocks || []) {
    if (b.type === '@theme') allowTheme = true;
    else if (b.type === '@app') allowApp = true;
    else allowed.set(b.type, b);
  }
  let count = 0;
  const entries = Array.isArray(blocksObj) ? blocksObj.map((b, i) => [String(i), b]) : Object.entries(blocksObj || {});
  for (const [id, b] of entries) {
    count++;
    if (!b || !b.type) { R.error(ctx.file, line, 'template-block', `${where}: block "${id}" has no type`); continue; }
    let bdef = allowed.get(b.type);
    if (!bdef && allowTheme && blockSchemas.has(b.type)) bdef = blockSchemas.get(b.type).schema;
    if (!bdef && allowApp && b.type.startsWith('shopify://apps')) continue;
    if (!bdef) {
      R.error(ctx.file, line, 'template-block', `${where}: block "${id}" has type "${b.type}" which the section does not accept (allowed: ${[...allowed.keys(), allowTheme ? '@theme' : '', allowApp ? '@app' : ''].filter(Boolean).join(', ') || 'none'})`);
      continue;
    }
    const bsets = new Map((bdef.settings || []).filter((s) => s.id).map((s) => [s.id, s]));
    for (const [k, v] of Object.entries(b.settings || {})) {
      const d = bsets.get(k);
      if (!d) R.error(ctx.file, line, 'template-setting', `${where} > block ${id} (${b.type}): setting "${k}" does not exist`);
      else validateValue(ctx, `${where} > block ${id}.${k}`, d, v, line);
    }
  }
  if (schema.max_blocks && count > schema.max_blocks) R.error(ctx.file, line, 'template-block', `${where}: ${count} blocks exceeds max_blocks ${schema.max_blocks}`);
  if (!isPreset && blocksObj && !Array.isArray(blocksObj) && Object.keys(blocksObj).length && !Array.isArray(blockOrder)) {
    R.error(ctx.file, line, 'block-order', `${where}: has blocks but no block_order array`);
  }
  if (Array.isArray(blockOrder)) {
    const ids = new Set(Object.keys(blocksObj || {}));
    for (const id of blockOrder) if (!ids.has(id)) R.error(ctx.file, line, 'block-order', `${where}: block_order references missing block "${id}"`);
    const dupes = blockOrder.filter((x, i) => blockOrder.indexOf(x) !== i);
    if (dupes.length) R.error(ctx.file, line, 'block-order', `${where}: block_order has duplicates ${dupes.join(', ')}`);
    for (const id of ids) if (!blockOrder.includes(id)) R.error(ctx.file, line, 'block-order', `${where}: block "${id}" is not in block_order`);
  }
}

function checkSectionSchemas() {
  for (const [type, { schema, file, ctx }] of sectionSchemas) {
    const sline = ctx.line(schema.name);
    if (!schema.name) R.error(file, sline, 'section-name', 'section has no name');
    else checkText(ctx, `section ${type} name`, schema.name, { needle: schema.name });
    if (schema.name && /\b(section|block)\b/i.test(schema.name)) R.warn(file, sline, 'section-name', `name "${schema.name}" should not contain the word section/block`);
    checkSettings(ctx, `section ${type}`, schema.settings, file);
    checkBlocksDef(ctx, `section ${type}`, schema.blocks, file);
    for (const p of schema.presets || []) {
      if (!p.name) { R.error(file, sline, 'preset-name', 'preset has no name'); continue; }
      checkText(ctx, `section ${type} preset name`, p.name, { needle: p.name });
      if (p.category) checkText(ctx, `section ${type} preset category`, p.category, { needle: p.category });
      validateAgainst(ctx, `section ${type} preset "${p.name}"`, schema, p.settings, p.blocks, p.block_order, { isPreset: true, line: ctx.line(p.name) });
    }
    if (schema.enabled_on && schema.disabled_on) R.error(file, sline, 'schema', 'enabled_on and disabled_on are mutually exclusive');
  }
  for (const [type, { schema, file, ctx }] of blockSchemas) {
    if (schema.name) checkText(ctx, `block ${type} name`, schema.name, { needle: schema.name });
    checkSettings(ctx, `block ${type}`, schema.settings, file);
  }
}

/* ----------------------------- JSON templates ----------------------------- */

function readJson(f) {
  const text = read(f);
  try { return { json: JSON.parse(text.replace(/^\s*\/\*[\s\S]*?\*\//, '')), text }; } catch (e) {
    R.error(rel(f), 1, 'json', `invalid JSON: ${e.message}`);
    return null;
  }
}

function lineFor(text, id) {
  const i = text.indexOf(`"${id}"`);
  return i >= 0 ? lineOfIndex(text, i) : 1;
}

function checkSectionInstance(file, text, id, sec, group) {
  const line = lineFor(text, id);
  const where = `${rel(file)} > ${id}`;
  if (!sec || !sec.type) { R.error(rel(file), line, 'template-section', `${where}: no type`); return; }
  const def = sectionSchemas.get(sec.type);
  if (!def) {
    if (sec.type.startsWith('shopify://apps')) return;
    R.error(rel(file), line, 'template-section', `${where}: section type "${sec.type}" does not exist in sections/`);
    return;
  }
  (group ? usedInGroups : usedInTemplates).add(sec.type);
  validateAgainst({ file: rel(file) }, where, def.schema, sec.settings, sec.blocks, sec.block_order, { line });
  const en = def.schema.enabled_on;
  if (en && !group && Array.isArray(en.templates) && !en.templates.includes('*')) {
    const tplName = path.basename(file, '.json').split('.')[0];
    if (!en.templates.includes(tplName)) R.error(rel(file), line, 'template-section', `${where}: section "${sec.type}" is not enabled on template "${tplName}"`);
  }
}

function checkOrder(f, text, json) {
  if (!Array.isArray(json.order)) { R.error(rel(f), 1, 'template-order', 'missing "order" array'); return; }
  for (const id of json.order) if (!(json.sections || {})[id]) R.error(rel(f), lineFor(text, id), 'template-order', `order references missing section "${id}"`);
  for (const id of Object.keys(json.sections || {})) if (!json.order.includes(id)) R.error(rel(f), lineFor(text, id), 'template-order', `section "${id}" is not in order`);
  if (new Set(json.order).size !== json.order.length) R.error(rel(f), 1, 'template-order', 'order has duplicates');
}

function checkJsonLayouts() {
  for (const f of templateFiles) {
    const r = readJson(f);
    if (!r) continue;
    const { json, text } = r;
    const i = text.indexOf('shopify://');
    if (i >= 0) R.error(rel(f), lineOfIndex(text, i), 'no-shopify-uri', 'contains shopify:// resource reference');
    if (!json.sections) { R.warn(rel(f), 1, 'template', 'no sections key'); continue; }
    checkOrder(f, text, json);
    for (const [id, sec] of Object.entries(json.sections)) checkSectionInstance(f, text, id, sec, false);
  }
  for (const f of jsonSections) {
    const r = readJson(f);
    if (!r) continue;
    const { json, text } = r;
    const i = text.indexOf('shopify://');
    if (i >= 0) R.error(rel(f), lineOfIndex(text, i), 'no-shopify-uri', 'contains shopify:// resource reference');
    if (json.name) checkText(new Ctx(rel(f), text), 'section group name', json.name, { needle: json.name });
    checkOrder(f, text, json);
    for (const [id, sec] of Object.entries(json.sections || {})) checkSectionInstance(f, text, id, sec, true);
  }
}

function checkPresetRequirement() {
  for (const [type, { schema, file, ctx }] of sectionSchemas) {
    if ((schema.presets || []).length) continue;
    if (NO_PRESET_ALLOWLIST.some((re) => re.test(type))) continue;
    const line = ctx.line(schema.name);
    const onlyGroups = usedInGroups.has(type) && !usedInTemplates.has(type);
    if (onlyGroups) {
      R.warn(file, line, 'presets', `section "${type}" has no presets (only used in section groups; fine if merchants never need to re-add it)`);
      continue;
    }
    const unused = !usedInGroups.has(type) && !usedInTemplates.has(type);
    R.error(file, line, 'presets', `section "${type}" has no presets${unused ? ' and is not referenced by any template or group' : ''}; merchants cannot add it. Add presets or rename to main-*`);
  }
}

/* ------------------------------ config files ------------------------------ */

function checkThemeSettingsSchema() {
  const f = path.join(ROOT, 'config', 'settings_schema.json');
  if (!fs.existsSync(f)) { R.error('config/settings_schema.json', 1, 'settings-schema', 'missing'); return []; }
  const r = readJson(f);
  if (!r) return [];
  const { json, text } = r;
  const ctx = new Ctx('config/settings_schema.json', text);
  if (!Array.isArray(json)) { R.error(ctx.file, 1, 'settings-schema', 'must be an array'); return []; }
  const info = json.find((g) => g.name === 'theme_info');
  if (!info) R.error(ctx.file, 1, 'theme-info', 'missing theme_info group');
  else {
    for (const k of ['theme_name', 'theme_version', 'theme_author', 'theme_documentation_url', 'theme_support_url']) {
      if (!info[k]) R.error(ctx.file, ctx.line('theme_info'), 'theme-info', `theme_info is missing ${k}`);
    }
  }
  const all = [];
  for (const g of json) {
    if (g.name === 'theme_info') continue;
    if (g.name) checkText(ctx, 'settings group', g.name, { needle: g.name });
    checkSettings(ctx, `settings "${g.name}"`, g.settings, 'config/settings_schema.json', { theme: true });
    all.push(...(g.settings || []));
  }
  if (!all.some((s) => s.type === 'image_picker' && /favicon/i.test(s.id))) R.error(ctx.file, 1, 'favicon', 'no favicon setting (image_picker with id favicon)');
  const scheme = all.find((s) => s.type === 'color_scheme_group');
  if (scheme) {
    const keys = scheme.definition || [];
    const colorKeys = keys.filter((k) => k.type === 'color');
    if (colorKeys.length < 4) R.error(ctx.file, ctx.line(scheme.id), 'color-system', `color scheme group defines ${colorKeys.length} colors; at least 4 required`);
    for (const k of keys) if (k.label) checkText(ctx, `color scheme ${k.id}`, k.label, { needle: k.label });
  } else {
    const colors = all.filter((s) => s.type === 'color');
    if (colors.length < 4) R.error(ctx.file, 1, 'color-system', `only ${colors.length} color settings; at least 4 required`);
  }
  if (!all.some((s) => s.type === 'font_picker')) R.warn(ctx.file, 1, 'font-picker', 'no font_picker settings');
  for (const s of all.filter((x) => x.type === 'font_picker')) if (!s.default) R.error(ctx.file, ctx.line(s.id), 'font-picker', `${s.id}: font_picker needs a default`);
  return all;
}

function checkSettingsData(allSettings) {
  const f = path.join(ROOT, 'config', 'settings_data.json');
  if (!fs.existsSync(f)) return;
  const r = readJson(f);
  if (!r) return;
  const { json, text } = r;
  const i = text.indexOf('shopify://');
  if (i >= 0) R.error('config/settings_data.json', lineOfIndex(text, i), 'no-shopify-uri', 'contains shopify:// resource reference');
  const known = new Map(allSettings.filter((s) => s.id).map((s) => [s.id, s]));
  const current = json.current;
  if (!current || typeof current !== 'object') return;
  for (const [k, v] of Object.entries(current)) {
    const def = known.get(k);
    if (!def) {
      if (!['sections', 'content_for_index', 'blocks', 'checkout_and_customer_accounts'].includes(k)) {
        R.warn('config/settings_data.json', lineFor(text, k), 'settings-data', `"${k}" is not defined in settings_schema.json`);
      }
      continue;
    }
    validateValue({ file: 'config/settings_data.json' }, `settings_data.current.${k}`, def, v, lineFor(text, k));
  }
}

/* --------------------------------- main ---------------------------------- */

checkSectionSchemas();
checkJsonLayouts();
checkPresetRequirement();
const all = checkThemeSettingsSchema();
checkSettingsData(all);

for (const f of walk('.', (p) => /[\\/](sections|blocks|snippets|layout)[\\/].*\.liquid$/.test(p))) {
  const t = read(f);
  const i = t.indexOf('shopify://');
  if (i >= 0 && !/shopify:\/\/apps/.test(t)) R.error(rel(f), lineOfIndex(t, i), 'no-shopify-uri', 'contains shopify:// resource reference');
}

const { errors } = R.print({ max: Number(args.max) || 40 });
process.exit(errors ? 1 : 0);
