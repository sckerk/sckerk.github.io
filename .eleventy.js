module.exports = function (eleventyConfig) {
    // Stylesheets and scripts live under src/ and are copied verbatim; the
    // leading "src/" is stripped on output, so these land at /css and /js.
    eleventyConfig.addPassthroughCopy("src/css");
    eleventyConfig.addPassthroughCopy("src/js");

    // Orbitron and Oswald as WOFF2, served from this origin. YEO-141 dropped the
    // fonts.googleapis.com stylesheet and the fonts.gstatic.com font fetches it
    // pulled in, which were the site's last third-party runtime origins. See
    // src/fonts/README.md for provenance and the "Fonts" section of
    // src/css/global.css for the @font-face block. Not to be confused with the
    // ~800 KB of unreferenced FontAwesome webfonts that used to sit in a root
    // fonts/ directory - YEO-136 deleted those, and no page ever used them.
    eleventyConfig.addPassthroughCopy("src/fonts/*.woff2");

    // What ships as /img is *generated*, never committed: scripts/resize-images.mjs
    // reads the masters in originals/ and writes WebP + JPEG derivatives into
    // generated/img/ (gitignored), which `npm run build` does before Eleventy
    // runs. See the "Images" section of README.md.
    //
    // originals/ is deliberately NOT a passthrough. It is the untouched source
    // of truth, kept so encoder settings can be revisited without re-scanning
    // anything, and the only thing keeping ~1.2 MB of unoptimised JPEG off the
    // public site is its absence from this list. Do not add it, and do not
    // replace these with a broader copy rule that would sweep it in.
    eleventyConfig.addPassthroughCopy({ "generated/img": "img" });

    // src/_data/gallery.js reads images.json itself rather than letting Eleventy
    // load it, so Eleventy does not know it is a dependency. Without this, an
    // alt-text edit under `--serve` would not rebuild anything.
    eleventyConfig.addWatchTarget("./src/_data/images.json");

    // GitHub Pages runs Jekyll over the artifact by default and drops
    // underscore-prefixed paths. Eleventy 3.1.6's passthrough sets
    // recursive-copy's `dot: true`, so a committed empty root .nojekyll is
    // copied verbatim. This replaces the `touch "$OUT/.nojekyll"` line in the
    // deleted scripts/build.sh, which was the only thing producing the file.
    eleventyConfig.addPassthroughCopy({ ".nojekyll": ".nojekyll" });

    // No CNAME passthrough, deliberately — and none should ever be added.
    //
    // Production serves from the bare apex https://sckerk.com (www. and
    // sckerk.github.io both 301 there; settled in YEO-134). GitHub Pages is
    // on build_type: "workflow", so the custom domain is held in the repo's
    // Pages *settings*, not in a file:
    //     gh api repos/sckerk/sckerk.github.io/pages  ->  "cname": "sckerk.com"
    // Nothing in the build artifact controls the domain, so it cannot detach
    // on deploy. Committing a CNAME file would create a second source of
    // truth that silently overrides the setting whenever the two disagree.
    //
    // DNS is delegated to Cloudflare, DNS-only (grey cloud) on every record.
    // The proxy is off on purpose: proxying breaks Pages' Let's Encrypt
    // issuance/renewal. Do not turn it on to "fix" anything here.

    return {
        dir: {
            input: "src",
            includes: "_includes",
            data: "_data",
            output: "_site",
        },
        templateFormats: ["njk"],
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk",
    };
};
