// Runs before first paint and does exactly one thing (YEO-143). `no-js` on
// <html> is the no-JavaScript header state - nav expanded, toggle hidden - and
// removing it here, ahead of paint, is what stops the scripted state arriving
// as a visible collapse (CLS 0.363 on every page). Loaded from <head> WITHOUT
// `defer` for that reason; an inline script would be refused by the CSP's
// `script-src 'self'`, which is why this is a file. Keep it one statement: a
// second responsibility here means the approach is wrong. See js/nav.js.
document.documentElement.classList.remove("no-js");
