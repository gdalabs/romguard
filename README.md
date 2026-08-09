# ROM GUARD

A Japanese-language dataset for Xiaomi ROM flashing that answers one question:
**can you undo this?**

Most flashing accidents are recoverable by writing the official fastboot ROM back.
A few are not. This project documents the ones that are not, and refuses to do
anything else.

- **No ROM files are hosted or mirrored.**
- **No flashing instructions.** They rot fastest and hurt most when wrong.
- **Unverified fields stay `null`.** Guessing bricks other people's phones.

## Why this exists

The two irreversible failure modes are documented in English only, scattered across
XDA threads, and do not exist in Japanese at all:

| Failure | Result |
|---|---|
| Anti-Rollback (ARB) violation | An eFuse flag is burned. No software or hardware recovery exists. |
| EDL (9008) with no authorized Mi Account | Xiaomi restricted EDL writes in 2018. End users cannot recover the device themselves. |

## Data

`data/` is the project. The site is a view of it.

| File | Contents |
|---|---|
| `devices.json` | Per-device: bootloader unlock policy, EDL auth, ARB index, FeliCa, LineageOS support |
| `rules.json` | Device-independent rules: what is reversible, what is lost on unlock, which layers a third party can write |
| `roms.json` | SHA-256 records of distributed ROM files. Self-computed hashes only; upstream-published hashes are rejected. |

### The one rule

A non-null `value` requires both `source` (URL) and `verified_at` (date).

```json
{ "arb": { "value": 4, "source": "https://…", "verified_at": "2026-08-09", "note": null } }
```

`scripts/validate.mjs` enforces this at build time, along with:

- `roms.policy.mirror` must be `false`
- `mirror_url` and `hash_from_upstream` are rejected outright
- `verified_at` older than 180 days raises a warning

This is enforced in code rather than documented in prose because policies are forgotten.

## Why no mirrors

1. **No redistribution right.** Official ROMs are Xiaomi's; the EULA forbids redistribution.
   Modified ROMs such as xiaomi.eu are redistributed without that right in the first place.
2. **GPL obligations.** Shipping a binary containing the Linux kernel obliges the distributor
   to provide corresponding source.
3. **You become the publisher.** Mirroring is your own act of making the file available.
   Long before any legal question, a malicious ROM means Safe Browsing warnings and
   hosting suspension.

Every large English ROM database states "we don't host files, we only link to official
sources" for the same reasons.

## Build

No dependencies. Node 20+.

```sh
node scripts/validate.mjs   # data checks only
node scripts/build.mjs      # validate, generate /risk/ and /devices/, copy data, write sitemap
```

`public/` is the deployable directory. `public/risk/`, `public/devices/`, `public/data/`
and `public/sitemap.xml` are generated — edit `data/` instead.

## Contributing

Most fields can only be filled by someone holding the physical device. See
[CONTRIBUTING.md](CONTRIBUTING.md). Corrections are welcome; reports of the form
"this page nearly cost me a device" are handled first.

## License

- Code: MIT
- Data (`data/`): CC BY 4.0

## Disclaimer

Provided without warranty of any kind. Flashing can render a device permanently
unusable.

Radio-equipment certification, import rules and consumer-warranty law differ by
country. Operating a device that lacks certification in your jurisdiction may be an
offence where you live, and unlocking the bootloader may void the manufacturer
warranty. Nothing here is a recommendation to do either — it is a record of the
technical consequences. **Follow the laws that apply where you are.**
