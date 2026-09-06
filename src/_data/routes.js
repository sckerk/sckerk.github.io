// The route registry: the single source of truth for every real URL this site
// serves, and for the title, description and Open Graph type that go with it.
//
// Five things read this file, and that is the whole point of it existing:
//
//   1. src/_includes/partials/nav.njk  - which links the nav renders
//   2. src/_includes/layouts/base.njk  - title, description, canonical, OG/Twitter
//   3. src/sitemap.njk                 - the <loc> list
//   4. src/redirects.njk               - one meta-refresh stub per `legacy` path
//   5. scripts/assert-seo.js           - the build-time check that all four agree
//
// Before this file, `pages` in site.json listed the routes and nothing else
// knew about them: the metadata was empty strings pasted into six copies of the
// same <head>. Titles and descriptions live here rather than in each page's
// front matter specifically so the sitemap and the redirect stubs can see them
// without opening a template.
//
// `path` is the canonical URL path, in the trailing-slash form the sitemap and
// the canonical link both use, character for character. `/bio` and `/bio/` are
// different URLs to a crawler, so the two must never be allowed to drift; the
// build assertion is what enforces it.
//
// `legacy` is the pre-Eleventy URL that must keep working. YEO-136 deliberately
// shipped `.html` permalinks so that this ticket could flip to directory URLs
// and start serving the old paths as redirect stubs in the same commit. Never
// ship one half of that. `gallery1.html` and `header.html` were dead files with
// no inbound links and are deliberately absent: they 404, as intended.
//
// The homepage has no `legacy` entry because it needs none - Eleventy still
// writes the real file at /index.html, so the old URL keeps resolving on its
// own. It just canonicalises to "/".

// Titles are the search result's first line, so they lead with the page and end
// with the artist. Exhibitions bill the artist as "Kerk Siew Chu" (see
// src/events.njk); the pre-existing <title> said "Siew Chu Kerk". Both forms are
// real, so search-facing copy standardises on the exhibition order and the other
// form is carried in JSON-LD `alternateName` (see src/_data/structuredData.js)
// so a search for either still resolves. The visible header keeps the wording it
// has always had - this ticket changes metadata, not page copy.
//
// Descriptions are held to 140-160 characters below because that is the window
// Google will render without truncating, and every one of them is written from
// what the page actually says. Nothing here claims an exhibition, a credential
// or a medium that is not already in src/bio.njk or src/events.njk.
const PAGES = [
    {
        key: "home",
        path: "/",
        legacy: null,
        label: "Home",
        nav: false,
        // "profile" is tempting for an artist's site, but og:type "profile"
        // expects first_name/last_name/username and describes a person, not a
        // page. The homepage is the site itself; the bio page is the person.
        ogType: "website",
        title: "Kerk Siew Chu — Painter and Sculptor",
        description:
            "Malaysian-born artist living and working in New York. Painting, sculpture " +
            "and digital work on the cycle of life, adaptation, reason and intuition.",
    },
    {
        key: "works",
        path: "/gallery/",
        legacy: "/gallery.html",
        label: "Works",
        nav: true,
        ogType: "website",
        title: "Works — Kerk Siew Chu",
        description:
            "Selected paintings, sculpture, ceramics and digital work by Kerk Siew Chu, " +
            "spanning four decades of practice in Malaysia, London and New York.",
    },
    {
        key: "events",
        path: "/events/",
        legacy: "/events.html",
        label: "Events",
        nav: true,
        ogType: "website",
        title: "Exhibitions — Kerk Siew Chu",
        description:
            "Past exhibitions by the artist Kerk Siew Chu, including the 2017 solo " +
            "exhibition at the NTNU Teh-Chun Art Gallery in Da’an District, Taipei, Taiwan.",
    },
    {
        key: "bio",
        path: "/bio/",
        legacy: "/bio.html",
        label: "Bio",
        nav: true,
        // The bio page is about the person, which is exactly what og:type
        // "profile" describes, and it is the page carrying the Person JSON-LD.
        ogType: "profile",
        title: "Biography — Kerk Siew Chu",
        description:
            "Artist statement, education and exhibition history. New York University M.A. " +
            "in Studio Art; work shown at the Smithsonian and the Hayward Gallery.",
    },
    {
        key: "contact",
        path: "/contact/",
        legacy: "/contact.html",
        label: "Contact",
        nav: true,
        ogType: "website",
        title: "Contact — Kerk Siew Chu",
        description:
            "Get in touch with the artist Kerk Siew Chu by email or on Facebook about " +
            "exhibitions, commissions, public and private collections, and available work.",
    },
];

// Google truncates a title around 60 characters and a description outside
// roughly 140-160, so both bounds are checked here rather than left to a human
// to eyeball. These run at data-load time, so a bad edit fails `npm run build`
// immediately instead of shipping a truncated search result.
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 140;
const DESCRIPTION_MAX = 160;

function fail(message) {
    throw new Error(`src/_data/routes.js: ${message}`);
}

const seenKeys = new Set();
const seenPaths = new Set();
const seenTitles = new Set();
const seenDescriptions = new Set();

for (const page of PAGES) {
    const { key, path, legacy, title, description } = page;

    if (!key || seenKeys.has(key)) fail(`duplicate or missing key: ${JSON.stringify(key)}`);
    seenKeys.add(key);

    // Trailing slash is not cosmetic. It has to match the sitemap <loc>, the
    // canonical link and the redirect target exactly, so it is normalised at
    // the source rather than patched at each of the four call sites.
    if (typeof path !== "string" || !path.startsWith("/") || !path.endsWith("/")) {
        fail(`${key}: path must start and end with "/", got ${JSON.stringify(path)}`);
    }
    if (seenPaths.has(path)) fail(`${key}: duplicate path ${path}`);
    seenPaths.add(path);

    if (legacy !== null && (!legacy.startsWith("/") || !legacy.endsWith(".html"))) {
        fail(`${key}: legacy must be null or a root-absolute .html path, got ${legacy}`);
    }

    // Unique, not merely present: six identical titles is the exact failure
    // this ticket exists to correct, and it would pass a non-empty check.
    if (!title || title.length > TITLE_MAX) {
        fail(`${key}: title must be 1-${TITLE_MAX} characters, got ${title?.length}`);
    }
    if (seenTitles.has(title)) fail(`${key}: title duplicates another route's`);
    seenTitles.add(title);

    if (
        !description ||
        description.length < DESCRIPTION_MIN ||
        description.length > DESCRIPTION_MAX
    ) {
        fail(
            `${key}: description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters, ` +
                `got ${description?.length}`,
        );
    }
    if (seenDescriptions.has(description)) fail(`${key}: description duplicates another route's`);
    seenDescriptions.add(description);
}

module.exports = {
    all: PAGES,
    // Nunjucks cannot call .filter(), so the views the templates need are
    // precomputed here instead of being reconstructed in three templates.
    nav: PAGES.filter((p) => p.nav),
    sitemap: PAGES,
    redirects: PAGES.filter((p) => p.legacy),
    byKey: Object.fromEntries(PAGES.map((p) => [p.key, p])),
};
