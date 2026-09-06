// The mobile navigation's mechanism (YEO-138). Its markup, ARIA landmark and
// focus styling are YEO-140's and are not touched here; this file owns the
// open/closed state and nothing else.
//
// The no-JavaScript contract is unchanged and is still the reason the ordering
// exists: a visitor without JavaScript gets a permanently expanded menu rather
// than a control that does nothing next to a panel that never opens. What
// changed in YEO-143 is *where* that contract lives. It used to be this file:
// the nav shipped expanded and this script collapsed it by adding `.js-nav`.
// Because this script is deferred, the collapse always landed after first paint
// and shifted the whole page (CLS 0.363). The contract is now in the markup -
// `class="no-js"` on <html> in the base layout, read by css/style.css - and
// js/nav-init.js, loaded synchronously in <head>, removes it before paint.
// Nothing in the header therefore moves once the page is painted.
//
// Above 48rem the panel is shown unconditionally and the button is
// display:none, so none of this applies to the desktop nav.
(function () {
    var button = document.getElementById("mobile-nav-button");
    var nav = document.getElementById("site-nav");
    if (!button || !nav) return;

    function isOpen() {
        return button.getAttribute("aria-expanded") === "true";
    }

    // aria-expanded and the class are set together and never separately: the
    // attribute is the state, and the class is only how the stylesheet reads
    // it. Splitting them is how a toggle ends up announcing the wrong thing.
    function setOpen(open) {
        button.setAttribute("aria-expanded", open ? "true" : "false");
        nav.classList.toggle("is-open", open);
    }

    button.addEventListener("click", function () {
        setOpen(!isOpen());
    });

    // Escape closes and hands focus back to the button. Without the focus
    // return, closing the panel while a link inside it is focused would leave
    // focus on a display:none element and the next Tab would restart from the
    // top of the document.
    document.addEventListener("keydown", function (event) {
        if (event.key !== "Escape" || !isOpen()) return;
        setOpen(false);
        button.focus();
    });
})();
