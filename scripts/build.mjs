#!/usr/bin/env node
/**
 * data -> static HTML. No dependencies.
 *
 *   node scripts/build.mjs
 *
 * /risk/, /devices/ and /verify/ are generated from data/*.json rather than hand-written,
 * because the failure mode that matters is data and page drifting apart silently.
 * Also writes the sitemap. Fewer than 50 URLs, so no layered split.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const PUB = join(ROOT, "public");
const ORIGIN = "https://romguard.pages.dev";

// Validate before generating. Never build pages from data that failed its checks.
execFileSync(process.execPath, [join(ROOT, "scripts/validate.mjs")], { stdio: "inherit" });

const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const rules = read("rules.json");
const devices = read("devices.json");
const roms = read("roms.json");

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const srcList = (a) => (a?.length ? `<p class="src">Sources: ${a.map((u, i) => `<a href="${esc(u)}" rel="noopener nofollow" target="_blank">[${i + 1}]</a>`).join(" ")}</p>` : "");

const NAV = [
  ["/", "check"],
  ["/risk/", "what cannot be undone"],
  ["/verify/", "hashes"],
  ["/devices/", "devices"],
  ["/about/", "about"],
];

function page({ path, title, desc, body }) {
  const nav = NAV.map(([h, t]) =>
    `<a href="${h}"${h === path ? ' aria-current="page"' : ""}>${t}</a>`).join("\n    ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${ORIGIN}${path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="/">ROM<span>/</span>GUARD</a>
  <nav class="site">
    ${nav}
  </nav>
</div></header>

<main class="wrap">
${body}
</main>

<footer class="site"><div class="wrap">
  <p>ROM GUARD — no warranty. Flashing can end a device permanently. Follow the laws that apply where you are.</p>
  <p>Data CC BY 4.0 / code MIT · <a href="https://github.com/gdalabs/romguard">GitHub</a> · GDA Labs</p>
</div></footer>
</body>
</html>
`;
}

/* ---------------- /risk/ ---------------- */
const SEV = {
  permanent: ["danger", "irrecoverable"],
  "practically-permanent": ["danger", "not recoverable by the user"],
  "usually-recoverable": ["warn", "usually recoverable"],
};

const riskBody = `
<h1>What cannot be undone</h1>
<p class="lead">
  Most ROM-flashing failures can be recovered using the official fastboot ROM.
  Irrecoverable failures are limited; the two principal cases below can only be <strong>avoided before flashing</strong>.
</p>

${rules.irreversible.map((r) => {
  const [cls, label] = SEV[r.severity] ?? ["warn", r.severity];
  return `
<h2 id="${esc(r.id)}">${esc(r.title)} <span class="tag ${cls}">${esc(label)}</span></h2>
<div class="panel ${cls}">
  <p><strong>What happens:</strong> ${esc(r.what)}</p>
  <p><strong>Result:</strong> ${esc(r.result)}</p>
  <p><strong>How you get there:</strong> ${esc(r.trigger)}</p>
  <p><strong>How to avoid it:</strong> ${esc(r.avoid)}</p>
  ${srcList(r.sources)}
</div>`;
}).join("\n")}

<h2 id="reversible">What is recoverable</h2>
${rules.reversible.map((r) => `
<div class="panel ok">
  <div class="verdict">${esc(r.title)}</div>
  <p>${esc(r.how)}</p>
  <p><strong>Caveat:</strong> ${esc(r.caveat)}</p>
  ${srcList(r.sources)}
</div>`).join("\n")}

<h2 id="lost">What unlocking can cost you</h2>
<p>These do not brick the device, but <strong>can begin at unlock and may persist after relocking</strong>.</p>
<div class="scroll"><table>
<tr><th style="width:30%">Item</th><th>Detail</th></tr>
${rules.lost_on_unlock.map((l) => `<tr><th>${esc(l.title)}</th><td>${esc(l.detail)}${srcList(l.sources)}</td></tr>`).join("\n")}
</table></div>

<h2 id="policy">Whether you can unlock at all</h2>
<p>${esc(rules.unlock_policy.summary)}</p>
<ul>${rules.unlock_policy.conditions.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
${srcList(rules.unlock_policy.sources)}

<h2 id="layers">Which layers actually change</h2>
<p>It is tempting to assume that because HyperOS is itself a modified Android, a third party can replace
the whole stack. It cannot. Only the top layer is in reach.</p>
<div class="scroll"><table>
<tr><th style="width:45%">Layer</th><th style="width:15%">Third party</th><th>Notes</th></tr>
${rules.layers.map((l) => `<tr><th>${esc(l.name)}</th><td>${l.flashable_by_third_party ? '<span class="tag warn">writable</span>' : '<span class="tag">locked</span>'}</td><td>${esc(l.detail)}</td></tr>`).join("\n")}
</table></div>

<h2 id="rom-types">ROM types and what "open source" means here</h2>
<p>Whether "it's open source, so it's safe" holds depends entirely on which of these you mean.</p>
${rules.rom_types.map((t) => `
<div class="panel">
  <div class="verdict">${esc(t.name)} <span class="tag ${t.open_source ? "ok" : "warn"}">${t.open_source ? "source published" : "source closed"}</span></div>
  <p>${esc(t.detail)}</p>
