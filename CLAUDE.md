# CLAUDE.md

Guidance for an agent about to change code in `sckerk.github.io`. See
`README.md` for what the site is and how to run it.

## What this repo is, right now

Six raw HTML files at the repo root (`index.html`, `gallery.html`,
`bio.html`, `events.html`, `contact.html`, plus two unlinked cruft files —
`header.html` and `gallery1.html` — that exist only to be deleted), a
`css/` directory, a `js/` directory carrying jQuery 1.11.2 and jQuery
Cycle2, an `img/` directory of 34 photos, and a `fonts/` directory of
FontAwesome webfonts. `css/global.css` does `@font-face` them in, but
**no HTML on the site ever uses a FontAwesome icon class**, so they're
declared but never rendered — dead weight, ~800 KB. `fonts/` is reachable
only from CSS, never from HTML. There is no build step today:
`scripts/build.sh` just copies an
allowlist of files into `_site/` so the Actions-based Pages deploy has a
directory artifact to upload. Search traffic is a stated audience for this
site — that's why indexability shows up repeatedly in the ticket list
below.

`npm run lint` is a placeholder that echoes a message and exits 0. There is
no linter installed and no test suite — don't invent `npm test`.

## The Eleventy structure now landing (in flight, not yet on `main`)

YEO-136 replaces the raw-HTML stack with **Eleventy** (v3.x) and
**Nunjucks** (`.njk`) templates. No client framework, no bundler. As of
this writing it has its own branch but hasn't diverged from `main` yet, so
don't go looking for the shape in the tree — this is what's coming:

```
.eleventy.js                 → input src/, output _site/, passthroughs
src/
  _includes/layouts/base.njk → <head>, header, footer, script tags
  _includes/partials/nav.njk → the nav, extracted from all six page copies
  _data/site.json            → title, canonical origin, author, nav items
  index.njk / gallery.njk / bio.njk / events.njk / contact.njk
  css/                        → global.css, style.css (cleaned)
  js/                         → vanilla replacements for style.js
img/                          → passthrough-copied
```

**The last line is superseded by YEO-137.** There is no `img/` in the tree
any more:

```
originals/                    → the 34 master JPEGs, committed, NEVER served
generated/img/                → WebP + JPEG derivatives, gitignored build
                                output, passthrough-copied to /img
scripts/resize-images.mjs     → sharp pipeline; `npm run build` is
                                `resize-images && eleventy`
src/_data/images.json         → generated manifest: width/height/widths plus
                                hand-written alt for all 34, and the `sets`
                                that assign masters to the home or works page
src/_data/gallery.js          → turns that manifest into slide data
src/js/gallery.js             → the gallery carousel's enhancement layer
```

`originals/` is kept off the public site solely by *not* being listed as a
passthrough — don't add it, and don't widen the copy rules. `gallery.js`
**throws, failing the build, if any image has empty or duplicated alt text or
belongs to no set**. Alt text is written by a person looking at the work; it
is never generated and never defaulted.

Why it matters once it lands:

- **The whole 2017 dependency stack is deleted**: Bootstrap
  4.0.0-alpha.6 + Tether from the dead `maxcdn.bootstrapcdn.com` host,
  both jQuery loads, and Cycle2. Today `index.html` loads jQuery 3.1.1
  *slim* from a CDN, but `gallery.html`/`gallery1.html`/`header.html` then
  load `js/jquery.js` (1.11.2) on top, silently clobbering the global.
  On the other pages `$` is the slim build, which lacks `$.ajax` and the
  effects module that Cycle2 needs. The slideshow's behavior depends on
  which page loaded it — that's the reason for removal, not just being
  outdated.
- `index.html`'s mobile nav uses `hidden-md-up`, a class **removed in
  Bootstrap 4 beta**. An in-place version bump was considered and
  rejected — it breaks the toggle.
- `js/style.js` (589 bytes) is mostly dead code; its one live behavior
  (drop a `.top` class on scroll) becomes an `IntersectionObserver` on a
  sentinel element. **No `scroll` listener should exist in shipped JS.**
  Total JS budget: under 5 KB uncompressed, down from ~120 KB today.
- The inline normalize.css v1.1.3 block (2013, with IE 6/7 hacks) pasted
  at the top of `css/global.css` is stripped.
- **URLs change shape**: Eleventy emits `bio/index.html`, so `/bio.html`
  becomes `/bio/` for every page. Redirects are YEO-139's job, deliberately
  not YEO-136's — treat the two as linked.
- `_site/.nojekyll` must keep being emitted (by the Eleventy config now,
  instead of `scripts/build.sh`), or Pages' Jekyll pass will silently drop
  underscore-prefixed output paths.
