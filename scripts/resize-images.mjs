#!/usr/bin/env node
// Generates the web-sized derivatives the site actually serves, from the
// masters in originals/, and regenerates src/_data/images.json — the manifest
// the Nunjucks templates read to emit <img> width/height/srcset without ever
// measuring an image at render time.
//
// Nothing under generated/ is committed. originals/ is the source of truth and
// is never served: it is not an Eleventy passthrough, so it cannot leak into
// _site/. `npm run build` runs this first, then Eleventy.
//
// Usage (from the repo root):
//   npm run resize-images                # generate any missing derivatives
//   npm run resize-images -- --force     # regenerate everything
//   npm run resize-images -- --dry-run   # report only, write nothing
//   npm run resize-images -- --max=800 --quality=75
//
// See README.md ("Images") for the full workflow.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import * as prettier from "prettier";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url)); // <repo>/scripts
const REPO_ROOT = path.resolve(HERE, "..");
const SRC_ROOT = path.join(REPO_ROOT, "originals");
const OUT_ROOT = path.join(REPO_ROOT, "generated", "img");
const MANIFEST_PATH = path.join(REPO_ROOT, "src", "_data", "images.json");

// The width ladder, in CSS pixels.
//
// 400/800/1200 come from the ticket. 200 is added for the gallery pager: its
// thumbnails render at 170 CSS px (a 20%-wide cell of the 900px #main, less its
// 10px gutter, under border-box) and 70 px on mobile, so without a 200w rung all
// 33 thumbnails would pull a 400w file and blow the page-weight budget on their
// own. 170px at DPR 1 picks the 200w rung, at DPR 2 the 400w one. Every rung is
// still an honest downscale — see widthsFor().
//
// Nothing here upscales. These masters are small: the largest is 1412px wide
// (originals/0.jpg, the homepage hero) and most gallery works are 623px or
// narrower, so on most images only the 200 rung plus the intrinsic width
// survive the filter. That is a property of the source photographs, not a bug
// in the ladder; there are no more pixels to serve.
const LADDER = [200, 400, 800, 1200];

const DEFAULT_MAX_EDGE = 1200;
const DEFAULT_QUALITY = 80;

const ACCEPTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

// Emitted per width, in the order the <picture> element prefers them. The
// JPEG is the fallback for anything that cannot decode WebP.
const FORMATS = [
    { ext: ".webp", encode: (pipeline, quality) => pipeline.webp({ quality, effort: 6 }) },
    {
        ext: ".jpg",
        encode: (pipeline, quality) => pipeline.jpeg({ quality, mozjpeg: true, progressive: true }),
    },
];

const USAGE = `Usage: npm run resize-images -- [options]

  --force            regenerate derivatives even if the output already exists
  --dry-run          report what would be written, but write nothing
  --max=<px>         cap on the widest rung, in pixels (default ${DEFAULT_MAX_EDGE})
  --quality=<1-100>  encoder quality (default ${DEFAULT_QUALITY})
  --help, -h         show this message

A successful (non dry-run) run also regenerates src/_data/images.json. Existing
alt text in that file is preserved; only the measured fields are rewritten.`;

