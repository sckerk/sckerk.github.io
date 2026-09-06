// Configuration for the HTML validation gate in .github/workflows/pull-request-ci.yml.
//
// It runs over _site/ — build *output*, never the .njk templates in src/, which
// are not valid HTML on their own and would produce a wall of Nunjucks noise.
//
// Written as .js rather than .json so each disabled rule can carry the reason it
// is disabled. Every one of them is a style or preference rule, not an HTML
// validity rule: as of the YEO-142 baseline the site's markup validates clean,
// and nothing below hides a real defect.
module.exports = {
    root: true,
    extends: [
        "html-validate:recommended",

        // Turns off the rules that only disagree with how Prettier prints HTML.
        // `npm run lint` is `prettier --check .`, so without this the two gates
        // contradict each other and one of them has to be wrong on every commit:
        // Prettier writes `<meta ... />` (void-style, 370 hits) and a lowercase
        // `<!doctype html>` (doctype-style, 10 hits). Both are valid HTML5 - the
        // parser spec explicitly permits a self-closing void element. Prettier
        // owns formatting here.
        "html-validate:prettier",
    ],
    rules: {
        // Not covered by the prettier preset above, and not a validity rule
        // either: HTML collapses runs of whitespace, so a trailing space cannot
        // change how a page parses or renders. All 55 hits are in *generated*
        // output, left where Nunjucks stripped a tag out of a line in
        // src/_includes/layouts/base.njk - nobody typed them, and nobody can
        // usefully remove them without contorting the templates.
        "no-trailing-whitespace": "off",

        // `<ul role="list">` is deliberate, not redundant. Safari's VoiceOver
        // drops list semantics from any <ul> whose list-style is none — which is
        // every list on this site — and re-declaring the role is the documented
        // workaround. YEO-140 added these on purpose; the rule is asking to undo
        // an accessibility fix. Hits: the nav list on all five pages, and the
        // slide list on /gallery/.
        "no-redundant-role": "off",

        // The carousel's prev/next controls are <a href="#slide-N" role="button">
        // and the gallery's #slideshow is a <div role="region">. The anchors are
        // the no-JS fallback: with scripting off they are real fragment links
        // that still move the scroll-snap track, which a <button> could not do
        // (see the "no-JS fallback" note in src/js/carousel.js). Swapping in a
        // native element would delete working behaviour to satisfy a preference.
        "prefer-native-element": "off",
    },
};