</div>`).join("\n")}
<div class="panel warn">
  <p>Independently of any of that: <strong>unlocking the bootloader disables Verified Boot.</strong>
  Whatever you flash, you are choosing to run a device that no longer checks itself at boot.</p>
</div>
`;

/* ---------------- /devices/ ---------------- */
const F = [
  ["bl_unlock", "unlock"],
  ["edl_auth", "EDL auth"],
  ["arb", "ARB index"],
  ["felica", "FeliCa"],
  ["lineageos", "LineageOS"],
];
const cell = (f) => {
  if (!f || f.value == null) return '<span class="tag unknown">unverified</span>';
  const v = typeof f.value === "boolean" ? (f.value ? "yes" : "no") : f.value;
  return `${esc(v)}<div class="src">${esc(f.verified_at)} <a href="${esc(f.source)}" rel="noopener nofollow" target="_blank">src</a></div>`;
};
const totalCells = devices.devices.length * F.length;
const unknownCells = devices.devices.reduce((n, d) => n + F.filter(([k]) => d.fields?.[k]?.value == null).length, 0);

const devicesBody = `
<h1>Devices</h1>
<p class="lead">
  ${devices.devices.length} devices / <strong>${unknownCells} of ${totalCells} fields unverified</strong> (${Math.round(unknownCells / totalCells * 100)}%).
  Blank means not yet verified; it is never filled by guessing.
  <code>arb</code> and <code>felica</code> require a device or fastboot ROM metadata, so most entries are blank.
</p>
<div class="scroll"><table>
<tr><th>Device</th><th>Markets</th>${F.map(([, l]) => `<th>${l}</th>`).join("")}</tr>
${devices.devices.map((d) => `<tr>
  <th>${esc(d.name)}</th><td>${esc(d.markets.join(" / "))}</td>
  ${F.map(([k]) => `<td>${cell(d.fields?.[k])}</td>`).join("")}
</tr>`).join("\n")}
</table></div>

<h2>Filling a cell</h2>
<p>If you can verify one field, send a pull request to <a href="https://github.com/gdalabs/romguard">GitHub</a>. There is one rule.</p>
<div class="panel">
  <p><strong>Every value requires <code>source</code> (URL) and <code>verified_at</code> (date).</strong>
  Leave guesses, hearsay, and assumptions <code>null</code>. <code>scripts/validate.mjs</code> enforces this.</p>
</div>
<pre>${esc(JSON.stringify({ arb: { value: 4, source: "https://…", verified_at: "2026-08-09", note: null } }, null, 2))}</pre>
<p class="src">Last updated: ${esc(devices.updated_at)}</p>
`;

/* ---------------- output ---------------- */
const pages = [
  { path: "/risk/", file: "risk/index.html", title: "Irreversible conditions — ARB and EDL | ROM GUARD",
    desc: "Irreversible Xiaomi ROM failure conditions, including ARB and EDL authorization, and what can be recovered.", body: riskBody },
  { path: "/devices/", file: "devices/index.html", title: "Devices | ROM GUARD",
    desc: "Per-device Xiaomi unlock, ARB, FeliCa, and LineageOS data. Unverified fields remain explicit.", body: devicesBody },
];

for (const p of pages) {
  const out = join(PUB, p.file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, page(p));
  console.log(`generated ${p.file}`);
}

// Ship the same JSON the repository holds.
mkdirSync(join(PUB, "data"), { recursive: true });
for (const f of readdirSync(DATA)) copyFileSync(join(DATA, f), join(PUB, "data", f));
console.log(`copied ${readdirSync(DATA).length} data files`);

// Sitemap: fewer than 50 URLs, so no layered split (consider splitting above 100).
const today = new Date().toISOString().slice(0, 10);
const urls = ["/", "/risk/", "/verify/", "/devices/", "/about/"];
writeFileSync(join(PUB, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
  `\n</urlset>\n`);
console.log(`sitemap: ${urls.length} urls`);
console.log(`roms.json: ${roms.roms.length} hash records`);
