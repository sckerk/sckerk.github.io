/**
 * Email obfuscation for the contact page (YEO-141).
 *
 * The served HTML contains no mailto: and no address in a shape a harvester's
 * regex matches - the local part and the domain sit in separate data
 * attributes and are never adjacent in the markup. The href is assembled here,
 * and not until the visitor actually reaches for the link.
 *
 * This defeats naive scrapers - the ones that fetch HTML and run a regex over
 * it - and nothing more. Anything driving a real browser reads the address the
 * moment it hovers. That is the honest limit of the technique and the reason
 * it is worth two dozen lines rather than a third-party form service.
 *
 * The anchor deliberately ships with no href at all, so with JS off it is inert
 * text rather than a dead link, and contact.njk's <noscript> carries a readable
 * fallback. Adding the href here is what turns it back into a link, which is
 * also why tabindex and role are set on load: without them a keyboard user
 * could never focus the element to trigger the reveal in the first place.
 */
(function () {
    "use strict";

    var link = document.getElementById("email-link");
    if (!link) return;

    var local = link.dataset.local;
    var domain = link.dataset.domain;
    if (!local || !domain) return;

    link.setAttribute("tabindex", "0");
    link.setAttribute("role", "link");

    // Returns true only on the call that actually populates the href, so the
    // activation handlers below can tell "I just made this a link, follow it
    // myself" from "it was already a link, let the browser do its job".
    function reveal() {
        if (link.hasAttribute("href")) return false;
        link.setAttribute("href", "mailto:" + local + "@" + domain);
        return true;
    }

    ["pointerenter", "focus", "touchstart"].forEach(function (type) {
        link.addEventListener(type, reveal, { once: true, passive: true });
    });

    function activate(event) {
        if (event.type === "keydown" && event.key !== "Enter") return;
        if (!reveal()) return;
        event.preventDefault();
        window.location.href = link.href;
    }

    link.addEventListener("click", activate);
    link.addEventListener("keydown", activate);
})();
