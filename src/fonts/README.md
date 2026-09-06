# Self-hosted webfonts

Orbitron (headings) and Oswald (body) are served from this origin rather than
from `fonts.gstatic.com`. YEO-141 made the switch so the site has no
third-party runtime origin left except the Cloudflare Web Analytics beacon:
no visitor's IP reaches Google, no DNS lookup and TLS handshake to a second
host sits in the critical path, and `font-src 'self'` in the
Content-Security-Policy can stay tight.

These are **not** the FontAwesome files that used to live in a root `fonts/`
directory. Nothing on the site ever referenced those; YEO-136 deleted them.

## What is here

| File                         | Family   | Weight | Subset    |
| ---------------------------- | -------- | ------ | --------- |
| `orbitron-400-latin.woff2`   | Orbitron | 400    | latin     |
| `oswald-400-latin.woff2`     | Oswald   | 400    | latin     |
| `oswald-400-latin-ext.woff2` | Oswald   | 400    | latin-ext |

WOFF2 only. Every browser that satisfies `package.json`'s support target
handles it, so a WOFF or TTF fallback would be bytes nobody downloads.

## Why only weight 400

`style.css` asks for `font-weight: 300` in several places, but the Google
Fonts request this replaced (`?family=Orbitron|Oswald`, the legacy v1 API)
only ever delivered the 400 face of each family. Those 300 rules therefore
rendered at 400 already — browsers pick the nearest available weight and do
not synthesise a _lighter_ face. Shipping 400 alone keeps the rendering
byte-identical to what the site served before. Adding a real 300 would be a
visual change, which is out of scope here; see the "settled design
constraints" section of `CLAUDE.md`.

## Why these subsets

Orbitron v35 publishes a single `latin` subset, so there is nothing else to
take. Oswald also publishes `cyrillic`, `cyrillic-ext` and `vietnamese`;
the site's copy is English plus Traditional Chinese, and Oswald has no CJK
coverage in any case (郭 falls through to the system stack, as it did
before). Those three subsets are deliberately not committed. `latin-ext` is
kept because event listings name European cities and galleries.

The `unicode-range` descriptors in `global.css` are copied from Google's own
stylesheet, so a visitor whose page contains no `latin-ext` codepoint never
downloads that file.

## Provenance and licence

Both families are licensed under the SIL Open Font License 1.1, which permits
redistribution — including bundling with a website — provided the licence
travels with the fonts and they are not sold on their own.

- Orbitron: <https://fonts.google.com/specimen/Orbitron> — © The Orbitron
  Project Authors
- Oswald: <https://fonts.google.com/specimen/Oswald> — © The Oswald Project
  Authors
- Licence text: <https://openfontlicense.org/open-font-license-official-text/>

Files were downloaded from the URLs in the `css2` API response for
`family=Orbitron:wght@400&family=Oswald:wght@400&display=swap` and committed
unmodified. To refresh them, re-request that stylesheet with a WOFF2-capable
`User-Agent`, download the `latin` and `latin-ext` `src` URLs, and re-copy the
matching `unicode-range` values into `global.css` — the two must stay in step
or glyphs silently fall back to the system font.
