// Homepage hero. Replaces Bootstrap 4.0.0-alpha.6's JS carousel (plus jQuery
// and Tether, ~120 KB) with CSS scroll-snap driven by one IntersectionObserver.
// Bootstrap's data-ride defaults are preserved: 5000 ms interval, wrap, and
// pause on hover.
(function () {
    var carousel = document.querySelector(".carousel");
    if (!carousel) return;

    var track = carousel.querySelector(".carousel-track");
    var slides = Array.prototype.slice.call(carousel.querySelectorAll(".carousel-slide"));
    var dots = Array.prototype.slice.call(carousel.querySelectorAll(".carousel-dots a"));
    var prev = carousel.querySelector(".carousel-control-prev");
    var next = carousel.querySelector(".carousel-control-next");
    if (!track || slides.length === 0) return;

    var count = slides.length;
    var current = 0;
    var timer = null;
    var reduceMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function goTo(i) {
        var idx = ((i % count) + count) % count;
        // Commit the new index before scrolling rather than waiting for the
        // observer: a smooth scroll resolves asynchronously, and if the next
        // auto-advance fired first it would re-target the slide we are
        // already moving to and the carousel would stall. The observer still
        // has the last word whenever the user scrolls or swipes by hand.
        setCurrent(idx);
        slides[idx].scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "nearest",
            inline: "start",
        });
    }

    function setCurrent(i) {
        current = i;
        dots.forEach(function (dot, n) {
            if (n === i) dot.setAttribute("aria-current", "true");
            else dot.removeAttribute("aria-current");
        });
        // Keep the no-JS anchors pointing at the wrapped neighbours.
        if (prev)
            prev.setAttribute("href", "#slide-" + (((((i - 1) % count) + count) % count) + 1));
        if (next)
            next.setAttribute("href", "#slide-" + (((((i + 1) % count) + count) % count) + 1));
    }

    // One observer replaces both Bootstrap's `.active` bookkeeping and any
    // scroll listener: it reports which slide is showing, and dot state plus
    // control targets derive from that.
    if ("IntersectionObserver" in window) {
        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    // isIntersecting is true for any ratio above zero, so the
                    // outgoing slide also fires as it crosses 0.6 downward.
                    // Test the ratio too, or that callback would briefly set
                    // `current` back to the slide we are scrolling away from.
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                        setCurrent(slides.indexOf(entry.target));
                    }
                });
            },
            { root: track, threshold: 0.6 },
        );
        slides.forEach(function (slide) {
            observer.observe(slide);
        });
    } else {
        setCurrent(0);
    }

    // The href="#slide-N" anchors stay as the no-JS fallback; intercepting
    // the click avoids pushing a hash onto the history stack.
    function bind(el, resolve) {
        if (!el) return;
        el.addEventListener("click", function (event) {
            event.preventDefault();
            goTo(resolve());
        });
    }
    dots.forEach(function (dot, i) {
        bind(dot, function () {
            return i;
        });
    });
    bind(prev, function () {
        return current - 1;
    });
    bind(next, function () {
        return current + 1;
    });

    function start() {
        if (reduceMotion || timer) return;
        timer = window.setInterval(function () {
            goTo(current + 1);
        }, 5000);
    }
    function stop() {
        window.clearInterval(timer);
        timer = null;
    }
    carousel.addEventListener("pointerenter", stop);
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("pointerleave", start);
    carousel.addEventListener("focusout", start);
    start();
})();
