#!/usr/bin/env node
// Builds the brand assets the SEO metadata points at: the Open Graph share
// image and the three icon files. Both kinds are *generated*, never committed,
// for the same reason the gallery derivatives are — see scripts/resize-images.mjs
// and the "Images" section of README.md. `npm run build` runs this before
// Eleventy; the output lands in generated/site/ and is passed through to the
// site root.
//
// Two inputs, one output directory:
//
//   src/icon.svg    -> favicon.ico, apple-touch-icon.png   (and, via an Eleventy
//                      passthrough rather than this script, /favicon.svg)
//   originals/0.jpg -> og-image.jpg
//
// This is deliberately a separate script from resize-images.mjs rather than a
// section bolted onto it. That one has exactly one job — turn every master in
// originals/ into the responsive ladder the gallery serves — and it warns about
// any file in its output directory that has no corresponding master. Writing
// these assets into generated/img/ would trip that orphan check on every run.
//
// Usage (from the repo root):
//   npm run generate-icons
//
// It takes no options and always rewrites. There is no skip-if-current path
// like resize-images.mjs has, because there is nothing to skip: this is three
// files from two inputs, well under a second, and the outputs are byte-stable
// for unchanged inputs so a rebuild never dirties anything.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const ICON_SOURCE = path.join(REPO_ROOT, "src", "icon.svg");
const OUT_ROOT = path.join(REPO_ROOT, "generated", "site");

// The master the share image is cropped from: originals/0.jpg is the 1412x794
// homepage hero, and the only master wide enough to yield 1200x630 without
// upscaling. Every other original is 623px or narrower. If this photograph is
// ever replaced, check that constraint before assuming the crop still works —
// assertSourceIsLargeEnough below turns a bad assumption into a failed build
// rather than a blurry share card.
const OG_SOURCE = path.join(REPO_ROOT, "originals", "0.jpg");

// 1200x630 is the size Facebook, LinkedIn and X all render a large summary card
// at. These three numbers are also declared in src/_data/site.json, which is
// what the meta tags emit; scripts/assert-seo.js measures the built file and
// fails if the two ever disagree.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_QUALITY = 82;

// 180x180 is the size iOS asks for; 32x32 is what goes inside favicon.ico.
const APPLE_TOUCH_SIZE = 180;
const FAVICON_SIZE = 32;

// Rasterising an SVG at its nominal 64px viewBox and scaling up would throw
// away the vector. Rendering at a high density makes sharp rasterise at the
// target size directly, so the 180px icon has 180px of real detail.
const SVG_DENSITY = 1536;

function fail(message) {
    throw new Error(`generate-icons: ${message}`);
}

// Wraps a PNG in an ICO container. The ICO format allows a PNG payload
// verbatim, so this is a 22-byte header in front of bytes sharp already
// produced — which is why it needs no encoder dependency. Every browser that
// requests /favicon.ico by path (which they all do, declared or not) reads it.
//
// Layout: a 6-byte ICONDIR, then one 16-byte ICONDIRENTRY, then the image.
function wrapPngInIco(png, size) {
    if (size < 1 || size > 256) fail(`icon size ${size} is outside the 1-256 range ICO allows`);

    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved, always 0
    header.writeUInt16LE(1, 2); // resource type: 1 = icon
    header.writeUInt16LE(1, 4); // number of images in this file

    const entry = Buffer.alloc(16);
    // A 256px icon is encoded as 0 in these single-byte fields; sizes below 256
    // are written literally. Ours is 32, but the modulo keeps that correct if
    // FAVICON_SIZE is ever raised to 256.
    entry.writeUInt8(size % 256, 0); // width
    entry.writeUInt8(size % 256, 1); // height
    entry.writeUInt8(0, 2); // palette size: 0 = not paletted
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // size of the image data
    entry.writeUInt32LE(header.length + entry.length, 12); // offset to it

    return Buffer.concat([header, entry, png]);
}

// Writes through a temp file so an interrupted run cannot leave a truncated
// image in generated/site/, where the passthrough would happily ship it.
async function writeAtomic(outPath, buffer) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const tmpPath = `${outPath}.tmp`;
    try {
        await fs.writeFile(tmpPath, buffer);
        await fs.rename(tmpPath, outPath);
    } catch (err) {
        if (tmpPath.endsWith(".tmp")) await fs.rm(tmpPath, { force: true });
        throw err;
    }
}

async function assertSourceIsLargeEnough() {
    const meta = await sharp(OG_SOURCE, { failOn: "none" }).rotate().metadata();
    if (!meta.width || !meta.height) fail(`could not read the dimensions of ${OG_SOURCE}`);
    if (meta.width < OG_WIDTH || meta.height < OG_HEIGHT) {
        fail(
            `originals/0.jpg is ${meta.width}x${meta.height}, too small to crop ` +
                `${OG_WIDTH}x${OG_HEIGHT} without upscaling. Pick a larger master for the ` +
                `share image rather than letting sharp enlarge this one.`,
        );
    }
    return meta;
}

async function main() {
    // Fail loudly on a typo rather than silently ignoring it, matching
    // resize-images.mjs. This script takes no options at all.
    const extra = process.argv.slice(2);
    if (extra.length > 0) fail(`unexpected argument "${extra[0]}" — this script takes no options`);

    const sourceMeta = await assertSourceIsLargeEnough();
    const iconSvg = await fs.readFile(ICON_SOURCE);
    const written = [];

    // fit: "cover" with the default centre position crops the 1412x794 master
    // to the 1.905 share ratio by trimming the top and bottom, keeping the full
    // width of the photograph. Deterministic: the same master always yields the
    // same crop, so a rebuild does not churn the file.
    const og = await sharp(OG_SOURCE, { failOn: "none" })
        .rotate()
        .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover" })
        .jpeg({ quality: OG_QUALITY, mozjpeg: true, progressive: true })
        .toBuffer();
    await writeAtomic(path.join(OUT_ROOT, "og-image.jpg"), og);
    written.push(["og-image.jpg", `${OG_WIDTH}x${OG_HEIGHT}`, og.length]);

    // Flattened onto the icon's own black rather than left with an alpha
    // channel: iOS composites a touch icon over white, which would put a white
    // halo around a mark designed to sit on black.
    const appleTouch = await sharp(iconSvg, { density: SVG_DENSITY })
        .resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE)
        .flatten({ background: "#000000" })
        .png()
        .toBuffer();
    await writeAtomic(path.join(OUT_ROOT, "apple-touch-icon.png"), appleTouch);
    written.push([
        "apple-touch-icon.png",
        `${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE}`,
        appleTouch.length,
    ]);

    const faviconPng = await sharp(iconSvg, { density: SVG_DENSITY })
        .resize(FAVICON_SIZE, FAVICON_SIZE)
        .png()
        .toBuffer();
    const ico = wrapPngInIco(faviconPng, FAVICON_SIZE);
    await writeAtomic(path.join(OUT_ROOT, "favicon.ico"), ico);
    written.push(["favicon.ico", `${FAVICON_SIZE}x${FAVICON_SIZE}`, ico.length]);

    console.log(
        `icons   source ${path.relative(REPO_ROOT, ICON_SOURCE)}, ` +
            `share image from originals/0.jpg (${sourceMeta.width}x${sourceMeta.height})`,
    );
    for (const [name, size, bytes] of written) {
        console.log(
            `write   ${name.padEnd(22)} ${size.padEnd(10)} ${(bytes / 1024).toFixed(1)} KB`,
        );
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
});
