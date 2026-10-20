import {
  C,
  FONT,
  MONO,
  esc,
  estWidth,
  wrap,
  txt,
  multi,
  rect,
  line,
  path,
  arrowH,
  arrowV,
  pill,
  badge,
  svgDoc,
  gridPattern,
  header,
  markGlyph,
  footerNote,
  legend,
} from "./lib.mjs";
import { iconMeta } from "./strings.mjs";

const REPO = "github.com/janghotan/SDK-Anything";

function miniIcon(kind, x, y, color = C.cyanDeep) {
  if (kind === "package") {
    return (
      `<g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="1" fill="none">` +
      `<path d="M ${x + 12} ${y + 3} L ${x + 21} ${y + 8} L ${x + 21} ${y + 17} L ${x + 12} ${y + 22} L ${x + 3} ${y + 17} L ${x + 3} ${y + 8} Z"/>` +
      `<path d="M ${x + 3} ${y + 8} L ${x + 12} ${y + 13} L ${x + 21} ${y + 8}"/>` +
      `<path d="M ${x + 12} ${y + 13} L ${x + 12} ${y + 22}"/>` +
      `</g>`
    );
  }
  if (kind === "local") {
    return (
      `<g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="1" fill="none">` +
      `<path d="M ${x + 3} ${y + 7} L ${x + 3} ${y + 20} L ${x + 21} ${y + 20} L ${x + 21} ${y + 9} L ${x + 11} ${y + 9} L ${x + 9} ${y + 7} Z"/>` +
      `<path d="M ${x + 7} ${y + 13} L ${x + 10} ${y + 16} L ${x + 15} ${y + 11}"/>` +
      `</g>`
    );
  }
  return (
    `<g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="1" fill="none">` +
    `<circle cx="${x + 6}" cy="${y + 5}" r="2.4"/><circle cx="${x + 18}" cy="${y + 9}" r="2.4"/>` +
    `<circle cx="${x + 6}" cy="${y + 19}" r="2.4"/>` +
    `<path d="M ${x + 8} ${y + 6} L ${x + 15.5} ${y + 8.4} M ${x + 6} ${y + 7.4} L ${x + 6} ${y + 16.6}"/>` +
    `</g>`
  );
}

function effectChip(x, y, label, tone = "allow", width) {
  const tones = {
    allow: [C.greenSoft, C.green],
    deny: [C.redSoft, C.red],
    write: [C.amberSoft, C.amber],
    violet: [C.violetSoft, C.violetDeep],
  };
  const [fill, color] = tones[tone] ?? tones.allow;
  const w = width ?? Math.ceil(estWidth(label, 12.5) + 24);
  return {
    svg:
      rect(x, y, w, 24, { fill, rx: 12 }) +
      txt(x + w / 2, y + 16, label, {
        size: 12.5,
        weight: 650,
        fill: color,
        anchor: "middle",
        family: label.startsWith("-") ? MONO : FONT,
      }),
    w,
  };
}

function sourceCard(t, source, index, y) {
  const x = 48;
  return (
    rect(x, y, 250, 86, { fill: C.white, stroke: C.line, rx: 14 }) +
    `<rect x="${x}" y="${y}" width="4" height="86" rx="2" fill="${index === 0 ? C.cyan : C.violet}"/>` +
    miniIcon(index === 0 ? "package" : index === 1 ? "local" : "git", x + 22, y + 30) +
    txt(x + 64, y + 38, source[0], { size: 16.5, weight: 650 }) +
    txt(x + 64, y + 61, source[1], { size: 12.5, fill: C.muted })
  );
}

function outputCard(t, output, y, index) {
  const x = 968;
  return (
    rect(x, y, 184, 102, { fill: C.white, stroke: index === 0 ? C.cyan : C.line, rx: 14, sw: index === 0 ? 2 : 1.5 }) +
    txt(x + 20, y + 34, output[0], { size: 16.5, weight: 650 }) +
    txt(x + 20, y + 59, output[1], { size: 12.5, fill: C.muted }) +
    txt(x + 20, y + 84, `0${index + 1}`, { size: 11, weight: 700, fill: index === 0 ? C.cyanDeep : C.lineStrong, family: MONO, spacing: 1 })
  );
}

