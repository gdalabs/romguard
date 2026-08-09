# CLAUDE.md — ROM GUARD

A dataset about Xiaomi ROM changes that answers only whether a change can be undone.
**Nonprofit. Do not add advertising or affiliate links.** Monetization was rejected after measurements on 2026-08-09:
110 ROM-related keywords totaled 1,470 monthly searches; accessory searches had demand but retail listings occupied the results.

## Mandatory rules

1. **Never mirror ROM files.** Redistribution rights cannot be assumed, and distributing binaries can require providing corresponding source.
   A compromised binary makes the mirror its distributor. Safe Browsing warnings and hosting suspension can render the project unavailable.
   `scripts/validate.mjs` enforces `roms.policy.mirror: false` and rejects `mirror_url`.
2. **Never publish flashing instructions.** They become obsolete quickly and mistakes cause serious damage. Link to primary sources instead.
3. **Never guess data.** A non-null `value` requires `source` (URL) and `verified_at` (date).
   Leave unverified values `null`. **This distinction is the value of the dataset**; relaxing it defeats the purpose.
4. **Use only locally computed hashes.** Validation rejects hashes copied from an upstream listing
   because that would confirm a compromised upstream rather than detect it.

## Structure

```
data/          source dataset: devices.json / rules.json / roms.json
schema/        unused; validation is implemented in validate.mjs
scripts/
  validate.mjs validates data before every build
  build.mjs    generates /risk/ and /devices/, copies data, creates sitemap
public/        deployment files; risk/, devices/, data/, sitemap.xml are generated and gitignored
```

## Commands

```sh
node scripts/validate.mjs     # Validate data only
node scripts/build.mjs        # Validate, then generate
npm run deploy                # build → wrangler pages deploy public --project-name romguard
```

## Repository

**gdalabs/romguard (public)**. Secret scanning, push protection, Dependabot, and CodeQL are enabled.
The design is an **amber terminal** (`public/style.css`). Monospace throughout; amber was chosen instead of green
to coexist with the red used for danger warnings.

## Deployment

Cloudflare Pages `romguard`. **No custom domain acquired** as of 2026-08-09.
The project does not present `*.pages.dev` to end users. **Announcements, backlinks, and Search Console registration must wait
until a custom domain is connected**. Current deployment is for verification.

## Parallel range hashing (2026-08-10)

Use `scripts/hash-rom.sh`. **Do not revert to a single `curl | sha256sum`.**

d.miui.com throttles each connection after an initial burst: measured **26 KB/s**, about four days for 9.2 GB.
The limit is **per connection**; four connections each reached 16 MB/s. Fetch byte ranges concurrently.

Hash order matters: **fetch PAR chunks concurrently, stream them into sha256sum in order, then delete them immediately**.
Peak temporary disk use is `PAR * CHUNK` (256 MB by default). The entire ROM is never retained,
so the no-mirroring policy holds literally.

```sh
PAR=4 CHUNK=$((64*1024*1024)) scripts/hash-rom.sh <url> <id> <device> <rom>
```

**Preserve these guards** to prevent confidently emitting an incorrect hash:
- **Reject** responses that ignore Range (not HTTP 206), or the same range would be hashed repeatedly.
- Verify every chunk byte count; never accept a truncated read.
- Emit a hash only if total bytes match Content-Length.

## Data gaps (2026-08-09)

15 of 25 fields remain unverified (60%). `arb` and `felica` **require a device or fastboot ROM metadata
to verify**. Available Xiaomi hardware has not been confirmed, so these fields remain pending.
ROM SHA-256 values can be computed from downloads without a device (currently zero records).

## Pending

- Acquire a custom domain (undecided). Do not announce the site beforehand.
- Public repository `gdalabs/romguard` has not been created; README/CONTRIBUTING already link to it.
- Verify `arb` and `felica` when suitable hardware becomes available.