- The `<h1>` contains `郭 秀 洙` and `events.html` is substantially
  bilingual — verify UTF-8 survives the template round-trip by checking
  rendered bytes, not just what the browser paints.
- `gallery.html` mixes root-absolute `/img/…` (30 occurrences) with
  relative `img/…` (3); both only work because this is a domain-root user
  site. Normalize during the port.

## Settled design constraints — don't relitigate these

- The visual design must stay recognizable: Orbitron headings, Oswald
  body, black-on-white, generous nav padding, existing proportions. This
  is a re-implementation, not a redesign.
- The slideshow stays a slideshow (CSS scroll-snap), not a grid + lightbox
  — but all 33 images must ship as real `<img>` elements in the served
  HTML. The current `background-image` divs are invisible to crawlers.
- **No per-work metadata exists** — no titles, years, media, or
  dimensions for any of the 33 works. That's why there are no per-work
  detail pages and no `VisualArtwork` structured data planned. Do not
  invent any of it; it would be a factual claim about someone's art.
- Eleventy was chosen deliberately over Astro, and over mirroring the
  sibling `maxyeo.github.io/portfolio24` (Vite + React 19), which was the
  standing recommendation. Treat the choice as settled, not open for
  debate in a PR.

## Hosting facts that are true but invisible in the tree

- Canonical origin is `https://sckerk.com` — bare apex, no trailing slash.
  Use it for canonical links, `og:url`, and sitemap entries.
  `www.sckerk.com` and `sckerk.github.io` both 301 to the apex.
- DNS is delegated to Cloudflare and kept **DNS-only (grey cloud) on every
  record, deliberately**. Turning on the orange-cloud proxy breaks GitHub
  Pages' own Let's Encrypt certificate — don't enable it. TLS mode is Full
  (Strict) as a seatbelt only.
- **There is no `CNAME` file in this repo, and none should be added.**
  Pages is on `build_type: workflow`, so the custom domain lives in Pages
  settings, not source. Adding a `CNAME` file creates a second source of
  truth that can silently override the setting.
- Analytics is **Cloudflare Web Analytics**, not Plausible (Plausible has
  no usable free tier). YEO-141 landed the beacon in
  `src/_includes/layouts/base.njk`. Because the zone is DNS-only,
  Cloudflare will **not** auto-inject it; that one tag is the only reason
  anything is collected, so deleting it silently ends measurement. It is
  `type="module"` (already deferred — do not add `defer`) and carries no
  `integrity`, because Cloudflare revises `beacon.min.js` in place at a
  stable URL and publishes no hash. It is cookieless, which is why there
  is **no consent banner and should not be one**.
- **Security posture, after YEO-141.** The CSP lives in a
  `<meta http-equiv>` in the base layout, because Pages cannot set
  response headers. `frame-ancestors` and `report-uri` are **ignored in
  meta form**, so there is no clickjacking protection and no violation
  report channel — the comment beside the tag says so, and that gap
  should not be quietly recorded as covered. `style-src` is `'self'` with
  no `'unsafe-inline'`, which only holds while **zero inline `style=`
  attributes** exist in the built output; if one appears, fix the style
  rather than loosening the policy. Orbitron and Oswald are self-hosted
  WOFF2 under `src/fonts/` (see its `README.md`), so the only remaining
  third-party origins anywhere on the site are the two Cloudflare
  analytics hosts — `static.cloudflareinsights.com` serves the beacon and
  `cloudflareinsights.com` receives its POSTs, and both are needed.
  `contact.njk` publishes no address and no `mailto:`; `src/js/contact.js`
  assembles the href from split data attributes on first interaction.
- `package.json` `engines` (`^22.13.0 || ^24.0.0`) is deliberately wider
  than `.nvmrc` (`24.13.0`), so both CI's Node 24 and the maintainer's
  local Node 22 satisfy it. Don't "fix" this into a single pin.
- `scripts/build.sh` copies from an explicit allowlist
  (`css/ fonts/ img/ js/` + root `*.html`), never `cp -r .`, so
  `package.json`, the lockfile, `scripts/`, and `.github/` never ship to
  Pages. It's commented for deletion once Eleventy lands.

## CI/CD

- `.github/workflows/pull-request-ci.yml` runs on PRs into `main`. Job
  name `validate`: checkout → setup-node 24 → `npm ci` → `npm run lint` →
  `npm run build`.
- `.github/workflows/deploy-pages.yml` runs on push to `main` (and
  `workflow_dispatch`): `npm ci` → `npm run build` → configure-pages →
  upload-pages-artifact (`path: _site`) → deploy-pages.