export function buildArchitecture(t) {
  const el = [];
  el.push(header(t, { eyebrow: t.eyebrow }));

  el.push(txt(48, 144, t.sourcesLabel, { size: 11.5, weight: 700, fill: C.muted, spacing: 1.6 }));
  t.sources.forEach((source, index) => el.push(sourceCard(t, source, index, 160 + index * 104)));

  // Source fan-in
  el.push(line(298, 203, 316, 203, { color: C.lineStrong, width: 1.5 }));
  el.push(line(298, 307, 316, 307, { color: C.lineStrong, width: 1.5 }));
  el.push(line(298, 411, 316, 411, { color: C.lineStrong, width: 1.5 }));
  el.push(line(316, 203, 316, 411, { color: C.lineStrong, width: 1.5 }));
  el.push(arrowH(316, 336, 203, { color: C.cyan, marker: "arrowCyan" }));

  // Resolver
  el.push(rect(336, 160, 300, 112, { fill: C.white, stroke: C.line, rx: 16 }));
  el.push(txt(360, 192, t.resolver.title, { size: 17.5, weight: 650 }));
  t.resolver.lines.forEach((item, index) =>
    el.push(txt(360, 220 + index * 21, item, { size: 13, fill: index === 0 ? C.cyanDeep : C.muted, weight: index === 0 ? 600 : 400 })),
  );

  el.push(arrowV(486, 272, 292, { color: C.cyan, marker: "arrowCyan" }));

  // Analyzer
  el.push(rect(336, 292, 300, 138, { fill: C.white, stroke: C.line, rx: 16 }));
  el.push(txt(360, 324, t.analyzer.title, { size: 17.5, weight: 650 }));
  t.analyzer.lines.forEach((item, index) =>
    el.push(txt(360, 352 + index * 22, item, { size: 13, fill: index === 2 ? C.cyanDeep : C.muted })),
  );

  // Optional AI
  el.push(rect(336, 450, 300, 104, { fill: C.violetSoft, stroke: C.violet, rx: 16, dash: "5 4" }));
  el.push(txt(360, 480, t.ai.title, { size: 15.5, weight: 650, fill: C.violetDeep }));
  t.ai.lines.forEach((item, index) =>
    el.push(txt(360, 504 + index * 20, item, { size: 12.5, fill: C.muted })),
  );

  // Overrides
  el.push(rect(684, 160, 236, 86, { fill: C.white, stroke: C.line, rx: 14 }));
  el.push(txt(706, 192, t.overrides.title, { size: 15.5, weight: 650 }));
  t.overrides.lines.forEach((item, index) =>
    el.push(txt(706, 216 + index * 19, item, { size: 12.5, fill: C.muted })),
  );

  // Manifest
  el.push(rect(684, 270, 236, 300, { fill: C.ink, stroke: C.ink, rx: 18 }));
  el.push(txt(706, 300, t.manifest.eyebrow, { size: 10.5, weight: 700, fill: C.cyan, spacing: 1.5 }));
  el.push(txt(706, 330, t.manifest.title, { size: 20, weight: 700, fill: C.paper }));
  el.push(txt(706, 354, t.manifest.schema, { size: 11.5, fill: C.mutedDark, family: MONO }));
  const mb = badge(706, 370, t.manifest.badge, { size: 10.5, fill: C.cyan, color: C.ink, height: 24, pad: 10 });
  el.push(mb.svg);
  t.manifest.lines.forEach((item, index) => {
    const y = 426 + index * 26;
    el.push(`<circle cx="711" cy="${y - 4}" r="3" fill="${C.cyan}"/>`);
    el.push(txt(724, y, item, { size: 12.5, fill: C.paper }));
  });
  el.push(line(706, 530, 898, 530, { color: C.lineDark, width: 1 }));
  el.push(txt(706, 550, t.manifest.footer, {
    size: 9.5,
    fill: C.mutedDark,
    family: FONT,
  }));

  // Evidence and optional AI feed the manifest; overrides sit above it.
  el.push(arrowH(636, 684, 360, { color: C.cyan, marker: "arrowCyan" }));
  el.push(arrowH(636, 684, 500, { color: C.violet, marker: "arrowViolet", dash: "5 4" }));
  el.push(arrowV(802, 246, 270, { color: C.cyan, marker: "arrowCyan" }));

  // Manifest fan-out
  el.push(line(920, 390, 944, 390, { color: C.cyan, width: 2.5 }));
  el.push(line(944, 211, 944, 475, { color: C.cyan, width: 2.5 }));
  el.push(arrowH(944, 968, 211, { color: C.cyan, marker: "arrowCyan" }));
  el.push(arrowH(944, 968, 343, { color: C.cyan, marker: "arrowCyan" }));
  el.push(arrowH(944, 968, 475, { color: C.cyan, marker: "arrowCyan" }));
  t.outputs.forEach((output, index) => el.push(outputCard(t, output, 160 + index * 132, index)));

  // Runtime band
  el.push(rect(684, 600, 468, 86, { fill: C.cyanSoft, stroke: C.cyan, rx: 14 }));
  el.push(txt(708, 626, t.runtime.title, { size: 15.5, weight: 650, fill: C.ink }));
  const runtimeLines = wrap(t.runtime.line, 420, 11.5);
  el.push(multi(708, 646, runtimeLines, { size: 11.5, fill: C.muted, lineHeight: 15 }));
  el.push(txt(708, 678, t.runtime.note, { size: 10.5, fill: C.cyanDeep, weight: 600 }));

  el.push(footerNote(1200, 750, t.footnote, { x: 48, y: 724 }));
  return {
    width: 1200,
    height: 750,
    title: t.title,
    desc: t.alt,
    body: el.join("\n"),
  };
}

