// Replaces the sizeitup() half of the old jQuery js/style.js. The other two
// handlers there were dead: #level-two and #navicon exist in no page.
//
// NOTE: no CSS rule currently matches header.top in either stylesheet, so
// toggling it is presently a no-op. Kept per YEO-136/D6: it costs ten lines,
// preserves the documented behaviour contract, and YEO-138 may add the rule.
(function () {
    var sentinel = document.getElementById("top-sentinel");
    var header = document.querySelector("header");
    if (!sentinel || !header || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(
        function (entries) {
            header.classList.toggle("top", entries[0].isIntersecting);
        },
        { threshold: 0 },
    ).observe(sentinel);
})();
