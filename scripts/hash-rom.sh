#!/usr/bin/env bash
# Compute the SHA-256 of a distributed file without keeping it.
#
#   scripts/hash-rom.sh <url> [id] [device] [rom]
#
# Nothing is mirrored, so nothing needs to be kept. Output is ready to paste
# into data/roms.json.
#
# Only the value produced here goes into roms.json. Never transcribe a hash shown
# on the upstream page: that would confirm the upstream's own claim, and catching
# a compromised upstream is the entire point of keeping these records.
#
# Why this is not a single `curl | sha256sum`:
#   d.miui.com throttles a single connection hard after the first burst — measured
#   26 KB/s on a 9.2 GB file, which is four days. The limit is PER CONNECTION:
#   four streams each held 16 MB/s. So we pull byte ranges in parallel.
#
# A hash needs the bytes in order, so the ranges are consumed in order and the
# file is never assembled: PAR chunks are fetched concurrently into a temp dir,
# fed to sha256sum in sequence, then deleted. Peak disk is PAR*CHUNK (256 MB by
# default), not the size of the ROM. That keeps "we do not mirror" literally true
# — there is no point in time at which a redistributable copy exists on disk.

set -uo pipefail

URL="${1:?usage: hash-rom.sh <url> [id] [device] [rom]}"
ID="${2:-}"
DEVICE="${3:-}"
ROM="${4:-}"

PAR="${PAR:-4}"                          # concurrent connections
CHUNK="${CHUNK:-$((64 * 1024 * 1024))}"  # bytes per range request
TRIES="${TRIES:-4}"                      # attempts per chunk

FILE="$(basename "${URL%%\?*}")"
[ -z "$ID" ] && ID="${FILE%.tgz}"

log() { printf '%s\n' "$*" >&2; }

log "url:  $URL"

# Content-Length from a ranged GET rather than HEAD: some CDN edges answer HEAD
# from a different cache entry, or omit the length entirely.
HDR="$(curl -sS -r 0-0 -D - -o /dev/null --max-time 60 "$URL" 2>/dev/null)"
SIZE="$(printf '%s' "$HDR" | awk 'BEGIN{IGNORECASE=1} /^content-range:/{split($0,a,"/"); gsub(/[^0-9]/,"",a[2]); print a[2]}' | tail -1)"
ACCEPT_RANGES="$(printf '%s' "$HDR" | grep -ci '^HTTP/.* 206')"

if [ -z "${SIZE:-}" ] || [ "$SIZE" -le 0 ] 2>/dev/null; then
  log "failed: could not determine the size of the file. Refusing to hash blind."
  exit 1
fi
if [ "$ACCEPT_RANGES" -eq 0 ]; then
  log "failed: the server ignored the Range request, so parallel fetch would"
  log "        silently hash the same bytes N times. Refusing."
  exit 1
fi

log "size: $SIZE bytes ($(( SIZE / 1024 / 1024 )) MiB)"
log "plan: ${PAR} connections x $(( CHUNK / 1024 )) KiB ranges, hashed in order, nothing assembled"

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT INT TERM

# One range into one file. Retries, and verifies the byte count it got — a short
# read that goes unnoticed produces a confident hash of the wrong thing, which is
# the single worst output this script could have.
fetch_chunk() {
  # Separate statements on purpose: bash expands every word of a `local` line
  # before it assigns any of them, so `want=$(( end - start + 1 ))` on the same
  # line reads an unset `end`.
  local start="$1" end="$2" out="$3"
  local want=$(( end - start + 1 ))
  local got t
  for t in $(seq 1 "$TRIES"); do
    rm -f "$out"
    curl -sS --fail --location --max-time 1800 --speed-limit 10240 --speed-time 60 \
         -r "${start}-${end}" -o "$out" "$URL" && {
      got="$(stat -c%s "$out" 2>/dev/null || echo 0)"
      [ "$got" -eq "$want" ] && return 0
      log "  chunk @${start}: got ${got} of ${want} bytes (try ${t})"
    }
    sleep $(( t * 2 ))
  done
  return 1
}

START=$(date +%s)
SHA_PIPE="$TMP/sha"
mkfifo "$SHA_PIPE"
( sha256sum < "$SHA_PIPE" | cut -d' ' -f1 > "$TMP/sha256.out" ) &
HASHER=$!
exec 9>"$SHA_PIPE"

offset=0
fed=0
failed=0
while [ "$offset" -lt "$SIZE" ]; do
  # launch a window of PAR ranges
  n=0
  starts=()
  while [ "$n" -lt "$PAR" ] && [ $(( offset + n * CHUNK )) -lt "$SIZE" ]; do
    s=$(( offset + n * CHUNK ))
    e=$(( s + CHUNK - 1 )); [ "$e" -ge "$SIZE" ] && e=$(( SIZE - 1 ))
    fetch_chunk "$s" "$e" "$TMP/part.$n" &
    starts+=("$!")
    n=$(( n + 1 ))
  done

  for pid in "${starts[@]}"; do wait "$pid" || failed=1; done
  [ "$failed" -eq 1 ] && break

  # consume in order — this is what makes the hash correct
  for i in $(seq 0 $(( n - 1 ))); do
    cat "$TMP/part.$i" >&9 || { failed=1; break; }
    fed=$(( fed + $(stat -c%s "$TMP/part.$i") ))
    rm -f "$TMP/part.$i"
  done
  [ "$failed" -eq 1 ] && break

  offset=$(( offset + n * CHUNK ))
  el=$(( $(date +%s) - START )); [ "$el" -eq 0 ] && el=1
  log "  $(( fed / 1024 / 1024 )) / $(( SIZE / 1024 / 1024 )) MiB  ($(( fed / el / 1024 )) KiB/s)"
done

exec 9>&-
wait "$HASHER"
SHA="$(cat "$TMP/sha256.out" 2>/dev/null)"
ELAPSED=$(( $(date +%s) - START ))

if [ "$failed" -eq 1 ] || [ "$fed" -ne "$SIZE" ] || [ "${#SHA}" -ne 64 ]; then
  log "failed: hashed ${fed} of ${SIZE} bytes. Do not record a hash of partial data."
  exit 1
fi

log "${ELAPSED}s"
log ""

cat <<JSON
{
  "id": "$ID",
  "device": "$DEVICE",
  "rom": "$ROM",
  "file": "$FILE",
  "source_url": "$URL",
  "sha256": "$SHA",
  "size": $SIZE,
  "verified_at": "$(date +%F)"
}
JSON