export function buildWorkflow(t) {
  const el = [];
  el.push(header(t, { eyebrow: t.eyebrow }));

  // Static band
  el.push(rect(48, 140, 1104, 226, { fill: C.cyanSoft, stroke: C.cyan, rx: 18, opacity: 0.55 }));
  el.push(txt(72, 170, t.staticLabel, { size: 11.5, weight: 700, fill: C.cyanDeep, spacing: 1.6 }));
  el.push(txt(1128, 170, t.staticNote, { size: 12, fill: C.cyanDeep, anchor: "end" }));

  const stepW = 246;
  t.steps.forEach((step, index) => {
    const x = 72 + index * (stepW + 24);
    const y = 190;
    el.push(rect(x, y, stepW, 128, { fill: C.white, stroke: C.line, rx: 14 }));
    el.push(rect(x + 20, y + 18, 26, 26, { fill: index === 3 ? C.cyan : C.ink, rx: 8 }));
    el.push(txt(x + 33, y + 36, step[0], { size: 12.5, weight: 700, fill: index === 3 ? C.ink : C.paper, anchor: "middle", family: MONO }));
    el.push(txt(x + 58, y + 37, step[1], { size: 16.5, weight: 650 }));
    el.push(txt(x + 20, y + 70, step[2], { size: 12.5, fill: C.muted }));
    el.push(txt(x + 20, y + 96, step[3], { size: 11.5, fill: C.cyanDeep, weight: 600 }));
    if (index < 3) el.push(arrowH(x + stepW + 2, x + stepW + 22, y + 64, { color: C.cyan, marker: "arrowCyan" }));
  });

  el.push(arrowV(600, 366, 394, { color: C.cyan, marker: "arrowCyan" }));
  el.push(txt(72, 412, t.testsLabel, { size: 11.5, weight: 700, fill: C.violetDeep, spacing: 1.6 }));

  const lanes = [
    { x: 48, data: t.trusted, accent: C.violet, fill: C.violetSoft, tone: C.violetDeep },
    { x: 612, data: t.container, accent: C.cyan, fill: C.cyanSoft, tone: C.cyanDeep },
  ];
  for (const lane of lanes) {
    const y = 428;
    el.push(rect(lane.x, y, 540, 152, { fill: C.white, stroke: lane.accent, rx: 16 }));
    el.push(`<rect x="${lane.x}" y="${y}" width="540" height="4" rx="2" fill="${lane.accent}"/>`);
    el.push(txt(lane.x + 24, y + 34, lane.data.title, { size: 17, weight: 650 }));
    const command = pill(lane.x + 24, y + 48, lane.data.command, {
      size: 11.5,
      fill: lane.fill,
      color: lane.tone,
      height: 26,
      mono: true,
      pad: 10,
    });
    el.push(command.svg);
    lane.data.lines.forEach((item, index) =>
      el.push(txt(lane.x + 24, y + 104 + index * 20, item, {
        size: 12.5,
        fill: index === lane.data.lines.length - 1 ? lane.tone : C.muted,
        weight: index === lane.data.lines.length - 1 ? 650 : 400,
      })),
    );
  }

  // Both test lanes converge on use.
  el.push(line(318, 580, 318, 596, { color: C.lineStrong, width: 1.5 }));
  el.push(line(882, 580, 882, 596, { color: C.lineStrong, width: 1.5 }));
  el.push(line(318, 596, 882, 596, { color: C.lineStrong, width: 1.5 }));
  el.push(arrowV(600, 596, 610, { color: C.cyan, marker: "arrowCyan" }));

  el.push(rect(48, 610, 1104, 90, { fill: C.ink, stroke: C.ink, rx: 16 }));
  el.push(txt(72, 644, t.use.title, { size: 18, weight: 700, fill: C.paper }));
  el.push(txt(152, 644, t.use.line, { size: 14, fill: C.cyan }));
  el.push(txt(72, 674, t.use.note, { size: 11.5, fill: C.mutedDark }));

  el.push(legend(48, 732, [
    { label: t.legend[0], color: C.cyan },
    { label: t.legend[1], color: C.lineStrong, dash: "5 4" },
  ]));
  return {
    width: 1200,
    height: 780,
    title: t.title,
    desc: t.alt,
    body: el.join("\n"),
  };
}