- **Every `uses:` step is pinned to a commit SHA with a trailing version
  comment.** Keep new steps pinned the same way.
- `.github/dependabot.yml` groups npm dev and production minor/patch
  bumps into two separate weekly PRs; **majors are deliberately left
  ungrouped** so a breaking change always arrives as its own PR. GitHub
  Actions bumps are grouped into one PR, since the SHA pins would
  otherwise never move on their own.
- A branch ruleset named **`protect main`** is active on the default
  branch. It blocks deletion and force-pushes, requires a pull request,
  allows **squash merges only**, and requires **zero** approving reviews —
  so nothing in this repo gates on a human or an agent approving a PR.
- **Known gap**: that ruleset requires only the `validate` check. It was
  created a day before YEO-142 added `lighthouse`, `html-validate` and
  `links`, and was never updated, so **three of the four PR checks are
  advisory**. A PR that regresses CLS, drops an accessibility score,
  emits invalid HTML, or breaks a link goes red and merges anyway. Fixing
  it means adding those three contexts to the existing ruleset, which is
  admin-gated: the repo is owned by `sckerk` and the maintainer's own
  account has push/triage but not admin.

## Linear workspace — read this before filing anything

Two Linear MCP servers are configured on this machine and they point at
different workspaces. `mcp__linear__*` points at an unrelated workspace —
wrong for this repo. `mcp__linear-yeowiki__*` is **Yeo Wiki** (team
`YEO`) — the right one. The bare `linear` name reads like the
default, which is exactly the trap. Creating a ticket in the wrong
workspace does not error; it just quietly succeeds somewhere else. After
creating or fetching a ticket, confirm the returned URL starts with
`linear.app/yeo-wiki`.

## The YEO-1xx ticket workflow

Work is tracked in Linear, project **"sckerk.github.io Modernization"**,
team key `YEO`. Nine tickets, YEO-134 through YEO-142:

- YEO-134 [Admin] Acquire custom domain and configure DNS + HTTPS — Done
- YEO-135 [Admin] Node toolchain, CI/CD, grouped Dependabot — Done (PR #6)
- YEO-136 [Web] Scaffold Eleventy, port pages to shared templates — In Progress
- YEO-137 [Web] Rebuild gallery slideshow as native, indexable, responsive images
- YEO-138 [Web] Fix responsive layout and mobile navigation
- YEO-139 [Web] SEO foundation — metadata, sitemap, structured data, 301s
- YEO-140 [Web] Accessibility and semantic HTML pass
- YEO-141 [Web] Security hardening, email obfuscation, privacy-friendly analytics
- YEO-142 [Admin] Lighthouse CI, HTML validation, link checking in PR CI

(137–142 are Backlog.) **YEO-136 is the keystone** — it blocks all six of
137–142, and is itself blocked by YEO-135. **YEO-142 must land last**,
since its Lighthouse thresholds need to be measured from the finished
site rather than guessed.

Ticket titles carry an area prefix: `[Web]`, `[Admin]`. Sections are
fixed: OVERVIEW, BACKGROUND, TECHNICAL APPROACH, ACCEPTANCE CRITERIA,
EDGE CASES & CONSIDERATIONS, OUT OF SCOPE, DEPENDENCIES, CODEBASE NOTES.

### Git and PR conventions

- Commit subject: `YEO-<n> Short description` — ticket ID, space, short
  imperative summary, blank line, then a body explaining *what* and *why*
  (not *how*), hard-wrapped rather than left as one long line. `f7ea548`
  is the reference example (72-character subject excluding GitHub's
  auto-appended `(#6)`; body wrapped at roughly 74–77 columns). This
  repo's history carries no AI-attribution trailers.
- Branch names: `YEO-<n>-<kebab-slug>`, e.g.
  `YEO-135-admin-add-node-toolchain-github-actions-cicd-and-grouped-dependabot`.
- PR title: `YEO-<n>: <full Linear ticket title>`, e.g.
  `YEO-135: [Admin] Add Node toolchain, GitHub Actions CI/CD, and grouped Dependabot`.
- PR body opens with `Linear ticket: <url>`, then Summary / Test plan /
  Acceptance criteria as checkboxes mirroring the ticket, and an explicit
  "Owner hand-off" section for anything admin-gated the PR can't do
  itself. PR #6 (`gh pr view 6`) is the model to follow.
- The PR that added this file and `README.md` has **no YEO ticket** — it
  came from an ad-hoc task run, which is why its naming doesn't follow
  the `YEO-<n>` convention above. Ticketed work should follow it.
