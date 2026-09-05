// Turns the generated manifest (src/_data/images.json) into render-ready slide
// data, and refuses to build if that manifest is not fit to ship.
//
// Every path the templates emit is derived here, from the manifest, so no image
// URL is ever hand-typed in a template again — which is what keeps the output
// on a single root-absolute `/img/...` form. The old gallery.html mixed
// `/img/...` (30 times) and `img/...` (3), and only got away with it because
// this is a domain-root user site.
//
// The alt-text check is the load-bearing part. There is no per-work metadata
// for these 33 works — no titles, years, media or dimensions — so alt text is
// the only description a crawler or a screen reader will ever get. Shipping an
// empty or duplicated one silently would defeat the entire point of the
// ticket, so this throws instead, which fails `npm run build`.

const fs = require("node:fs");
const path = require("node:path");

const MANIFEST_PATH = path.join(__dirname, "images.json");
const DERIVATIVE_DIR = "/img";
// Where resize-images.mjs actually writes, so the manifest can be checked
// against the files on disk rather than trusted.
const GENERATED_DIR = path.join(__dirname, "..", "..", "generated", "img");

// Read, not require(). `require` caches by path, so under `eleventy --serve` a
// manifest fixed after a failed alt-text check would keep re-throwing the stale
// error until the dev server was restarted.
function readManifest() {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function fail(message) {
    throw new Error(
        `src/_data/images.json: ${message}\n` +
            "Run `npm run resize-images` to regenerate the measured fields, and write " +
            "the alt text by hand — it describes someone's artwork, so it is not " +
            "generated and never defaults to a placeholder.",
    );
}

function basename(file) {
    return file.replace(/\.[^.]+$/, "");
}

// `<picture>` needs one srcset per format. Widths come from the manifest, which
// the resize script clamps to each master's intrinsic width, so nothing listed
// here is an upscale of the original photograph.
function srcsetFor(file, widths, extension) {
    return widths
        .map((w) => `${DERIVATIVE_DIR}/${basename(file)}-${w}.${extension} ${w}w`)
        .join(", ");
}

function buildIndex(manifest) {
    const entries = manifest.images;
    if (!Array.isArray(entries) || entries.length === 0) {
        fail("`images` is missing or empty");
    }

    const byFile = new Map();
    const altSeen = new Map();

    for (const entry of entries) {
        const { file, width, height, widths, alt } = entry ?? {};

        if (typeof file !== "string" || file.length === 0) {
            fail(`an entry has no \`file\`: ${JSON.stringify(entry)}`);
        }
        if (byFile.has(file)) {
            fail(`${file} is listed twice`);
        }
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
            fail(`${file} has no usable width/height — run \`npm run resize-images\``);
        }
        if (!Array.isArray(widths) || widths.length === 0) {
            fail(`${file} has no generated widths — run \`npm run resize-images\``);
        }
        for (const w of widths) {
            if (!Number.isInteger(w) || w < 1) fail(`${file} has a bad width: ${w}`);
            if (w > width) fail(`${file} lists width ${w}, wider than the ${width}px master`);
        }

        // The acceptance criterion is non-empty AND unique alt text. Both are
        // checked: 33 copies of "artwork" would pass a non-empty test and still
        // tell a screen-reader user nothing about which work they are on.
        if (typeof alt !== "string" || alt.trim().length === 0) {
            fail(`${file} has no alt text, so it cannot be shipped`);
        }
        const normalisedAlt = alt.trim().toLowerCase();
        if (altSeen.has(normalisedAlt)) {
            fail(`${file} repeats the alt text already used by ${altSeen.get(normalisedAlt)}`);
        }
        altSeen.set(normalisedAlt, file);

        const sorted = [...widths].sort((a, b) => a - b);
        const largest = sorted[sorted.length - 1];

        // The manifest is generated, but it is also hand-edited (alt text), and
        // nothing stops an entry being added by hand for a master that was never
        // processed. Without this the page would render an <img> pointing at a
        // derivative that does not exist - a broken image with no build-time
        // signal at all. Checking the files is cheap and turns that into a
        // failed build.
        for (const w of sorted) {
            for (const ext of ["webp", "jpg"]) {
                const derivative = `${basename(file)}-${w}.${ext}`;
                if (!fs.existsSync(path.join(GENERATED_DIR, derivative))) {
                    fail(
                        `${file} is missing the derivative ${derivative} — run \`npm run resize-images\``,
                    );
                }
            }
        }

        byFile.set(file, {
            file,
            // The manifest records the master's true size, because that
            // describes the photograph. What the <img> advertises has to be the
            // size of the file it actually loads, which for 0.jpg is the 1200w
            // derivative of a 1412px master. Same ratio either way, so CLS is
            // unaffected, but the attributes should not claim pixels we do not
            // serve.
            width: largest,
            height: Math.round((height * largest) / width),
            alt: alt.trim(),
            widths: sorted,
            // The <img> src is the widest JPEG: it is what a browser without
            // <picture>/srcset support falls back to, and what a crawler that
            // reads only `src` will fetch.
            src: `${DERIVATIVE_DIR}/${basename(file)}-${largest}.jpg`,
            srcsetWebp: srcsetFor(file, sorted, "webp"),
            srcsetJpeg: srcsetFor(file, sorted, "jpg"),
        });
    }

    return byFile;
}

// `sets` is hand-maintained: it decides which masters are homepage hero slides
// and which are gallery works. 0.jpg belongs only to `home` — it is the 1412px
// 16:9 hero photograph, not one of the 33 works — which is why membership is
// declared rather than inferred from the filename.
function resolveSet(manifest, byFile, name) {
    const files = manifest.sets?.[name];
    if (!Array.isArray(files) || files.length === 0) {
        fail(`\`sets.${name}\` is missing or empty`);
    }
    return files.map((file, i) => {
        const image = byFile.get(file);
        if (!image) fail(`\`sets.${name}\` references ${file}, which has no entry in \`images\``);
        return {
            ...image,
            // 1-based: these become #work-1 .. #work-33 fragment targets, and a
            // "Work 0" would read oddly in the pager's accessible names.
            position: i + 1,
            id: `${name === "works" ? "work" : "slide"}-${i + 1}`,
        };
    });
}

module.exports = function () {
    const manifest = readManifest();
    const byFile = buildIndex(manifest);
    const sets = {
        home: resolveSet(manifest, byFile, "home"),
        works: resolveSet(manifest, byFile, "works"),
    };

    // Catches the real failure mode: a new photograph dropped into originals/,
    // picked up by the resize script, given alt text — and then never wired into
    // a set, so it silently never appears on the site. Better to refuse to build
    // than to quietly drop someone's work.
    const placed = new Set();
    for (const list of Object.values(sets)) {
        for (const image of list) placed.add(image.file);
    }
    const unplaced = [...byFile.keys()].filter((file) => !placed.has(file));
    if (unplaced.length > 0) {
        fail(`${unplaced.join(", ")} belong to no set, so nothing would render them`);
    }

    return sets;
};