export function buildSecurity(t) {
  const el = [];
  el.push(header(t, { eyebrow: t.eyebrow }));

  // Inspection band
  el.push(rect(48, 140, 1104, 96, { fill: C.white, stroke: C.line, rx: 16 }));
  el.push(txt(72, 170, t.inspectionLabel, { size: 11.5, weight: 700, fill: C.cyanDeep, spacing: 1.6 }));
  let ix = 72;
  for (const item of t.inspection) {
    const chip = pill(ix, 190, item, { size: 12, fill: C.cyanSoft, color: C.cyanDeep, height: 28, pad: 12 });
    el.push(chip.svg);
    ix += chip.w + 14;
  }

  el.push(txt(48, 274, t.policyLabel, { size: 11.5, weight: 700, fill: C.muted, spacing: 1.6 }));

  // Allowed
  el.push(rect(48, 292, 330, 212, { fill: C.greenSoft, stroke: C.green, rx: 16 }));
  el.push(txt(72, 330, t.allowed.title, { size: 17, weight: 700, fill: C.green }));
  let ax = 72;
  for (const item of t.allowed.items) {
    const chip = effectChip(ax, 352, item, "allow");
    el.push(chip.svg);
    ax += chip.w + 10;
  }
  el.push(multi(72, 412, wrap(t.allowed.note, 280, 12.5), { size: 12.5, fill: C.muted, lineHeight: 19 }));
  el.push(txt(72, 474, t.allowed.tag, { size: 10.5, weight: 700, fill: C.green, spacing: 1.2 }));

  // Denied
  el.push(rect(402, 292, 396, 212, { fill: C.redSoft, stroke: C.red, rx: 16 }));
  el.push(txt(426, 330, t.denied.title, { size: 17, weight: 700, fill: C.red }));
  let dx = 426;
  for (const item of t.denied.items) {
    const chip = effectChip(dx, 352, item, "deny");
    el.push(chip.svg);
    dx += chip.w + 10;
  }
  el.push(multi(426, 412, wrap(t.denied.note, 340, 12.5), { size: 12.5, fill: C.muted, lineHeight: 19 }));
  el.push(txt(426, 474, t.denied.tag, { size: 10.5, weight: 700, fill: C.red, spacing: 1.2 }));

  // Authorization
  el.push(rect(822, 292, 330, 212, { fill: C.violetSoft, stroke: C.violet, rx: 16 }));
  el.push(txt(846, 330, t.auth.title, { size: 17, weight: 700, fill: C.violetDeep }));
  t.auth.commands.forEach((command, index) => {
    const item = pill(846, 348 + index * 30, command, {
      size: 11.5,
      fill: C.white,
      color: C.violetDeep,
      height: 25,
      mono: true,
      pad: 9,
      stroke: C.violet,
    });
    el.push(item.svg);
  });
  el.push(multi(846, 446, wrap(t.auth.note, 280, 11.5), { size: 11.5, fill: C.muted, lineHeight: 17 }));

  // Runtime protections
  el.push(txt(48, 548, t.runtimeLabel, { size: 11.5, weight: 700, fill: C.muted, spacing: 1.6 }));
  el.push(rect(48, 568, 1104, 96, { fill: C.ink, stroke: C.ink, rx: 16 }));
  const runtimeCols = [72, 410, 748];
  t.runtime.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = runtimeCols[col];
    const y = 588 + row * 34;
    el.push(`<circle cx="${x + 5}" cy="${y + 10}" r="3.5" fill="${index === 5 ? C.cyan : C.violet}"/>`);
    el.push(txt(x + 18, y + 14, item, { size: 12.5, fill: C.paper }));
  });

  el.push(footerNote(1200, 720, t.footnote, { x: 48, y: 698 }));
  return {
    width: 1200,
    height: 720,
    title: t.title,
    desc: t.alt,
    body: el.join("\n"),
  };
}

