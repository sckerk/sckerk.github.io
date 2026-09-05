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

Two steps: `npm run resize-images` regenerates `generated/img/` from the
masters in `originals/`, then Eleventy renders `src/` into `_site/`. That
is exactly what CI runs, so a green local build is a real predictor.

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
