# Contributing

Thanks for filling in a gap. There is essentially one rule.

## A value needs a source and a date

```json
"arb": { "value": 4, "source": "https://…", "verified_at": "2026-08-09", "note": null }
```

If you cannot cite where the value came from and when you confirmed it, leave it `null`.
`scripts/validate.mjs` rejects a non-null value without both, and rejects a `null` value
that still carries a leftover source.

Guessing is worse than an empty cell here. An incorrect ARB index leads someone to flash
a downgrade, which burns an eFuse and ends the device permanently.

## What "source" means per field

| Field | Acceptable source |
|---|---|
| `bl_unlock` | Xiaomi's own unlock page, or a maintained community thread stating the current policy |
| `edl_auth` | Documentation of the authorized-account restriction |
| `arb` | The fastboot ROM's own metadata, or a screenshot/log from the device. **Not** a forum post repeating a number. |
| `felica` | Manufacturer spec page for the specific market model, or first-hand confirmation |
| `lineageos` | The official LineageOS device page |

For first-hand confirmation, link to a public gist/issue containing the log or screenshot,
and say which device and firmware build it came from.

## ROM hashes

Compute the hash yourself from a file you downloaded. Transcribing a hash shown on the
upstream page is rejected — it would repeat the upstream's claim rather than verify it,
so a compromised upstream would be confirmed rather than caught.

`mirror_url` is not an accepted field. This project does not mirror ROM files.

## What is out of scope

- Flashing instructions or tutorials
- Links to ROM mirrors or file lockers
- Recommending a particular custom ROM

## Checks

```sh
node scripts/validate.mjs
node scripts/build.mjs
```

Both must pass. Please do not commit generated files under `public/risk/`,
`public/devices/`, `public/data/` or `public/sitemap.xml` — they are rebuilt.
