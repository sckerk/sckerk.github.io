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

The site is raw HTML/CSS/JS served from the repo root — no build step, no
framework. An Eleventy rewrite (static site generator, Nunjucks templates)
is in progress on a feature branch; once it merges this section and the
commands below will change. See `CLAUDE.md` for what's landing.

## Requirements

- Node, version pinned in `.nvmrc` (`nvm use`)
- Python 3 (used only for the local dev server)

## Run locally

```
npm run dev
```

Serves the repo root as raw HTML at http://localhost:8080. No build, no
live reload.

## Build

```
npm run build
```

Runs `scripts/build.sh`, which stages a deployable copy of the site at
`_site/` (HTML files plus `css/`, `fonts/`, `img/`, `js/`). This is a
temporary shim needed only because GitHub Actions Pages deploys require a
directory artifact — it goes away once Eleventy lands and produces
`_site/` itself.

There is no lint step worth running yet: `npm run lint` is a placeholder
that always passes.

## Deploy

Deployment is automatic. Every push to `main` runs
`.github/workflows/deploy-pages.yml`, which builds the site and publishes
`_site/` to GitHub Pages via the Actions deployment flow. There is no
manual deploy step and no `CNAME` file in this repo — the custom domain
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
