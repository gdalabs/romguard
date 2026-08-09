#!/usr/bin/env node
/**
 * Stop bad data mechanically. No dependencies.
 *
 *   node scripts/validate.mjs
 *
 * The value of this project is that it says "not verified" when it has not verified something,
 * so the rule that matters most is the first one below: **a non-null value requires both a
 * source and a verification date**. Relax that and the dataset becomes a confident-looking lie.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const STALE_DAYS = 180;

const read = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

const daysSince = (d) =>
  Math.floor((Date.parse(TODAY) - Date.parse(d)) / 86400000);

// Allow an explicit date argument for reproducible CI runs.
const TODAY = process.argv[2] || new Date().toISOString().slice(0, 10);

/* ---------- devices.json ---------- */
const devices = read("devices.json");
const REQUIRED_FIELDS = ["bl_unlock", "edl_auth", "arb", "felica", "lineageos"];
const seen = new Set();

if (!DATE.test(devices.updated_at)) err(`devices.updated_at is not a date: ${devices.updated_at}`);

for (const d of devices.devices) {
  const at = `devices[${d.id}]`;
  if (!d.id || !/^[a-z0-9-]+$/.test(d.id)) err(`${at}: id must be kebab-case`);
  if (seen.has(d.id)) err(`${at}: duplicate id`);
  seen.add(d.id);
  if (!d.name) err(`${at}: missing name`);
  if (!Array.isArray(d.markets) || d.markets.length === 0) err(`${at}: missing markets`);

  for (const key of REQUIRED_FIELDS) {
    const f = d.fields?.[key];
    if (!f) { err(`${at}.${key}: field missing entirely (use value:null to say "not verified")`); continue; }
    if (!("value" in f)) { err(`${at}.${key}: no value key`); continue; }

    if (f.value === null) {
      // Unverified is a valid state, but a leftover source contradicts it.
      if (f.source || f.verified_at)
        err(`${at}.${key}: value is null but source/verified_at is still set`);
      continue;
    }

    // The core rule.
    if (!f.source) err(`${at}.${key}: a value requires a source (do not guess)`);
    else if (!/^https?:\/\//.test(f.source)) err(`${at}.${key}: source must be a URL`);
    if (!f.verified_at) err(`${at}.${key}: a value requires verified_at`);
    else if (!DATE.test(f.verified_at)) err(`${at}.${key}: verified_at is not a date`);
    else if (daysSince(f.verified_at) > STALE_DAYS)
      warn(`${at}.${key}: verified ${daysSince(f.verified_at)} days ago (>${STALE_DAYS}). Re-check it or set it back to null`);
  }
}

/* ---------- roms.json ---------- */
const roms = read("roms.json");
if (roms.policy?.mirror !== false)
  err("roms.policy.mirror must stay false — this project does not mirror ROM files");
if (roms.policy?.hash_source !== "self-computed-only")
  err("roms.policy.hash_source must stay self-computed-only");

for (const r of roms.roms ?? []) {
  const at = `roms[${r.id ?? "?"}]`;
  if (!r.id) err(`${at}: missing id`);
  if (!r.source_url || !/^https?:\/\//.test(r.source_url)) err(`${at}: source_url is not a URL`);
  if (!SHA256.test(r.sha256 ?? "")) err(`${at}: sha256 is not 64 hex characters`);
  if (!DATE.test(r.verified_at ?? "")) err(`${at}: verified_at is not a date`);
  if (r.mirror_url) err(`${at}: mirror_url is not allowed`);
  if (r.hash_from_upstream) err(`${at}: hashes transcribed from upstream are not accepted`);
}

/* ---------- rules.json ---------- */
const rules = read("rules.json");
for (const group of ["irreversible", "reversible", "lost_on_unlock"]) {
  if (!Array.isArray(rules[group]) || rules[group].length === 0)
    err(`rules.${group} is empty`);
}
for (const r of rules.irreversible) {
  if (!r.sources?.length) err(`rules.irreversible[${r.id}]: no sources. Claims about permanent damage must be cited`);
  for (const k of ["what", "result", "trigger", "avoid"])
    if (!r[k]) err(`rules.irreversible[${r.id}]: missing ${k}`);
}

/* ---------- report ---------- */
const nullCount = devices.devices.reduce(
  (n, d) => n + REQUIRED_FIELDS.filter((k) => d.fields?.[k]?.value === null).length, 0);
const total = devices.devices.length * REQUIRED_FIELDS.length;

console.log(`devices: ${devices.devices.length} / ${nullCount} of ${total} fields unverified (${Math.round(nullCount / total * 100)}%)`);
console.log(`roms:    ${(roms.roms ?? []).length} hash records`);

for (const w of warnings) console.log(`WARN  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`ERROR ${e}`);
  console.error(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log("OK");
