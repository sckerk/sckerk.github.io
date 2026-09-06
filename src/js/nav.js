// The mobile navigation's mechanism (YEO-138). Its markup, ARIA landmark and
// focus styling are YEO-140's and are not touched here; this file owns the
// open/closed state and nothing else.
//
// Progressive enhancement, in this order and for this reason: the button ships
// with the `hidden` attribute and the nav ships visible, so a visitor without
// JavaScript gets a permanently expanded menu rather than a control that does
// nothing next to a panel that never opens. Revealing the button and letting
// CSS collapse the panel are therefore the same act - `.js-nav` on <html> is
// what tells the stylesheet a toggle now exists (see `.js-nav header nav` in
// css/style.css). Above 48rem the panel is shown unconditionally and the
// button is display:none, so none of this applies to the desktop nav.
(function () {
    var button = document.getElementById("mobile-nav-button");
    var nav = document.getElementById("site-nav");
    if (!button || !nav) return;

    document.documentElement.classList.add("js-nav");
    button.hidden = false;

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
