#!/usr/bin/env bash
#
# TEMPORARY build shim - delete this file during the Eleventy migration.
#
# sckerk.github.io has no build step yet: the site is raw HTML served from
# the repo root. GitHub Actions Pages deploys must upload a directory
# artifact, so this script assembles one at _site/ that is byte-identical
# to what main serves today.
#
# _site/ is Eleventy's default output directory, so the Eleventy ticket can
# replace this script with `eleventy` and every workflow step - including
# `upload-pages-artifact`'s `path: _site` - keeps working unchanged.
#
# Invoked as `bash scripts/build.sh` (see package.json) so it does not
# depend on the executable bit being committed.
set -euo pipefail

# Always run from the repo root, regardless of the caller's cwd.
cd "$(dirname "$0")/.."

OUT=_site

# Idempotent: wipe the previous output first, so a source file that is
# later deleted or renamed cannot survive as a stale file in _site/.
rm -rf "$OUT"
mkdir -p "$OUT"

# Every top-level asset directory the live site references. Verified by
# auditing src/href in *.html plus url() in css/*.css - note fonts/ is
# reachable only from CSS, never from HTML.
ASSET_DIRS=(css fonts img js)

# Fail loudly on a missing source rather than silently shipping a partial
# site: a 200 that is missing its stylesheet is worse than a red build.
for dir in "${ASSET_DIRS[@]}"; do
  if [ ! -d "$dir" ]; then
    echo "build: expected asset directory '$dir' not found" >&2
    exit 1
  fi
done

# Copy every root HTML file, including the header.html fragment, so the
# artifact serves exactly the same set of URLs main does today.
shopt -s nullglob
html_files=(*.html)
shopt -u nullglob
if [ "${#html_files[@]}" -eq 0 ]; then
  echo "build: no *.html files found in the repo root" >&2
  exit 1
fi

cp "${html_files[@]}" "$OUT"/
cp -R "${ASSET_DIRS[@]}" "$OUT"/

# GitHub Pages runs Jekyll over the artifact by default, and Jekyll drops
# paths beginning with an underscore. Harmless for today's flat HTML, but
# it would silently eat Eleventy output later, so establish it now.
touch "$OUT/.nojekyll"

# Assert the output is real. Without this, a future edit that breaks the
# copy could still exit 0 and publish an empty site over a working one.
if [ ! -f "$OUT/index.html" ]; then
  echo "build: '$OUT/index.html' is missing; refusing to publish" >&2
  exit 1
fi

echo "build: staged $(find "$OUT" -type f | wc -l | tr -d ' ') files into $OUT/"
