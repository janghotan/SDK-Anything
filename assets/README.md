# Visual asset index

This directory holds the bilingual visual system for SDK-Anything: banners,
technical diagrams, social previews, the project mark, an icon set, and an
editable release template.

The SVGs are the canonical sources. They are self-contained, contain no
scripts or external resources, and carry `<title>` / `<desc>` metadata for
assistive technology. Raster exports exist only where a platform requires
them.

## Visual identity

| Token | Value | Use |
|---|---|---|
| Ink | `#0B1220` | Dark surfaces and primary text on light surfaces |
| Paper | `#F7F5EF` | Warm off-white diagram background |
| Electric cyan | `#18B6D9` on dark / `#087F9C` on light | Primary accent, arrows, active states |
| Violet | `#7C6CF0` | Optional AI and recovery paths only |
| Green / red / amber | `#1F8A70` / `#B3453F` / `#A96B12` | Effect-policy semantics |
| UI type | `Noto Sans CJK SC`, `Noto Sans`, system sans | All diagram labels |
| Code type | `JetBrains Mono`, `Noto Sans Mono CJK SC`, monospace | Commands, schemas, identifiers |
| Geometry | 10–18 px radii, 1.5–2.5 px strokes | Consistent cards and connectors |

The type stacks are references, not embedded fonts. Browsers and GitHub fall
back to local CJK and sans-serif fonts when a preferred family is unavailable.

## Diagrams

All diagram pairs are generated from one layout implementation and one
localized copy file, so English and Simplified Chinese stay aligned. In the
READMEs, each diagram is wrapped in a link to its full-size SVG so readers on
narrow screens can open and zoom the detailed view.

| Diagram | English | Simplified Chinese | Size | Intended use |
|---|---|---|---|---|
| Architecture | [`diagrams/architecture-en.svg`](diagrams/architecture-en.svg) | [`diagrams/architecture-zh.svg`](diagrams/architecture-zh.svg) | 1200×750 | README architecture section, `docs/architecture.md` |
| Workflow | [`diagrams/workflow-en.svg`](diagrams/workflow-en.svg) | [`diagrams/workflow-zh.svg`](diagrams/workflow-zh.svg) | 1200×780 | README quick-start workflow, execution-boundary explanation |
| Security | [`diagrams/security-en.svg`](diagrams/security-en.svg) | [`diagrams/security-zh.svg`](diagrams/security-zh.svg) | 1200×720 | README security section, `docs/security.md` |
| Transformation | [`diagrams/transformation-en.svg`](diagrams/transformation-en.svg) | [`diagrams/transformation-zh.svg`](diagrams/transformation-zh.svg) | 1200×760 | README “Why” section, before/after explanations |
| Ecosystem | [`diagrams/ecosystem-en.svg`](diagrams/ecosystem-en.svg) | [`diagrams/ecosystem-zh.svg`](diagrams/ecosystem-zh.svg) | 1200×740 | README compatibility section, `docs/design.md` |
| Feature map | [`diagrams/features-en.svg`](diagrams/features-en.svg) | [`diagrams/features-zh.svg`](diagrams/features-zh.svg) | 1200×820 | Linked overview; not embedded in the README |

### Accuracy boundaries shown in the diagrams

- Inspection is static: target SDK code is not imported or executed, and
  install lifecycle scripts are skipped.
- `pure` and `read` effects are allowed by default. `write`, `destructive`, and
  `unknown` effects are denied by default until explicitly authorized.
- Trusted-local testing uses a sanitized child process and is **not** a
  security sandbox. Container testing requires Docker or Podman and fails
  closed when neither is available.
- AI assistance is optional, uses an OpenAI-compatible endpoint, and proposes
  metadata only; deterministic generation remains the fallback.
- The transformation diagram shows diagnostics and overrides as the recovery
  path. It does not claim that every SDK symbol converts automatically.

## Brand and social assets

| Asset | English | Simplified Chinese | Size | Intended use |
|---|---|---|---|---|
| Hero banner | [`banners/sdk-anything-banner-en.svg`](banners/sdk-anything-banner-en.svg) | [`banners/sdk-anything-banner-zh.svg`](banners/sdk-anything-banner-zh.svg) | 1600×360 | Top of each README |
| Social preview | [`social/og-en.svg`](social/og-en.svg) · [`social/og-en.png`](social/og-en.png) | [`social/og-zh.svg`](social/og-zh.svg) · [`social/og-zh.png`](social/og-zh.png) | 1200×630 | GitHub repository social preview and link cards |
| Release template | [`templates/release-template-en.svg`](templates/release-template-en.svg) | [`templates/release-template-zh.svg`](templates/release-template-zh.svg) | 1200×630 | Editable version announcement |

The release templates intentionally use placeholders (`vX.Y.Z`,
`[Release title]`, localized equivalents) instead of a real version number,
date, download count, or star count.

### Project mark

| Asset | Size | Use |
|---|---|---|
| [`icons/mark.svg`](icons/mark.svg) | 512×512 viewBox | Canonical mark, dark surfaces, documentation |
| [`icons/mark-512.png`](icons/mark-512.png) | 512×512 PNG | GitHub organization/project avatar upload |

The mark is a package cube with an output arrow. It contains no text and is
designed to remain legible at 32 px. It is language-neutral.

