# sckerk.github.io

The portfolio site of the artist **Siew Chu Kerk / 郭 秀 洙**. Born Batu
Pahat, Malaysia; lives and works in New York. MA in Studio Art, NYU
(1988–91); Byam Shaw School of Art and City of London Polytechnic, London;
BFA, National Taiwan Normal University, Taipei.

Live at **https://sckerk.com**.

Five pages: home (carousel), a gallery slideshow of the works, exhibitions,
a bio (statement, education, exhibitions, publications), and contact
(email + Facebook).

## Current state

The site is built with [Eleventy](https://www.11ty.dev/) and Nunjucks
templates under `src/`. No client framework, no bundler; the only shipped
JavaScript is three small vanilla files under `src/js/`.

## Requirements

- Node, version pinned in `.nvmrc` (`nvm use`)

## Run locally

```
npm run dev
```

Generates any missing image derivatives, then serves the built site with
live reload at http://localhost:8080.

## Build

```
npm run build
```

Three steps: `npm run resize-images` regenerates `generated/img/` from the
masters in `originals/`, `npm run generate-icons` regenerates
`generated/site/` (the favicons and the Open Graph share image), then
Eleventy renders `src/` into `_site/` and runs the SEO assertions over the
result. That is exactly what CI runs, so a green local build is a real
predictor.

```
npm run lint
```

`prettier --check .` over the whole repo.

## Images

The 34 master photographs live in `originals/` and are committed. They are
**never served** — nothing copies them into `_site/`. What ships is the
derivatives in `generated/img/`, which are build output and are _not_
committed (`generated/` is gitignored).

```
npm run resize-images                # generate whatever is missing or stale
npm run resize-images -- --force     # regenerate everything
npm run resize-images -- --dry-run   # report only, write nothing
npm run resize-images -- --help
```

Each master gets WebP and JPEG derivatives at 200/400/800/1200 px, clamped
so nothing is ever upscaled past the master's own width. Most of these
photographs are small — the widest gallery work is 623 px — so on many
images only the 200 px rung plus the master's own width survive.

`src/_data/images.json` is the manifest. The script rewrites the measured
fields (`width`, `height`, `widths`) on every run and **preserves the
hand-written `alt` text**, so regenerating is always safe. `sets` is
hand-maintained and decides which masters are homepage hero slides and
which are gallery works.

### Adding or replacing a work

1. Drop the photograph into `originals/`, or overwrite an existing one.
2. Run `npm run resize-images`.
3. Write the `alt` text for the entry in `src/_data/images.json`.
4. Add the filename to the right list under `sets`.

Steps 3 and 4 are enforced, not suggested: the build **fails** if any image
has empty or duplicated alt text, or belongs to no set. Alt text is the only
description these works have — there are no titles, dates or media on
record — so it is written by a person looking at the image, never generated
and never defaulted to a placeholder.

## URLs and SEO

Every real URL the site serves is declared once, in **`src/_data/routes.js`**.
That one file supplies the nav links, each page's `<title>`, meta
description, canonical link and Open Graph/Twitter tags, the `sitemap.xml`
entries, and the redirect stubs. Nothing about a route is typed twice, and
adding a page means adding a row there.

Pages are served at directory URLs — `/gallery/`, `/bio/`, `/events/`,
`/contact/` — with `/` for the homepage. The pre-Eleventy `.html` URLs
(`/bio.html` and friends) still resolve: `src/redirects.njk` emits a small
stub at each one carrying a canonical link to the new URL, an instant meta
refresh, and a visible fallback link. GitHub Pages serves static files only
and cannot issue a real 301, so this is the closest available substitute.
The stubs and the directory URLs are a single change and must never be
separated — without the stubs, every inbound link to an old URL 404s.

`gallery1.html` and `header.html` were dead files and deliberately 404.

### The build assertion

`npm run build` fails if the built site and the route registry disagree.
After Eleventy finishes, `scripts/assert-seo.js` reads `_site/` back off
disk and checks that:

- `sitemap.xml` lists exactly the registry's routes, absolute, and no others
- each page's canonical link and `og:url` match its registry path exactly,
  trailing slash included
- a redirect stub exists at every legacy path and points at the right route
- no page ships an empty `content=""` or `href=""`, an empty `<title>`, a
  missing canonical, or a missing `lang`
- `robots.txt` names the sitemap
- the share image is really the size `site.json` advertises

This is the part worth keeping. SEO breakage is silent — a canonical that
says `/bio` where the sitemap says `/bio/` looks fine in a browser and is
invisible until rankings move months later. Fix whichever side is wrong;
do not relax the check.

### Icons and the share image

`src/icon.svg` is the single source for the site mark.
`scripts/generate-icons.mjs` rasterises it into `favicon.ico` and
`apple-touch-icon.png`, and crops `originals/0.jpg` into the 1200×630
`og-image.jpg`; Eleventy passes the SVG itself through as `/favicon.svg`.
None of the four are committed — they are build output under
`generated/site/`, like the image derivatives. Edit the SVG and all three
icons follow.

### Structured data

JSON-LD only, and only two types: `WebSite` on `/` and `Person` on `/bio/`,
both in `src/_data/structuredData.js`, every field copied from the bio and
contact pages.

There is deliberately **no `VisualArtwork` markup**, and none should be
added. It is only worth emitting with a medium, surface or date, and no
per-work metadata exists for any of the 33 works — inventing one to satisfy
a schema would be publishing a false claim about someone's art.

## Deploy

Deployment is automatic. Every push to `main` runs
`.github/workflows/deploy-pages.yml`, which builds the site and publishes
`_site/` to GitHub Pages via the Actions deployment flow. The workflow
also has a `workflow_dispatch` trigger, so a manual run is available from
Actions → "Deploy to GitHub Pages" → Run workflow on `main` — use this
when you need to redeploy without a new commit, e.g. after changing Pages
settings. There is no `CNAME` file in this repo — the custom domain
(`sckerk.com`) is configured in the repo's Pages settings, not in source.

Every pull request into `main` runs
`.github/workflows/pull-request-ci.yml` (job name `validate`), which
installs, lints, and builds the site the same way CI will build it for
deploy.

## Hosting

- Canonical URL: `https://sckerk.com` (bare apex). `www.sckerk.com` and
  `sckerk.github.io` both redirect here.
- DNS is delegated to Cloudflare, kept DNS-only (not proxied) so GitHub
  Pages can manage its own TLS certificate.
- Registrar: GoDaddy.
