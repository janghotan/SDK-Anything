#!/usr/bin/env node
// Deterministic generator for the bilingual visual system.
// Usage: node scripts/generate-visuals.mjs
// Writes self-contained SVGs only. No network, no external assets, no timestamps.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copy } from "./visuals/strings.mjs";
import {
  buildArchitecture,
  buildBanner,
  buildEcosystem,
  buildFeatures,
  buildIcon,
  buildMark,
  buildOg,
  buildReleaseTemplate,
  buildSecurity,
  buildTransformation,
  buildWorkflow,
} from "./visuals/diagrams.mjs";
import { svgDoc } from "./visuals/lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const diagramBuilders = {
  architecture: buildArchitecture,
  workflow: buildWorkflow,
  security: buildSecurity,
  transformation: buildTransformation,
  ecosystem: buildEcosystem,
  features: buildFeatures,
};

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

function render(spec, lang) {
  return svgDoc({
    width: spec.width,
    height: spec.height,
    title: spec.title,
    desc: spec.desc,
    lang,
    body: spec.body,
    background: spec.background ?? "#F7F5EF",
    extraDefs: spec.extraDefs ?? "",
  });
}

function write(relativePath, content) {
  const fullPath = join(root, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
}

const outputs = [];

for (const lang of ["en", "zh"]) {
  const t = copy[lang];
  for (const [name, builder] of Object.entries(diagramBuilders)) {
    const path = `assets/diagrams/${name}-${lang}.svg`;
    write(path, render(builder(t[name]), t.lang));
    outputs.push(path);
  }

  const banner = `assets/banners/sdk-anything-banner-${lang}.svg`;
  write(banner, render(buildBanner(t.banner), t.lang));
  outputs.push(banner);

  const og = `assets/social/og-${lang}.svg`;
  write(og, render(buildOg(t.og), t.lang));
  outputs.push(og);

  const release = `assets/templates/release-template-${lang}.svg`;
  write(release, render(buildReleaseTemplate(t.release), t.lang));
  outputs.push(release);
}

const mark = buildMark();
write("assets/icons/mark.svg", render(mark, "en"));
outputs.push("assets/icons/mark.svg");

for (const name of iconNames) {
  const path = `assets/icons/${name}.svg`;
  write(path, render(buildIcon(name), "en"));
  outputs.push(path);
}

outputs.sort();
process.stdout.write(`Generated ${outputs.length} deterministic SVG assets:\n`);
for (const path of outputs) process.stdout.write(`  ${path}\n`);