function parseNumericFlag(arg, flag, min, max) {
    const raw = arg.slice(flag.length + 1); // +1 for the '='
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${flag} expects an integer between ${min} and ${max}, got "${raw}"`);
    }
    return value;
}

function parseArgs(argv) {
    const args = {
        force: false,
        dryRun: false,
        help: false,
        maxEdge: DEFAULT_MAX_EDGE,
        quality: DEFAULT_QUALITY,
    };
    for (const arg of argv) {
        if (arg === "--force") {
            args.force = true;
        } else if (arg === "--dry-run") {
            args.dryRun = true;
        } else if (arg === "--help" || arg === "-h") {
            args.help = true;
        } else if (arg.startsWith("--max=")) {
            args.maxEdge = parseNumericFlag(arg, "--max", 1, 20000);
        } else if (arg.startsWith("--quality=")) {
            args.quality = parseNumericFlag(arg, "--quality", 1, 100);
        } else {
            // Fail loudly rather than silently ignoring a typo: a mistyped
            // --dry-run would otherwise write files the caller did not expect.
            throw new Error(`unknown argument: ${arg}`);
        }
    }
    return args;
}

// The rungs to emit for one master, given its intrinsic width.
//
// Every ladder rung strictly narrower than the master is a real downscale and
// is kept. The master's own width is then appended (capped at maxEdge) so the
// widest derivative always matches the best pixels available — without it a
// 623px master would top out at the 400w rung and render visibly soft in the
// 610px slideshow box. Upscaling never happens: nothing wider than the master
// is ever emitted.
function widthsFor(intrinsicWidth, maxEdge) {
    const cap = Math.min(intrinsicWidth, maxEdge);
    const widths = LADDER.filter((w) => w < cap);
    widths.push(cap);
    return widths;
}

async function* walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walk(full);
        } else if (entry.isFile()) {
            yield full;
        }
    }
}

function formatBytes(bytes) {
    return `${(bytes / 1024).toFixed(1)} KB`.padStart(10);
}

async function fileExists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

// Reads the committed manifest so a regeneration can carry hand-written alt
// text forward. A missing or unparseable file is not fatal here: the run still
// produces derivatives and writes a fresh manifest with empty alt strings, and
// the Eleventy build is what refuses to ship those (see src/_data/gallery.js).
async function readExistingManifest() {
    try {
        const raw = await fs.readFile(MANIFEST_PATH, "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Writes one derivative through a temp file so a crash cannot leave a
// truncated image behind in generated/, where the passthrough would ship it.
async function writeDerivative(inputBuffer, outPath, width, format, quality) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const tmpPath = `${outPath}.tmp`;
    try {
        const pipeline = sharp(inputBuffer, { failOn: "none" })
            .rotate() // apply EXIF orientation before measuring/resizing
            .resize({ width, withoutEnlargement: true });
        const info = await format.encode(pipeline, quality).toFile(tmpPath);
        await fs.rename(tmpPath, outPath);
        return info;
    } catch (err) {
        // The guard keeps this removal incapable of targeting anything but the
        // scratch file constructed immediately above.
        if (tmpPath.endsWith(".tmp")) {
            await fs.rm(tmpPath, { force: true });
        }
        throw err;
    }
}

// True when the derivative already on disk was built from the master as it
// stands now. Existence alone is not enough: replace a photograph in originals/
// with a new one of the same name and an exists-check would ship the stale
// derivative forever.
async function isCurrent(outPath, inputMtimeMs) {
    try {
        const stat = await fs.stat(outPath);
        return stat.mtimeMs >= inputMtimeMs ? stat : null;
    } catch {
        return null;
    }
}

async function processFile(job, args, stats, measured) {
    const { inputPath, base } = job;

    const inputStat = await fs.stat(inputPath);
    const inputBuffer = await fs.readFile(inputPath);
    const inputMeta = await sharp(inputBuffer, { failOn: "none" }).rotate().metadata();
    if (!inputMeta.width || !inputMeta.height) {
        throw new Error(`could not read dimensions of ${inputPath}`);
    }

    const widths = widthsFor(inputMeta.width, args.maxEdge);
    const label = `${base}.jpg`;

    if (args.dryRun) {
        console.log(
            `plan    ${label.padEnd(10)} ${`${inputMeta.width}x${inputMeta.height}`.padEnd(10)} ${formatBytes(inputBuffer.length)}  -> widths ${widths.join(",")} (dry-run)`,
        );
        stats.skipped += widths.length * FORMATS.length;
        measured.set(base, { width: inputMeta.width, height: inputMeta.height, widths });
        return;
    }

    let wrote = 0;
    let skipped = 0;
    let outputBytes = 0;

    for (const width of widths) {
        for (const format of FORMATS) {
            const outPath = path.join(OUT_ROOT, `${base}-${width}${format.ext}`);
            const current = args.force ? null : await isCurrent(outPath, inputStat.mtimeMs);
            if (current) {
                outputBytes += current.size;
                skipped += 1;
                continue;
            }
            const info = await writeDerivative(inputBuffer, outPath, width, format, args.quality);
            outputBytes += info.size;
            wrote += 1;
        }
    }

    measured.set(base, { width: inputMeta.width, height: inputMeta.height, widths });
    stats.processed += wrote;
    stats.skipped += skipped;
    stats.inputBytes += inputBuffer.length;
    stats.outputBytes += outputBytes;

    console.log(
        `${wrote > 0 ? "write  " : "skip   "} ${label.padEnd(10)} ${`${inputMeta.width}x${inputMeta.height}`.padEnd(10)} ${formatBytes(inputBuffer.length)}  -> ${widths.join(",")}  (${wrote} written, ${skipped} current)`,
    );
}

// Warns about derivatives in generated/img that no longer have a master in
// originals/ — the "someone deleted an original but the generated file
// lingered" case. Warn only: this function must never delete anything.
async function findOrphans(expectedOutputs) {
    if (!(await fileExists(OUT_ROOT))) return [];
    const warnings = [];
    const entries = await fs.readdir(OUT_ROOT, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile() || entry.name.startsWith(".")) continue;
        const outFile = path.join(OUT_ROOT, entry.name);
        if (!expectedOutputs.has(path.resolve(outFile))) {
            warnings.push(`warn: orphan derivative, no original: generated/img/${entry.name}`);
        }
    }
    return warnings;
}

// Rewrites src/_data/images.json: measured fields from this run, alt text
// carried over from whatever was already there. `sets` is hand-maintained and
// passed through untouched — it is what assigns a master to the homepage hero
// or the gallery, and 0.jpg deliberately belongs to only one of them.
//
// Entries are sorted numerically by filename and the JSON is written with a
// fixed shape, so a re-run over unchanged originals reproduces the file
// byte-for-byte and a CI build never dirties the tree.
async function writeManifest(measured, existing) {
    const previousAlt = new Map();
    for (const entry of existing?.images ?? []) {
        if (entry && typeof entry.file === "string") {
            previousAlt.set(entry.file, typeof entry.alt === "string" ? entry.alt : "");
        }
    }

    const bases = [...measured.keys()].sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isInteger(na) && Number.isInteger(nb)) return na - nb;
        return a.localeCompare(b);
    });

    const images = bases.map((base) => {
        const file = `${base}.jpg`;
        const { width, height, widths } = measured.get(base);
        return { file, width, height, widths, alt: previousAlt.get(file) ?? "" };
    });

    const manifest = {
        // Regenerated by scripts/resize-images.mjs; alt text is hand-written
        // and preserved across runs. If per-work titles ever exist, they land
        // beside alt on these entries.
        images,
        sets: existing?.sets ?? {},
    };

    // Formatted through Prettier's own API rather than JSON.stringify's fixed
    // indent. `npm run lint` is `prettier --check .`, and JSON.stringify would
    // put every array element on its own line where Prettier wants short arrays
    // inline — so the script's own output would fail the repo's lint gate. This
    // also self-heals the file after a hand-edit of the alt text.
    const prettierConfig = await prettier.resolveConfig(MANIFEST_PATH);
    const formatted = await prettier.format(JSON.stringify(manifest), {
        ...prettierConfig,
        filepath: MANIFEST_PATH,
    });

    await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    const tmpPath = `${MANIFEST_PATH}.tmp`;
    try {
        await fs.writeFile(tmpPath, formatted);
        await fs.rename(tmpPath, MANIFEST_PATH);
    } catch (err) {
        if (tmpPath.endsWith(".tmp")) {
            await fs.rm(tmpPath, { force: true });
        }
        throw err;
    }

    const missingAlt = images.filter((i) => !i.alt).map((i) => i.file);
    console.log(`manifest src/_data/images.json (${images.length} entries)`);
    if (missingAlt.length > 0) {
        console.warn(
            `warn: no alt text for ${missingAlt.join(", ")} — the Eleventy build will refuse to run until it is written`,
        );
    }
}

async function collectJobs() {
    const jobs = [];
    for await (const inputPath of walk(SRC_ROOT)) {
        const rel = path.relative(SRC_ROOT, inputPath);
        const ext = path.extname(rel);
        if (!ACCEPTED_EXTENSIONS.has(ext.toLowerCase())) continue;
        if (rel.includes(path.sep)) {
            // originals/ is deliberately flat: the derivative name is
            // `<base>-<width>.<ext>`, which has no room for a subdirectory.
            throw new Error(`originals/ must be flat, found ${rel}`);
        }
        jobs.push({ inputPath, base: rel.slice(0, -ext.length) });
    }
    jobs.sort((a, b) => a.base.localeCompare(b.base));
    return jobs;
}

async function main() {
    let args;
    try {
        args = parseArgs(process.argv.slice(2));
    } catch (err) {
        console.error(`${err.message}\n\n${USAGE}`);
        process.exitCode = 1;
        return;
    }

    if (args.help) {
        console.log(USAGE);
        return;
    }

    if (!(await fileExists(SRC_ROOT))) {
        console.error(`originals/ not found at ${SRC_ROOT}`);
        process.exitCode = 1;
        return;
    }

    const stats = { processed: 0, skipped: 0, failed: 0, inputBytes: 0, outputBytes: 0 };
    const jobs = await collectJobs();
    const measured = new Map();
    const existing = await readExistingManifest();

    for (const job of jobs) {
        try {
            await processFile(job, args, stats, measured);
        } catch (err) {
            stats.failed += 1;
            console.error(`fail    ${path.relative(REPO_ROOT, job.inputPath)}: ${err.message}`);
        }
    }

    const expectedOutputs = new Set();
    for (const [base, m] of measured) {
        for (const width of m.widths) {
            for (const format of FORMATS) {
                expectedOutputs.add(path.resolve(OUT_ROOT, `${base}-${width}${format.ext}`));
            }
        }
    }
    // Orphan detection needs the complete expected set, and a master that threw
    // contributed no widths to `measured` — so every healthy derivative it owns
    // would be misreported as an orphan. Skip the check instead of lying.
    const canDetectOrphans = !args.dryRun && stats.failed === 0;
    const warnings = canDetectOrphans ? await findOrphans(expectedOutputs) : [];
    for (const w of warnings) console.warn(w);
    if (!canDetectOrphans && !args.dryRun) {
        console.warn("warn: skipping orphan check, some masters failed");
    }

    if (args.dryRun) {
        console.log("manifest unchanged (dry-run)");
    } else if (stats.failed > 0) {
        // The manifest is rewritten wholesale, so writing it after a partial
        // run would silently drop the entries whose masters failed.
        console.warn("warn: one or more files failed, leaving src/_data/images.json unchanged");
    } else {
        await writeManifest(measured, existing);
    }

    console.log("");
    console.log(
        `masters=${jobs.length} written=${stats.processed} current=${stats.skipped} failed=${stats.failed} orphans=${warnings.length}`,
    );
    if (stats.inputBytes > 0) {
        console.log(
            `originals=${(stats.inputBytes / (1024 * 1024)).toFixed(2)} MB derivatives=${(stats.outputBytes / (1024 * 1024)).toFixed(2)} MB`,
        );
    }

    if (stats.failed > 0) {
        process.exitCode = 1;
    }
}

main();