export function buildTransformation(t) {
  const el = [];
  el.push(header(t, { eyebrow: t.eyebrow }));

  // Before
  el.push(rect(48, 150, 432, 390, { fill: C.white, stroke: C.line, rx: 18 }));
  el.push(txt(72, 184, t.beforeLabel, { size: 11, weight: 700, fill: C.muted, spacing: 1.4 }));
  el.push(txt(72, 220, t.beforeTitle, { size: 24, weight: 700 }));
  el.push(txt(72, 242, t.beforeKind, { size: 12.5, fill: C.muted }));
  t.beforeRows.forEach((row, index) => {
    const y = 262 + index * 42;
    el.push(rect(72, y, 384, 34, { fill: C.paper2, rx: 8 }));
    el.push(txt(88, y + 22, row[0], { size: 13, family: MONO, weight: 600 }));
    el.push(txt(440, y + 22, row[1], { size: 11.5, fill: C.muted, anchor: "end" }));
  });
  el.push(multi(72, 488, wrap(t.beforeNote, 384, 12.5), { size: 12.5, fill: C.muted, lineHeight: 19 }));

  // Middle analysis arrow
  el.push(arrowH(486, 714, 300, { color: C.cyan, width: 3, marker: "arrowCyan" }));
  el.push(txt(600, 272, t.middleTitle, { size: 16, weight: 650, anchor: "middle" }));
  el.push(txt(600, 292, t.middleNote, { size: 11.5, fill: C.muted, anchor: "middle" }));

  // Recovery loop
  el.push(rect(504, 382, 192, 138, { fill: C.violetSoft, stroke: C.violet, rx: 14, dash: "5 4" }));
  el.push(txt(520, 412, t.loopTitle, { size: 13.5, weight: 700, fill: C.violetDeep }));
  t.loopLines.forEach((item, index) => {
    const y = 442 + index * 24;
    el.push(`<circle cx="524" cy="${y - 4}" r="2.5" fill="${C.violet}"/>`);
    el.push(txt(534, y, item, { size: 11.5, fill: C.muted }));
  });
  el.push(arrowH(480, 504, 452, { color: C.violet, width: 1.8, marker: "arrowViolet", dash: "4 3" }));
  el.push(arrowH(696, 720, 452, { color: C.violet, width: 1.8, marker: "arrowViolet", dash: "4 3" }));

  // After
  el.push(rect(720, 150, 432, 390, { fill: C.white, stroke: C.cyan, rx: 18, sw: 2 }));
  el.push(txt(744, 184, t.afterLabel, { size: 11, weight: 700, fill: C.cyanDeep, spacing: 1.4 }));
  t.afterRows.forEach((row, index) => {
    const y = 208 + index * 66;
    el.push(rect(744, y, 384, 54, { fill: C.paper, stroke: C.line, rx: 10 }));
    el.push(txt(760, y + 23, row[0], { size: 13.5, family: MONO, weight: 650 }));
    const tone = row[1] === "read" ? "allow" : row[1] === "write" ? "write" : "deny";
    const chip = effectChip(858, y + 15, row[1], tone);
    el.push(chip.svg);
    el.push(txt(1112, y + 33, row[2], { size: 11.5, fill: C.muted, anchor: "end" }));
  });
  el.push(multi(744, 492, wrap(t.afterNote, 384, 12.5), { size: 12.5, fill: C.muted, lineHeight: 19 }));

  // Output strip
  el.push(rect(48, 588, 1104, 68, { fill: C.cyanSoft, stroke: C.cyan, rx: 14 }));
  el.push(txt(72, 628, t.outputsLabel, { size: 11.5, weight: 700, fill: C.cyanDeep, spacing: 1.4 }));
  let ox = 300;
  for (const output of t.outputs) {
    const item = pill(ox, 606, output, { size: 13, fill: C.white, color: C.ink, height: 30, pad: 14, stroke: C.cyan });
    el.push(item.svg);
    ox += item.w + 16;
  }

  el.push(multi(48, 700, wrap(t.caveat, 1104, 13), { size: 13, fill: C.muted, lineHeight: 19 }));
  return {
    width: 1200,
    height: 760,
    title: t.title,
    desc: t.alt,
    body: el.join("\n"),
  };
}

