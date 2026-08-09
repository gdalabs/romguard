#!/usr/bin/env bash
# Compute the SHA-256 of a distributed file by streaming it, without storing it.
#
#   scripts/hash-rom.sh <url> [id] [device] [rom]
#
# Nothing is mirrored, so nothing needs to be kept. A 9 GB ROM costs no disk.
# Output is ready to paste into data/roms.json.
#
# Only the value produced here goes into roms.json. Never transcribe a hash shown on the
# upstream page: that would confirm the upstream's own claim, and catching a compromised
# upstream is the entire point of keeping these records.

set -uo pipefail

URL="${1:?usage: hash-rom.sh <url> [id] [device] [rom]}"
ID="${2:-}"
DEVICE="${3:-}"
ROM="${4:-}"

FILE="$(basename "${URL%%\?*}")"
[ -z "$ID" ] && ID="${FILE%.tgz}"

echo "url:  $URL" >&2
SIZE="$(curl -sIL --max-time 60 "$URL" | awk 'tolower($1)=="content-length:"{v=$2} END{gsub(/\r/,"",v); print v}')"
echo "size: ${SIZE:-unknown} bytes" >&2
echo "hashing (nothing is written to disk)..." >&2

START=$(date +%s)
SHA="$(curl -sL --retry 2 --max-time 3600 "$URL" | sha256sum | cut -d' ' -f1)"
RC=$?
ELAPSED=$(( $(date +%s) - START ))

if [ $RC -ne 0 ] || [ "${#SHA}" -ne 64 ]; then
  echo "failed: download did not complete. Do not record a hash of partial data." >&2
  exit 1
fi

echo "${ELAPSED}s" >&2
echo >&2

cat <<JSON
{
  "id": "$ID",
  "device": "$DEVICE",
  "rom": "$ROM",
  "file": "$FILE",
  "source_url": "$URL",
  "sha256": "$SHA",
  "size": ${SIZE:-0},
  "verified_at": "$(date +%F)"
}
JSON
