# CLAUDE.md — ROM GUARD

An English-language dataset answering one question about Xiaomi ROM changes:
can the change be undone?

**Nonprofit. Do not add advertising or affiliate links.** Monetization was rejected
on 2026-08-09 after measuring demand: 110 ROM/unlock keywords totaled 1,470 monthly
searches. Accessory searches had demand but retailer listings occupied the results.

## Mandatory rules

1. **Never mirror ROM files.** Redistribution rights and source obligations must
   not be assumed. Distributing a compromised ROM also makes this project a source
   of that binary. `scripts/validate.mjs` enforces `roms.policy.mirror: false` and
   rejects `mirror_url`.
2. **Never publish flashing instructions.** They become obsolete quickly and a
   mistake can permanently damage a device. Link to primary sources instead.
3. **Never guess data.** Every non-null `value` requires a source URL and a
   `verified_at` date. Leave unverified values `null`.
4. **Record only hashes computed locally from the downloaded bytes.** Validation
   rejects hashes copied from an upstream listing, which could itself be compromised.

## Structure

```text
data/          devices.json, rules.json, roms.json; the source dataset
schema/        unused; validation lives in validate.mjs
scripts/
  validate.mjs validates data before every build
  build.mjs    generates risk/device pages, copies data, and creates the sitemap
public/        deployment files; generated pages/data/sitemap are gitignored
```

## Commands

```sh
node scripts/validate.mjs
node scripts/build.mjs
npm run deploy
```

## Repository and design

`gdalabs/romguard` is public. Secret scanning, push protection, Dependabot, and
CodeQL were enabled. The interface uses an amber terminal style in
`public/style.css`; amber keeps red available for warnings.

## Deployment

Cloudflare Pages project: `romguard`. A custom domain had not been acquired as of
2026-08-09. Do not announce the site, build backlinks, or register it with Search
Console until a custom domain is connected. Deployment currently serves verification.

## Parallel range hashing (2026-08-10)

Use `scripts/hash-rom.sh`. **Do not replace it with a single `curl | sha256sum`.**
The source host throttled a connection to about 26 KB/s after an initial burst;
a 9.2 GB download would take about four days. Four independent connections reached
about 16 MB/s each, so byte ranges are fetched concurrently.

Fetch `PAR` chunks, stream them into sha256sum in their original order, then delete
the chunks immediately. Peak temporary disk use is `PAR * CHUNK` (256 MB by
default); a complete ROM is never retained.

```sh
PAR=4 CHUNK=$((64*1024*1024)) scripts/hash-rom.sh <url> <id> <device> <rom>
```

Preserve these correctness guards:

- Reject responses that ignore Range requests (anything other than HTTP 206).
- Check every chunk's byte count; truncated reads must fail.
- Emit a hash only if total bytes match Content-Length.

## Data gaps (2026-08-09)

15 of 25 fields were unverified (60%). `arb` and `felica` require physical-device
checks or fastboot ROM metadata. Available hardware has not been confirmed.
ROM hashes can be computed from downloads without a device; none had been recorded
at that checkpoint. These dated counts are historical, not live dataset totals.

## Pending

- Acquire a custom domain before announcing the site.
- Verify `arb` and `felica` when suitable devices or metadata become available.
- Keep all documentation, internal notes, generated pages, and UI in English.
