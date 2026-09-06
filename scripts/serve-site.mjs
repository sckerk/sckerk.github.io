// A static file server for the built _site/, used by the Lighthouse gate in
// .github/workflows/pull-request-ci.yml and reproducible locally with
// `npm run serve`. It exists so the numbers measured in CI describe the site,
// not the server that happened to be in front of it.
//
// Why not `npx serve` / `npx http-server`:
//
//   * Neither compresses. css/style.css is ~30 KB of plain text, and Lighthouse
//     raises "Enable text compression" once a text resource clears ~1.4 KB with
//     >10% to gain. GitHub Pages *does* gzip text responses, so serving them raw
//     would fail an audit the production site passes and drag the performance
//     score down for a reason that has nothing to do with the site. Thresholds
//     set from that measurement would then be wrong in both directions: too low
//     to catch a real regression, and unrelated to what visitors get.
//   * A one-line `npx` also means a network fetch of an unpinned package on
//     every CI run, inside a job whose whole budget is three minutes.
//
// Deliberately minimal: GET/HEAD only, no directory listings, no range requests,
// no caching headers. It serves a build artifact to a local auditor and is not
// hardened for anything else - do not point it at the internet.
import { createServer } from "node:http";
import { createReadStream, promises as fs } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, normalize, extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "_site");
const port = Number(process.env.PORT ?? process.argv[3] ?? 8080);

// Enough to cover everything the build emits. An unknown extension falls back to
// application/octet-stream, which is visible in a Lighthouse run rather than
// silently mis-served, so a new asset type shows up as a bug and not as a
// mystery score change.
const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
};

// Compress exactly what a real static host compresses: text, never the images
// or the already-Brotli-compressed WOFF2. The 1024-byte floor is the usual one -
// below it gzip's framing can make the response larger than the original.
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".xml", ".txt", ".svg"]);
const MIN_COMPRESS_BYTES = 1024;

function resolvePath(urlPath) {
    // decodeURIComponent throws URIError on a malformed percent-escape - a bare
    // `GET /%E0%A4%A` is enough. Unguarded, that throw escapes the request
    // handler and takes the whole process down, so the Lighthouse job's next
    // request gets a connection reset and the run fails as "no pages audited"
    // rather than as the bad URL it was. Treated as not-found, like any other
    // path that does not name a file.
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath.split("?")[0]);
    } catch {
        return null;
    }

    // normalize() collapses ".." before the prefix check, so a request for
    // /../../etc/passwd cannot escape the root.
    const candidate = normalize(join(root, decoded));
    if (candidate !== root && !candidate.startsWith(root + sep)) return null;
    // Directory URLs are how this site serves every page (/bio/, /gallery/) -
    // see src/_data/routes.js. Pages resolves them to index.html and so must this.
    return decoded.endsWith("/") ? join(candidate, "index.html") : candidate;
}

const server = createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { allow: "GET, HEAD" }).end();
        return;
    }

    const filePath = resolvePath(req.url);
    let stat = filePath && (await fs.stat(filePath).catch(() => null));

    // A bare /bio (no trailing slash) is not a URL this site publishes, but
    // serving it rather than 404ing keeps a hand-typed check from looking like
    // a broken link.
    if (stat?.isDirectory()) {
        const index = join(filePath, "index.html");
        stat = await fs.stat(index).catch(() => null);
        if (stat) return send(req, res, index, stat);
    }

    if (!stat?.isFile()) {
        // The real 404 page, at the status code it is served with in production.
        const notFound = join(root, "404.html");
        const notFoundStat = await fs.stat(notFound).catch(() => null);
        if (notFoundStat) return send(req, res, notFound, notFoundStat, 404);
        res.writeHead(404, { "content-type": "text/plain" }).end("Not found\n");
        return;
    }

    return send(req, res, filePath, stat);
});

async function send(req, res, filePath, stat, status = 200) {
    const ext = extname(filePath).toLowerCase();
    const type = TYPES[ext] ?? "application/octet-stream";
    const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");

    if (acceptsGzip && COMPRESSIBLE.has(ext) && stat.size >= MIN_COMPRESS_BYTES) {
        const body = gzipSync(await fs.readFile(filePath));
        res.writeHead(status, {
            "content-type": type,
            "content-encoding": "gzip",
            "content-length": body.length,
            vary: "Accept-Encoding",
        });
        res.end(req.method === "HEAD" ? undefined : body);
        return;
    }

    res.writeHead(status, {
        "content-type": type,
        "content-length": stat.size,
        vary: "Accept-Encoding",
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(filePath).pipe(res);
}

server.listen(port, "127.0.0.1", () => {
    // CI greps for nothing here - it polls the port - but a human running this
    // by hand needs to be told where it went.
    console.log(`serve-site: ${root} on http://127.0.0.1:${port}/`);
});
