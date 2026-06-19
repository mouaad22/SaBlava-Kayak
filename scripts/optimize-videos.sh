#!/usr/bin/env bash
# Re-encode gallery videos to web-friendly H.264, long edge capped at 1280,
# well under Cloudflare's 25 MiB per-asset limit. Idempotent: skips clips that
# are already small (<= 10 MiB). Originals remain recoverable in git history.
#
# Note: -nostdin is REQUIRED — without it ffmpeg consumes the `while read` loop's
# stdin and mangles every other path.
set -euo pipefail
cd "$(dirname "$0")/.."

find app/assets -type f -name '*.mp4' -print0 | while IFS= read -r -d '' f; do
  sz=$(stat -c %s "$f")
  if [ "$sz" -le 10485760 ]; then
    echo "skip (already small): $f"
    continue
  fi
  tmp="${f%.mp4}.opt.mp4"
  echo "=== $f ($sz bytes) ==="
  ffmpeg -nostdin -y -loglevel error -i "$f" \
    -vf "scale='if(gte(iw,ih),min(1280,iw),-2)':'if(gte(iw,ih),-2,min(1280,ih))'" \
    -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p \
    -c:a aac -b:a 128k -movflags +faststart "$tmp"
  mv -f "$tmp" "$f"
  echo "    -> $(stat -c %s "$f") bytes"
done
echo "ALL VIDEOS DONE"