export function buildEcosystem(t) {
  const el = [];
  el.push(header(t, { eyebrow: t.eyebrow }));

  // Manifest
  el.push(rect(432, 150, 336, 220, { fill: C.ink, stroke: C.ink, rx: 18 }));
  el.push(txt(456, 180, t.manifest.eyebrow, { size: 10.5, weight: 700, fill: C.cyan, spacing: 1.5 }));
  el.push(txt(456, 216, t.manifest.title, { size: 17, weight: 700, fill: C.paper, family: MONO }));
  el.push(txt(456, 240, t.manifest.schema, { size: 11, fill: C.mutedDark, family: MONO }));
  t.manifest.lines.forEach((item, index) => {
    const y = 274 + index * 22;
    el.push(`<circle cx="461" cy="${y - 4}" r="3" fill="${C.cyan}"/>`);
    el.push(txt(474, y, item, { size: 12, fill: C.paper }));
  });

  // Review inputs and static checks
  el.push(rect(48, 172, 320, 106, { fill: C.white, stroke: C.line, rx: 14 }));
  el.push(txt(72, 204, t.inputs.title, { size: 15.5, weight: 650 }));
  t.inputs.lines.forEach((item, index) =>
    el.push(txt(72, 230 + index * 20, item, { size: 11.5, fill: C.muted, family: index === 1 ? MONO : FONT })),
  );
  el.push(arrowH(368, 432, 212, { color: C.cyan, marker: "arrowCyan" }));

  el.push(rect(832, 172, 320, 106, { fill: C.white, stroke: C.line, rx: 14 }));
  el.push(txt(856, 204, t.checks.title, { size: 15.5, weight: 650 }));
  t.checks.lines.forEach((item, index) =>
    el.push(txt(856, 230 + index * 20, item, {
      size: 11.5,
      fill: C.muted,
      family: /[\u4e00-\u9fff]/.test(item) ? FONT : MONO,
    })),
  );
  el.push(arrowH(768, 832, 212, { color: C.cyan, marker: "arrowCyan" }));

  // Fan out
  el.push(line(600, 370, 600, 394, { color: C.cyan, width: 2.5 }));
  el.push(line(216, 394, 984, 394, { color: C.cyan, width: 2.5 }));
  el.push(arrowV(216, 394, 420, { color: C.cyan, marker: "arrowCyan" }));
  el.push(arrowV(600, 394, 420, { color: C.cyan, marker: "arrowCyan" }));
  el.push(arrowV(984, 394, 420, { color: C.cyan, marker: "arrowCyan" }));

  t.outputs.forEach((output, index) => {
    const x = 48 + index * 384;
    el.push(rect(x, 420, 336, 170, { fill: C.white, stroke: index === 0 ? C.cyan : C.line, rx: 16 }));
    el.push(txt(x + 24, 454, output.title, { size: 17, weight: 650 }));
    output.lines.forEach((item, lineIndex) =>
      el.push(txt(x + 24, 482 + lineIndex * 20, item, { size: 12, fill: C.muted })),
    );
    el.push(line(x + 24, 532, x + 312, 532, { color: C.line, width: 1 }));
    el.push(txt(x + 24, 558, output.hosts, { size: 11, fill: C.cyanDeep, weight: 600 }));
  });

  // Generated files
  el.push(rect(48, 626, 1104, 82, { fill: C.paper2, stroke: C.line, rx: 14 }));
  el.push(txt(72, 656, t.filesLabel, { size: 11.5, weight: 700, fill: C.muted, spacing: 1.4 }));
  let fx = 230;
  for (const file of t.files) {
    const item = pill(fx, 646, file, { size: 11, fill: C.white, color: C.ink, height: 26, pad: 10, mono: true, stroke: C.line });
    el.push(item.svg);
    fx += item.w + 10;
  }
  el.push(txt(72, 684, t.note, { size: 10.5, fill: C.muted }));

  return {
    width: 1200,
    height: 740,
    title: t.title,
    desc: t.alt,
    body: el.join("\n"),
  };
}

export function buildFeatures(t) {
  const el = [];
  el.push(header(t, { eyebrow: t.eyebrow }));
  const tones = [C.cyan, C.cyan, C.cyan, C.cyan, C.cyan, C.red, C.violet, C.cyan, C.violet];
  t.cards.forEach((card, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 48 + col * 376;
    const y = 150 + row * 198;
    el.push(rect(x, y, 352, 178, { fill: C.white, stroke: C.line, rx: 16 }));
    el.push(`<rect x="${x}" y="${y}" width="352" height="4" rx="2" fill="${tones[index]}"/>`);
    el.push(rect(x + 24, y + 26, 36, 36, { fill: tones[index] === C.red ? C.redSoft : tones[index] === C.violet ? C.violetSoft : C.cyanSoft, rx: 10 }));
    el.push(txt(x + 42, y + 50, String(index + 1).padStart(2, "0"), {
      size: 11,
      weight: 700,
      fill: tones[index] === C.red ? C.red : tones[index] === C.violet ? C.violetDeep : C.cyanDeep,
      anchor: "middle",
      family: MONO,
    }));
    el.push(txt(x + 74, y + 50, card[0], { size: 17, weight: 650 }));
    el.push(multi(x + 24, y + 92, wrap(card[1], 304, 13), { size: 13, fill: C.muted, lineHeight: 19 }));
  });
  el.push(footerNote(1200, 820, t.footnote, { x: 48, y: 786 }));
  return {
    width: 1200,
    height: 820,
    title: t.title,
    desc: t.alt,
    body: el.join("\n"),
  };
}

