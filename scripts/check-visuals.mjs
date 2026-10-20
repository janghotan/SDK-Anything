#!/usr/bin/env node
// Validates the generated visual system without third-party dependencies.
// Usage: node scripts/check-visuals.mjs

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const errors = [];

const diagramNames = [
  "architecture",
  "workflow",
  "security",
  "transformation",
  "ecosystem",
  "features",
];
// The feature map is linked from the asset index, and the transformation
// diagram is linked from the READMEs to keep the quick-start path lighter.
const readmeDiagramNames = diagramNames.filter(
  (name) => name !== "features" && name !== "transformation",
);
const languages = ["en", "zh"];
const iconNames = [
  "source",
  "analyzer",
  "manifest",
  "mcp",
  "cli",
  "skill",
  "security",
  "diagnostics",
  "testing",
];

const expected = [];
for (const name of diagramNames) {
  for (const lang of languages) expected.push(`assets/diagrams/${name}-${lang}.svg`);
}
for (const lang of languages) {
  expected.push(`assets/banners/sdk-anything-banner-${lang}.svg`);
  expected.push(`assets/social/og-${lang}.svg`);
  expected.push(`assets/social/og-${lang}.png`);
  expected.push(`assets/templates/release-template-${lang}.svg`);
}
expected.push("assets/icons/mark.svg", "assets/icons/mark-512.png");
for (const name of iconNames) expected.push(`assets/icons/${name}.svg`);

function full(path) {
  return join(root, path);
}

function svgDimensions(source) {
  const match = source.match(
    /<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/,
  );
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

function checkSvg(path) {
  const source = readFileSync(full(path), "utf8");
  const label = relative(root, full(path));
  if (!source.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    errors.push(`${label}: missing XML declaration`);
  }
  if (!/<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(source)) {
    errors.push(`${label}: missing SVG namespace`);
  }
  if (!/<svg[^>]*role="img"/.test(source)) {
    errors.push(`${label}: missing role="img"`);
  }
  if (!/<svg[^>]*aria-labelledby="title desc"/.test(source)) {
    errors.push(`${label}: missing aria-labelledby`);
  }
  const title = source.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  const desc = source.match(/<desc[^>]*>([\s\S]*?)<\/desc>/);
  if (!title || !title[1].trim()) errors.push(`${label}: missing <title>`);
  if (!desc || !desc[1].trim()) errors.push(`${label}: missing <desc>`);
  if (!svgDimensions(source)) errors.push(`${label}: missing width/height`);
  if (/<script\b/i.test(source)) errors.push(`${label}: contains a script`);
  if (/<image\b/i.test(source)) errors.push(`${label}: contains a raster image`);
  if (/\b(?:xlink:)?href="https?:/i.test(source)) {
    errors.push(`${label}: contains an external href`);
  }
  if (/url\(\s*["']?https?:/i.test(source)) {
    errors.push(`${label}: contains an external url()`);
  }
  if (/@import\b/i.test(source)) errors.push(`${label}: contains @import`);
  return { source, dimensions: svgDimensions(source) };
}

const svgData = new Map();
for (const path of expected) {
  const target = full(path);
  if (!existsSync(target)) {
    errors.push(`missing expected asset: ${path}`);
    continue;
  }
  const size = statSync(target).size;
  if (size === 0) errors.push(`zero-byte asset: ${path}`);
  if (path.endsWith(".svg")) svgData.set(path, checkSvg(path));
}

for (const name of diagramNames) {
  const en = svgData.get(`assets/diagrams/${name}-en.svg`);
  const zh = svgData.get(`assets/diagrams/${name}-zh.svg`);
  if (!en || !zh) continue;
  if (en.dimensions.width !== zh.dimensions.width || en.dimensions.height !== zh.dimensions.height) {
    errors.push(`${name}: EN/zh dimensions differ`);
  }
}

for (const [path, data] of svgData) {
  const cjk = (data.source.match(/[\u2E80-\u9FFF\uF900-\uFAFF]/g) || []).length;
  if (path.endsWith("-zh.svg") && cjk < 20) {
    errors.push(`${path}: Chinese variant has too little CJK text (${cjk} chars)`);
  }
  if (path.endsWith("-en.svg") && cjk > 0) {
    errors.push(`${path}: English variant contains CJK text`);
  }
}

function checkReadme(path, expectedLang, forbiddenLang) {
  if (!existsSync(full(path))) {
    errors.push(`missing ${path}`);
    return;
  }
  const source = readFileSync(full(path), "utf8");
  const references = [];
  for (const match of source.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) references.push(match[1]);
  for (const match of source.matchAll(/<img[^>]+src="([^"]+)"/g)) references.push(match[1]);

  const assets = references.filter((ref) => !/^(?:https?:|data:|#)/.test(ref));
  for (const ref of assets) {
    const clean = decodeURIComponent(ref.split("#")[0]);
    const target = resolve(dirname(full(path)), clean);
    if (!existsSync(target)) errors.push(`${path}: broken image link ${ref}`);
    else if (statSync(target).size === 0) errors.push(`${path}: empty image ${ref}`);
    if (clean.endsWith(`-${forbiddenLang}.svg`)) {
      errors.push(`${path}: references wrong-language asset ${ref}`);
    }
  }

  for (const name of readmeDiagramNames) {
    if (!assets.some((ref) => ref.includes(`/diagrams/${name}-${expectedLang}.svg`))) {
      errors.push(`${path}: missing ${name}-${expectedLang}.svg`);
    }
  }
  if (!assets.some((ref) => ref.includes(`/banners/sdk-anything-banner-${expectedLang}.svg`))) {
    errors.push(`${path}: missing ${expectedLang} banner`);
  }
  if (!source.includes(`assets/diagrams/transformation-${expectedLang}.svg`)) {
    errors.push(`${path}: missing link to transformation-${expectedLang}.svg`);
  }
}

checkReadme("README.md", "en", "zh");
checkReadme("README.zh-CN.md", "zh", "en");

function checkRelativeLinks(path) {
  if (!existsSync(full(path))) {
    errors.push(`missing ${path}`);
    return;
  }
  const source = readFileSync(full(path), "utf8");
  for (const match of source.matchAll(/\]\(([^)\s]+)\)/g)) {
    const ref = match[1];
    if (/^(?:https?:|mailto:|data:|#)/.test(ref)) continue;
    const clean = decodeURIComponent(ref.split("#")[0]);
    const target = resolve(dirname(full(path)), clean);
    if (!existsSync(target)) errors.push(`${path}: broken relative link ${ref}`);
    else if (statSync(target).size === 0) errors.push(`${path}: empty relative link ${ref}`);
  }
}

for (const path of ["assets/README.md", "docs/architecture.md", "docs/security.md", "docs/design.md"]) {
  checkRelativeLinks(path);
}

const allSvgs = [];
function walk(dir) {
  for (const entry of readdirSync(full(dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(child);
    else if (entry.name.endsWith(".svg")) allSvgs.push(child);
  }
}
walk("assets");
for (const path of allSvgs) {
  if (!svgData.has(path)) checkSvg(path);
}

if (errors.length) {
  process.stderr.write(`Visual checks failed (${errors.length}):\n`);
  for (const error of errors) process.stderr.write(`  - ${error}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Visual checks passed: ${expected.length} expected assets, ${allSvgs.length} SVGs, ` +
      `${diagramNames.length} EN/zh diagram pairs, and both READMEs.\n`,
  );
}
