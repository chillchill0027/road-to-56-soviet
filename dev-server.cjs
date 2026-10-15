// Dependency-free static preview. Compatible with --host/--port flags.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const flag = (key, fallback) => {
  const i = args.indexOf(key);
  return i >= 0 ? args[i + 1] : fallback;
};
const host = flag("--host", "0.0.0.0");
const port = Number(flag("--port", process.env.PORT || "4173"));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
};
http
  .createServer((req, res) => {
    let file;
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      file = path.resolve(
        __dirname,
        "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
      );
      if (
        !file.startsWith(__dirname + path.sep) ||
        pathname.split("/").some((part) => part.startsWith("."))
      )
        throw new Error();
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    });
  })
  .listen(port, host, () => console.log(`Preview: http://localhost:${port}`));