### Legacy banners

[`sdk-anything-banner-en.png`](sdk-anything-banner-en.png) and
[`sdk-anything-banner-zh.png`](sdk-anything-banner-zh.png) are the original
banners. They are preserved unchanged for history but are no longer referenced
by the READMEs. The new SVG banners replace them because the old artwork uses
generic robot imagery and an overbroad “any SDK” claim that the current
documentation does not make.

## Icon set

The icons share a 64×64 viewBox, a 14 px tile radius, a 2.6 px stroke, and one
cyan accent. They are language-neutral symbols; accessibility labels are in
English. They are intended for the asset index, slides, and documentation
callouts, not as 16 px inline UI glyphs.

| Icon | Asset | Intended meaning |
|---|---|---|
| Source | [`icons/source.svg`](icons/source.svg) | npm package, local directory, or public GitHub repository |
| Analyzer | [`icons/analyzer.svg`](icons/analyzer.svg) | Static TypeScript analysis without execution |
| Manifest | [`icons/manifest.svg`](icons/manifest.svg) | Versioned capability manifest and typed operations |
| MCP | [`icons/mcp.svg`](icons/mcp.svg) | Generated stdio MCP server |
| CLI | [`icons/cli.svg`](icons/cli.svg) | Generated command-line interface |
| Skill | [`icons/skill.svg`](icons/skill.svg) | Generated `SKILL.md` agent skill |
| Security | [`icons/security.svg`](icons/security.svg) | Effect policy, secret references, and redaction |
| Diagnostics | [`icons/diagnostics.svg`](icons/diagnostics.svg) | Unresolved types and warnings for review |
| Testing | [`icons/testing.svg`](icons/testing.svg) | Static checks, trusted-local tests, or container sandbox |

## Generation and editing

The generator is deterministic and uses no third-party packages:

```bash
node scripts/generate-visuals.mjs
```

It reads localized copy from `scripts/visuals/strings.mjs` and renders both
languages in the same pass. Layout primitives live in
`scripts/visuals/lib.mjs`; diagram composition lives in
`scripts/visuals/diagrams.mjs`.

Do not edit generated SVGs directly. Change the copy or layout source, then
regenerate. Technical identifiers (`MCP`, `CLI`, `SKILL.md`, `env:`, effect
names, commands, and file paths) stay unchanged in both languages.

### Determinism check

```bash
find assets -name '*.svg' -print0 | sort -z | xargs -0 sha256sum > /tmp/visuals-before.sha
node scripts/generate-visuals.mjs
find assets -name '*.svg' -print0 | sort -z | xargs -0 sha256sum > /tmp/visuals-after.sha
diff -u /tmp/visuals-before.sha /tmp/visuals-after.sha
```

The second run must produce byte-identical SVG output.

### Raster exports

The SVG files are canonical. Refresh the checked-in PNGs after changing the
social preview or mark:

```bash
magick assets/social/og-en.svg -depth 8 -strip assets/social/og-en.png
magick assets/social/og-zh.svg -depth 8 -strip assets/social/og-zh.png
magick assets/icons/mark.svg -depth 8 -strip assets/icons/mark-512.png
```

These commands require ImageMagick 7 and a local `Noto Sans CJK SC` font for
the Chinese text. Raster output depends on the local renderer and font
version, so review the PNGs before uploading them. The PNGs are convenience
exports, not part of the deterministic SVG generation gate.

## Validation

Run the repository checker:

```bash
node scripts/check-visuals.mjs
```

It verifies that every expected asset exists, is non-empty, parses as an SVG
with `<title>` / `<desc>`, contains no scripts or external references, that
English and Chinese pairs have matching dimensions, that the Chinese assets
contain CJK text and the English assets do not, and that all relative image
links in both READMEs resolve.

Also run a standards-based XML parse and local raster review when editing:

```bash
python3 - <<'PY'
import glob, xml.etree.ElementTree as ET
for path in glob.glob('assets/**/*.svg', recursive=True):
    ET.parse(path)
print('all SVGs parse')
PY
```

Raster previews are generated with:

```bash
mkdir -p /tmp/visual-preview
for f in assets/diagrams/*.svg assets/banners/*.svg assets/social/*.svg assets/templates/*.svg assets/icons/*.svg; do
  magick "$f" "/tmp/visual-preview/$(basename "$f" .svg).png"
done
```

Inspect the previews at full width and at a narrow mobile width. Check for
text clipping, overlap, missing glyphs, and English/Chinese layout parity.

## Known limitations

- Text is live SVG text, not paths. Viewers need a CJK-capable font for the
  Chinese variants; the font stack names common system fonts but embeds none.
- GitHub renders SVG text with the viewer's fonts, so line breaks can shift
  slightly across platforms. The generator keeps labels short and validates
  the rendered local output.
- The checked-in PNG social previews are raster exports; regenerate them after
  any copy or layout change.
- GitHub repository social preview upload is a manual repository setting.
  The 1200×630 PNGs are ready for that upload.
- Platform names in the ecosystem diagram describe documented connection
  paths. They do not imply endorsement and no platform logos are used.
- These diagrams describe current v0.1 behavior. Update the copy when behavior
  changes; do not let illustrations outrun the implementation.
