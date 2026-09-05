module.exports = function (eleventyConfig) {
    // Stylesheets and scripts live under src/ and are copied verbatim; the
    // leading "src/" is stripped on output, so these land at /css and /js.
    eleventyConfig.addPassthroughCopy("src/css");
    eleventyConfig.addPassthroughCopy("src/js");

    // img/ stays at the repo root on purpose: 34 binaries, and moving them
    // would bury this PR's real diff under 34 renames for zero benefit.
    // Object form gives an explicit output path rather than relying on
    // input-dir stripping for a path that is outside the input dir.
    eleventyConfig.addPassthroughCopy({ img: "img" });

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
