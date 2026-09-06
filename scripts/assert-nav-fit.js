// A staleness tripwire for the hand-measured 431px in src/css/style.css.
//
// YEO-138 sizes the site title against the space the nav leaves it:
//
//     --title-fit-cap: calc((100vw - 431px) / 13);   /* >= 48rem */
//
// 431 is 20px of header padding, plus 30px of title padding, plus 381px - the
// width the four nav links shrink-wrap to, which was measured by hand in a
// browser and cannot be derived from the stylesheet. YEO-138's author flagged
// the missing guard and suggested it belonged here.
//
// BE CLEAR ABOUT WHAT THIS IS. It does not measure anything and cannot tell you
// that 381px is still the right number. Measuring it means laying out real text
// in the real Oswald face at the real size, which needs a headless browser -
// ~300 MB of Chromium in a build that currently takes under a second, to check
// one constant. That trade is not worth making, so this does the next best
// thing: it pins every *input* the measurement was taken from and fails the
// build when one of them moves, with a message telling you to re-measure.
//
// So it catches the regressions that actually happen - a fifth nav item, a
// renamed link, a change to the nav's font size or padding - and it does not
// catch a browser or font update quietly changing the shrink-wrap width by a few
// pixels. A real measurement would be strictly better; this is what is cheap.
//
// To re-measure: load the site at >= 768px, inspect `header nav`, take its
// rendered width, and update NAV_SHRINK_WRAP_PX plus the constant in style.css
// and the comment above it. All three change together or none of them do.

const fs = require("node:fs");
const path = require("node:path");

const routes = require("../src/_data/routes.js");

const STYLESHEET = path.join(__dirname, "..", "src", "css", "style.css");

// The measurement, and everything it assumed. Changing any of these without
// re-measuring is exactly the failure this file exists to make loud.
const NAV_SHRINK_WRAP_PX = 381;
const HEADER_PADDING_PX = 20; // --header-padding: 0.625rem, both sides
const TITLE_PADDING_PX = 30;
const EXPECTED_CAP_PX = NAV_SHRINK_WRAP_PX + HEADER_PADDING_PX + TITLE_PADDING_PX; // 431

// The nav labels the 381px was measured with, in order. src/_data/routes.js is
// the source of truth for what the nav renders, so this compares against it
// rather than against the markup.
const MEASURED_LABELS = ["Works", "Events", "Bio", "Contact"];

// The custom properties that set a nav link's box. Both feed the shrink-wrap
// width directly: change either and 381px is fiction.
const MEASURED_CUSTOM_PROPERTIES = {
    "--nav-link-size": "0.875rem",
    "--nav-link-padding": "1.875rem",
    "--header-padding": "0.625rem",
};

class NavFitError extends Error {}

const RE_MEASURE =
    "Re-measure the nav's rendered width at >= 768px and update NAV_SHRINK_WRAP_PX in " +
    "scripts/assert-nav-fit.js together with the 431px constant in src/css/style.css.";

module.exports = function assertNavFit() {
    const css = fs.readFileSync(STYLESHEET, "utf8");
    const failures = [];

    const labels = routes.nav.map((page) => page.label);
    if (labels.join("|") !== MEASURED_LABELS.join("|")) {
        failures.push(
            `nav labels are now [${labels.join(", ")}] but 431px was measured with ` +
                `[${MEASURED_LABELS.join(", ")}]. ${RE_MEASURE}`,
        );
    }

    for (const [property, expected] of Object.entries(MEASURED_CUSTOM_PROPERTIES)) {
        const match = new RegExp(`${property}:\\s*([^;]+);`).exec(css);
        if (!match) {
            failures.push(`${property} is no longer declared in src/css/style.css. ${RE_MEASURE}`);
        } else if (match[1].trim() !== expected) {
            failures.push(
                `${property} is ${match[1].trim()} but 431px was measured with ${expected}. ` +
                    RE_MEASURE,
            );
        }
    }

    // Guard the arithmetic too, so the constant and the derivation recorded above
    // cannot drift apart - which is how a comment starts lying about a number.
    const cap = /--title-fit-cap:\s*calc\(\(100vw - (\d+)px\) \/ 13\);/g;
    const found = [...css.matchAll(cap)].map((m) => Number(m[1]));
    if (!found.includes(EXPECTED_CAP_PX)) {
        failures.push(
            `no --title-fit-cap of ${EXPECTED_CAP_PX}px found in src/css/style.css ` +
                `(found: ${found.join(", ") || "none"}), but ${NAV_SHRINK_WRAP_PX} + ` +
                `${HEADER_PADDING_PX} + ${TITLE_PADDING_PX} = ${EXPECTED_CAP_PX}. ${RE_MEASURE}`,
        );
    }

    if (failures.length > 0) {
        throw new NavFitError(`assert-nav-fit failed:\n  - ${failures.join("\n  - ")}`);
    }

    console.log(
        `assert-nav-fit  ${labels.length} nav links, --title-fit-cap ${EXPECTED_CAP_PX}px inputs unchanged`,
    );
};
