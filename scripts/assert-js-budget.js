// The JavaScript weight budget. Runs from the `eleventy.after` hook in
// .eleventy.js alongside assert-seo.js, reads the built site back off disk, and
// throws - failing `npm run build`, and with it PR CI - if any page's own
// scripts exceed the budget.
//
// Why this exists next to the Lighthouse budget in lighthouserc.json rather than
// instead of it. The two measure different things and fail at different times:
//
//   * Lighthouse asserts *transfer* size (gzipped, ~3.9 KB today) and only runs
//     in CI, on a runner, after Chrome has loaded the page.
//   * This asserts *uncompressed* size, which is what actually has to be parsed
//     and executed on a phone, and it runs on every build including a local one.
//     A reintroduced jQuery fails here in under a second, at the machine of the
//     person who added it, instead of eight minutes later in a PR check.
//
// The number is the point of the modernization: the pre-Eleventy site loaded
// Bootstrap 4.0.0-alpha.6, Tether, jQuery 1.11.2, jQuery 3.1.1 slim and jQuery
// Cycle2 - roughly 120 KB before a byte of this site's own behaviour. What
// replaced all of it is six hand-written files totalling ~12 KB on disk, of
// which no single page loads more than four.

const fs = require("node:fs");
const path = require("node:path");

// 10 KB uncompressed per page. Measured worst case at the time of writing is
// the homepage at 7,927 bytes (nav-init.js + header.js + nav.js + carousel.js),
// so there is ~2 KB of headroom - room for a genuinely new behaviour, nowhere
// near room for a framework. Raising this should be a conscious decision with a
// reason in the commit message, not a reflex when the build goes red.
const MAX_PAGE_JS_BYTES = 10 * 1024;

class JsBudgetError extends Error {}

function htmlFiles(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
        .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name));
}

// Only first-party scripts count. The Cloudflare Web Analytics beacon
// (static.cloudflareinsights.com, ~10 KB) is deliberately excluded: it is not in
// this repo, its size is not ours to control, and counting it would mean the
// budget moved whenever Cloudflare shipped a new beacon. lighthouserc.json
// blocks the same origin during audits for the same reason.
const SCRIPT_SRC = /<script\b[^>]*\bsrc="(\/[^"]+\.js)"/g;

module.exports = function assertJsBudget(outputDir) {
    const failures = [];
    let pagesChecked = 0;
    let worst = { page: "none", bytes: 0 };

    for (const file of htmlFiles(outputDir)) {
        const html = fs.readFileSync(file, "utf8");
        const scripts = [...html.matchAll(SCRIPT_SRC)].map((m) => m[1]);
        if (scripts.length === 0) continue;
        pagesChecked += 1;

        let total = 0;
        const parts = [];
        for (const src of new Set(scripts)) {
            const onDisk = path.join(outputDir, src);
            if (!fs.existsSync(onDisk)) {
                // A page referencing a script that was not emitted is a broken
                // page, and it would otherwise read here as a page that got
                // cheaper. lychee's internal pass would also catch it; this
                // catches it two jobs earlier.
                failures.push(`${path.relative(outputDir, file)} references missing script ${src}`);
                continue;
            }
            const bytes = fs.statSync(onDisk).size;
            total += bytes;
            parts.push(`${src} ${bytes}B`);
        }

        if (total > worst.bytes) worst = { page: path.relative(outputDir, file), bytes: total };

        if (total > MAX_PAGE_JS_BYTES) {
            failures.push(
                `${path.relative(outputDir, file)} loads ${total} bytes of first-party JS, ` +
                    `over the ${MAX_PAGE_JS_BYTES}-byte budget (${parts.join(", ")})`,
            );
        }
    }

    if (failures.length > 0) {
        throw new JsBudgetError(
            `assert-js-budget failed:\n  - ${failures.join("\n  - ")}\n` +
                `See scripts/assert-js-budget.js for what the budget is for.`,
        );
    }

    // Say so. A guard that prints nothing when it passes is indistinguishable in
    // a CI log from a guard that never ran.
    console.log(
        `assert-js-budget  ${pagesChecked} pages, worst ${worst.bytes} B of ` +
            `${MAX_PAGE_JS_BYTES} B budget (${worst.page})`,
    );
};
