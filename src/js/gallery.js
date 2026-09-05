// Enhancement only: scroll-snap and the pager's fragment links do the work.
(function () {
    var scroller = document.getElementById("slideshow");
    var pager = document.getElementById("pager");
    if (!scroller || !pager) return;

    var slides = Array.from(scroller.querySelectorAll(".slide"));
    var links = Array.from(pager.querySelectorAll("a"));
    if (!slides.length) return;

    var current = 0;
    var mq = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    var behavior = mq && mq.matches ? "auto" : "smooth";

    function setCurrent(i) {
        current = i;
        links.forEach(function (link, n) {
            link.setAttribute("aria-current", n === i);
        });
    }

    function goTo(i) {
        if (i < 0 || i >= slides.length) return;
        setCurrent(i);
        slides[i].scrollIntoView({ behavior: behavior, block: "nearest", inline: "center" });
    }

    // Ratio test, not just isIntersecting: the outgoing slide fires too.
    if ("IntersectionObserver" in window) {
        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting && e.intersectionRatio >= 0.6) {
                        setCurrent(slides.indexOf(e.target));
                    }
                });
            },
            { root: scroller, threshold: 0.6 },
        );
        slides.forEach(function (s) {
            observer.observe(s);
        });
    }

    // href is the no-JS fallback; intercepting keeps hashes out of history.
    links.forEach(function (link, i) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            goTo(i);
        });
    });

    scroller.addEventListener("keydown", function (event) {
        var d = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        event.preventDefault();
        goTo(current + d);
    });
})();