export function buildBanner(t) {
  const el = [];
  el.push(`<rect width="1600" height="360" fill="url(#gridDark)" opacity="0.55"/>`);
  el.push(`<rect x="0" y="0" width="8" height="360" fill="${C.cyan}"/>`);
  el.push(markGlyph(64, 76, 200));
  el.push(txt(304, 142, t.title, { size: 58, weight: 700, fill: C.paper, spacing: 0 }));
  const tagline = wrap(t.tagline, 520, 21);
  el.push(multi(304, 190, tagline, { size: 21, fill: C.paper, lineHeight: 29 }));
  el.push(txt(304, 262, t.sub, { size: 14, fill: C.mutedDark }));

  el.push(txt(880, 108, t.pipelineLabel, { size: 10.5, weight: 700, fill: C.cyan, spacing: 1.7 }));
  const widths = [176, 176, 176];
  const xs = [880, 1080, 1280];
  t.pipeline.forEach((label, index) => {
    const accent = index === 1;
    el.push(rect(xs[index], 124, widths[index], 82, {
      fill: accent ? C.navy2 : C.navy,
      stroke: accent ? C.cyan : C.lineDark,
      rx: 14,
      sw: accent ? 2 : 1.5,
    }));
    el.push(txt(xs[index] + widths[index] / 2, 172, label, {
      size: 14,
      weight: accent ? 700 : 600,
      fill: accent ? C.cyan : C.paper,
      anchor: "middle",
    }));
    if (index < 2) el.push(arrowH(xs[index] + widths[index] + 2, xs[index + 1] - 4, 165, { color: C.cyan, marker: "arrowCyan" }));
  });

  el.push(line(64, 306, 824, 306, { color: C.lineDark, width: 1 }));
  el.push(txt(64, 334, REPO, { size: 12.5, fill: C.mutedDark, family: MONO }));
  return {
    width: 1600,
    height: 360,
    title: t.title,
    desc: t.alt,
    body: el.join("\n"),
    background: C.navy,
    extraDefs: gridPattern("gridDark", C.lineDark),
  };
}

export function buildOg(t) {
  const el = [];
  el.push(`<rect width="1200" height="630" fill="url(#gridDark)" opacity="0.5"/>`);
  el.push(`<rect x="0" y="0" width="1200" height="8" fill="${C.cyan}"/>`);
  el.push(markGlyph(72, 62, 124));
  el.push(txt(220, 96, t.kicker, { size: 12.5, weight: 700, fill: C.cyan, spacing: 1.7 }));
  el.push(txt(220, 150, t.title, { size: 48, weight: 700, fill: C.paper, spacing: 0 }));

  el.push(multi(72, 226, wrap(t.tagline, 1040, 26), { size: 26, fill: C.paper, lineHeight: 36 }));

  const xs = [72, 428, 784];
  t.pipeline.forEach((label, index) => {
    const accent = index === 1;
    el.push(rect(xs[index], 330, 320, 108, {
      fill: accent ? C.navy2 : C.navy,
      stroke: accent ? C.cyan : C.lineDark,
      rx: 16,
      sw: accent ? 2 : 1.5,
    }));
    el.push(txt(xs[index] + 24, 362, `0${index + 1}`, { size: 11, weight: 700, fill: accent ? C.cyan : C.mutedDark, family: MONO, spacing: 1.2 }));
    el.push(txt(xs[index] + 24, 398, label, { size: 18, weight: 650, fill: accent ? C.cyan : C.paper }));
    if (index < 2) el.push(arrowH(xs[index] + 324, xs[index + 1] - 6, 384, { color: C.cyan, marker: "arrowCyan" }));
  });

  el.push(line(72, 510, 1128, 510, { color: C.lineDark, width: 1 }));
  el.push(txt(72, 548, t.footer, { size: 16, fill: C.paper }));
  el.push(txt(1128, 596, t.repo, { size: 12.5, fill: C.mutedDark, anchor: "end", family: MONO }));
  return {
    width: 1200,
    height: 630,
    title: t.title,
    desc: t.alt,
    body: el.join("\n"),
    background: C.navy,
    extraDefs: gridPattern("gridDark", C.lineDark),
  };
}

export function buildReleaseTemplate(t) {
  const el = [];
  el.push(`<rect width="1200" height="630" fill="url(#gridDark)" opacity="0.5"/>`);
  el.push(`<rect x="0" y="0" width="1200" height="8" fill="${C.cyan}"/>`);
  el.push(markGlyph(72, 54, 82));
  el.push(txt(180, 88, t.kicker, { size: 12, weight: 700, fill: C.cyan, spacing: 1.8 }));
  el.push(txt(1128, 88, t.templateNote, { size: 11.5, fill: C.mutedDark, anchor: "end" }));
  el.push(txt(72, 184, t.version, { size: 66, weight: 700, fill: C.paper, family: MONO, spacing: 0 }));
  el.push(txt(72, 236, t.title, { size: 32, weight: 650, fill: C.cyan }));
  el.push(multi(72, 274, wrap(t.summary, 1020, 17), { size: 17, fill: C.mutedDark, lineHeight: 25 }));

  t.boxes.forEach((box, index) => {
    const x = 72 + index * 348;
    el.push(rect(x, 338, 312, 152, { fill: C.navy, stroke: C.lineDark, rx: 14 }));
    el.push(txt(x + 22, 374, box[0], { size: 15.5, weight: 650, fill: C.paper }));
    el.push(txt(x + 22, 420, box[1], { size: 12.5, fill: C.mutedDark }));
    el.push(line(x + 22, 446, x + 290, 446, { color: C.lineDark, width: 1 }));
    el.push(txt(x + 22, 468, "—", { size: 12.5, fill: C.mutedDark }));
  });

  el.push(line(72, 536, 1128, 536, { color: C.lineDark, width: 1 }));
  el.push(txt(72, 576, t.footer, { size: 13, fill: C.mutedDark, family: MONO }));
  return {
    width: 1200,
    height: 630,
    title: t.version,
    desc: t.alt,
    body: el.join("\n"),
    background: C.navy,
    extraDefs: gridPattern("gridDark", C.lineDark),
  };
}

