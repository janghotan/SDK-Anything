// Shared primitives for deterministic, self-contained SVG generation.
// No external fonts, images, scripts, or network resources are referenced.

export const C = {
  ink: "#0B1220",
  ink2: "#122036",
  navy: "#0A1424",
  navy2: "#101D33",
  paper: "#F7F5EF",
  paper2: "#EFEBE1",
  white: "#FFFFFF",
  line: "#D9D3C6",
  lineStrong: "#BDB6A7",
  lineDark: "#26344D",
  muted: "#5C6576",
  mutedDark: "#9DA9BE",
  cyan: "#18B6D9",
  cyanDeep: "#087F9C",
  cyanSoft: "#DDF4F9",
  violet: "#7C6CF0",
  violetDeep: "#5B4CD6",
  violetSoft: "#ECE9FD",
  green: "#1F8A70",
  greenSoft: "#DDF2EA",
  red: "#B3453F",
  redSoft: "#F7E3E1",
  amber: "#A96B12",
  amberSoft: "#F8EBD5",
};

export const FONT = "'Noto Sans CJK SC', 'Noto Sans', sans-serif";
export const MONO = "'JetBrains Mono', 'Noto Sans Mono CJK SC', monospace";

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function estWidth(value, size, mono = false) {
  let units = 0;
  for (const ch of String(value)) {
    if (/\s/.test(ch)) units += 0.32;
    else if (/[\u2E80-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/.test(ch))
      units += 1;
    else if (/[A-Z0-9@#%&]/.test(ch)) units += 0.66;
    else if (/[mwMW]/.test(ch)) units += 0.82;
    else units += 0.55;
  }
  return units * size * (mono ? 1.02 : 1);
}

export function wrap(value, maxWidth, size, { mono = false } = {}) {
  const text = String(value);
  if (estWidth(text, size, mono) <= maxWidth) return [text];
  const hasCJK = /[\u2E80-\u9FFF]/.test(text);
  const hasSpaces = /\s/.test(text.trim());
  const units = hasCJK
    ? Array.from(text)
    : hasSpaces
      ? text.split(/\s+/)
      : Array.from(text);
  const joiner = hasCJK || !hasSpaces ? "" : " ";
  const lines = [];
  let current = "";
  for (const unit of units) {
    const candidate = current ? `${current}${joiner}${unit}` : unit;
    if (current && estWidth(candidate, size, mono) > maxWidth) {
      lines.push(current.trimEnd());
      current = unit.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current.trimEnd());
  return lines;
}

export function txt(
  x,
  y,
  value,
  {
    size = 14,
    weight = 400,
    fill = C.ink,
    anchor = "start",
    family = FONT,
    spacing = 0,
    opacity = 1,
  } = {},
) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}" opacity="${opacity}">${esc(value)}</text>`;
}

export function multi(
  x,
  y,
  values,
  {
    size = 14,
    weight = 400,
    fill = C.ink,
    lineHeight = Math.round(size * 1.45),
    family = FONT,
    anchor = "start",
  } = {},
) {
  const spans = values
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`,
    )
    .join("");
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${spans}</text>`;
}

export function rect(x, y, w, h, { fill = C.white, stroke = "none", rx = 16, sw = 1.5, opacity = 1, dash = "" } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
}

export function line(x1, y1, x2, y2, { color = C.line, width = 1.5, dash = "", opacity = 1 } = {}) {
  return `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-opacity="1" fill="none" opacity="${opacity}"/>`;
}

export function path(d, { color = C.line, width = 1.5, dash = "", fill = "none", marker = "" } = {}) {
  return `<path d="${d}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-opacity="1" fill="${fill}"${marker ? ` marker-end="url(#${marker})"` : ""}/>`;
}

export function arrowH(x1, x2, y, { color = C.cyan, width = 2.5, dash = "", marker = "arrowCyan" } = {}) {
  return path(`M ${x1} ${y} L ${x2} ${y}`, { color, width, dash, marker });
}

export function arrowV(x, y1, y2, { color = C.cyan, width = 2.5, dash = "", marker = "arrowCyan" } = {}) {
  return path(`M ${x} ${y1} L ${x} ${y2}`, { color, width, dash, marker });
}

export function pill(x, y, value, { size = 13, fill = C.cyanSoft, color = C.cyanDeep, height = 26, pad = 12, mono = false, stroke = "none" } = {}) {
  const w = Math.ceil(estWidth(value, size, mono) + pad * 2);
  const svg =
    rect(x, y, w, height, { fill, stroke, rx: height / 2, sw: 1.2 }) +
    txt(x + w / 2, y + height / 2 + size * 0.35, value, {
      size,
      weight: 600,
      fill: color,
      anchor: "middle",
      family: mono ? MONO : FONT,
    });
  return { svg, w };
}

export function badge(x, y, value, { size = 12, weight = 700, fill = C.cyan, color = C.ink, spacing = 1.2, pad = 12, height = 26 } = {}) {
  const w = Math.ceil(estWidth(value, size) + pad * 2);
  return {
    svg:
      rect(x, y, w, height, { fill, rx: 7 }) +
      txt(x + w / 2, y + height / 2 + size * 0.35, value, {
        size,
        weight,
        fill: color,
        anchor: "middle",
        spacing,
      }),
    w,
  };
}

export function markers() {
  const marker = (id, color) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`;
  return [
    marker("arrowCyan", C.cyan),
    marker("arrowInk", C.ink),
    marker("arrowMuted", C.lineStrong),
    marker("arrowViolet", C.violet),
    marker("arrowRed", C.red),
  ].join("");
}

export function gridPattern(id, color, opacity = 0.5) {
  return `<pattern id="${id}" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="${color}" stroke-width="1"/></pattern>`;
}

export function svgDoc({ width, height, title, desc, lang, body, background = C.paper, extraDefs = "" }) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc" xml:lang="${lang}">`,
    `<title id="title">${esc(title)}</title>`,
    `<desc id="desc">${esc(desc)}</desc>`,
    `<defs>${markers()}${extraDefs}</defs>`,
    `<rect width="${width}" height="${height}" fill="${background}"/>`,
    body,
    "</svg>",
    "",
  ].join("\n");
}

export function header(t, { eyebrow = "", x = 48, y = 44, width = 1104, dark = false } = {}) {
  const titleFill = dark ? C.paper : C.ink;
  const muted = dark ? C.mutedDark : C.muted;
  let body = "";
  if (eyebrow) {
    body += txt(x, y - 10, eyebrow, {
      size: 12,
      weight: 700,
      fill: dark ? C.cyan : C.cyanDeep,
      spacing: 1.8,
    });
  }
  body += txt(x, y + 22, t.title, {
    size: 31,
    weight: 700,
    fill: titleFill,
    spacing: 0,
  });
  body += txt(x, y + 50, t.subtitle, { size: 15.5, fill: muted });
  if (width) body += line(x, y + 68, x + width, y + 68, { color: dark ? C.lineDark : C.line, width: 1 });
  return body;
}

export function markGlyph(x, y, size, { background = false, bg = C.navy } = {}) {
  const scale = size / 512;
  const cubeTop = "M 205 140 L 315 204 L 205 268 L 95 204 Z";
  const cubeLeft = "M 95 204 L 205 268 L 205 404 L 95 340 Z";
  const cubeRight = "M 315 204 L 205 268 L 205 404 L 315 340 Z";
  const glyph =
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    (background ? `<rect width="512" height="512" rx="112" fill="${bg}"/>` : "") +
    `<path d="${cubeLeft}" fill="${C.ink2}" stroke="${C.paper}" stroke-width="16" stroke-linejoin="round"/>` +
    `<path d="${cubeRight}" fill="${C.navy2}" stroke="${C.paper}" stroke-width="16" stroke-linejoin="round"/>` +
    `<path d="${cubeTop}" fill="${C.cyan}" stroke="${C.paper}" stroke-width="16" stroke-linejoin="round"/>` +
    `<path d="M 342 256 L 436 256" stroke="${C.cyan}" stroke-width="24" stroke-linecap="round" stroke-opacity="1" fill="none"/>` +
    `<path d="M 414 232 L 456 256 L 414 280 Z" fill="${C.cyan}"/>` +
    "</g>";
  return glyph;
}

export function footerNote(width, height, value, { dark = false, x = 48, y = height - 26 } = {}) {
  return txt(x, y, value, { size: 12.5, fill: dark ? C.mutedDark : C.muted });
}

export function legend(x, y, items) {
  return items
    .map((item, index) => {
      const offset = index * 190;
      return (
        line(x + offset, y, x + offset + 34, y, { color: item.color, width: 2.5, dash: item.dash || "" }) +
        txt(x + offset + 44, y + 4, item.label, { size: 12.5, fill: C.muted })
      );
    })
    .join("");
}
