const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../..");
function startServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".png": "image/png",
    ".json": "application/json",
  };
  const server = http.createServer((request, response) => {
    let file;
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      file = path.resolve(
        root,
        "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
      );
      if (
        !file.startsWith(root + path.sep) ||
        pathname.split("/").some((p) => p.startsWith("."))
      )
        throw Error("outside public files");
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    fs.readFile(file, (e, data) => {
      if (e) response.writeHead(404).end("Not found");
      else
        response
          .writeHead(200, {
            "Content-Type":
              mime[path.extname(file)] || "application/octet-stream",
          })
          .end(data);
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }),
    ),
  );
}
module.exports = { startServer };