export function buildMark() {
  const body = markGlyph(0, 0, 512, { background: true });
  return {
    width: 512,
    height: 512,
    title: "SDK-Anything mark",
    desc: "A package cube with an output arrow, representing SDKs converted into generated tool surfaces.",
    body,
    background: C.navy,
  };
}

function iconGlyph(name) {
  const stroke = `stroke="${C.ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="1" fill="none"`;
  const accent = `stroke="${C.cyanDeep}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="1" fill="none"`;
  const accentFill = `fill="${C.cyanDeep}"`;
  switch (name) {
    case "source":
      return (
        `<path d="M 32 12 L 51 22 L 51 42 L 32 52 L 13 42 L 13 22 Z" ${stroke}/>` +
        `<path d="M 13 22 L 32 32 L 51 22 M 32 32 L 32 52" ${stroke}/>` +
        `<circle cx="32" cy="32" r="3.4" ${accentFill}/>`
      );
    case "analyzer":
      return (
        `<circle cx="28" cy="28" r="12" ${stroke}/><path d="M 37 37 L 49 49" ${accent}/>` +
        `<path d="M 23 25 L 20 28 L 23 31 M 33 25 L 36 28 L 33 31" ${accent}/>`
      );
    case "manifest":
      return (
        `<rect x="17" y="11" width="30" height="42" rx="4" ${stroke}/>` +
        `<path d="M 24 23 H 40 M 24 30 H 40 M 24 37 H 34" ${accent}/>` +
        `<path d="M 24 45 H 32" ${stroke}/>`
      );
    case "mcp":
      return (
        `<rect x="21" y="12" width="22" height="16" rx="4" ${stroke}/>` +
        `<path d="M 27 12 V 6 M 37 12 V 6" ${stroke}/>` +
        `<path d="M 32 28 V 40" ${accent}/><circle cx="32" cy="45" r="4" ${accent}/>`
      );
    case "cli":
      return (
        `<rect x="10" y="13" width="44" height="38" rx="6" ${stroke}/>` +
        `<path d="M 18 25 L 25 32 L 18 39" ${accent}/><path d="M 29 39 H 43" ${accent}/>`
      );
    case "skill":
      return (
        `<path d="M 32 8 L 37 27 L 56 32 L 37 37 L 32 56 L 27 37 L 8 32 L 27 27 Z" ${accent}/>` +
        `<circle cx="32" cy="32" r="3.2" ${accentFill}/>`
      );
    case "security":
      return (
        `<path d="M 32 8 L 50 15 V 30 C 50 42 42 50 32 56 C 22 50 14 42 14 30 V 15 Z" ${stroke}/>` +
        `<path d="M 23 31 L 29 37 L 42 24" ${accent}/>`
      );
    case "diagnostics":
      return (
        `<path d="M 32 10 L 56 52 H 8 Z" ${stroke}/>` +
        `<path d="M 32 24 V 38" ${accent}/><circle cx="32" cy="45" r="2.6" ${accentFill}/>`
      );
    default:
      return (
        `<path d="M 25 10 H 39 M 29 10 V 26 L 18 47 A 5 5 0 0 0 22 54 H 42 A 5 5 0 0 0 46 47 L 35 26 V 10" ${stroke}/>` +
        `<path d="M 24 42 L 30 48 L 41 36" ${accent}/>`
      );
  }
}

export function buildIcon(name) {
  const meta = iconMeta[name];
  const body =
    `<rect x="2" y="2" width="60" height="60" rx="14" fill="${C.paper}" stroke="${C.line}" stroke-width="1.4"/>` +
    iconGlyph(name);
  return {
    width: 64,
    height: 64,
    title: meta.title,
    desc: meta.desc,
    body,
    background: "none",
  };
}
