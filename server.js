const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 3000;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);

  if (urlPath === "/") urlPath = "/index.html";

  let filePath;

  if (urlPath.startsWith("/assets/")) {
    filePath = path.join(
      __dirname,
      "public",
      urlPath
    );
  } else {
    filePath = path.join(__dirname, urlPath);
  }

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      return fs.readFile(indexPath, (e, data) => {
        if (e) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8"
        });
        res.end(data);
      });
    }

    fs.readFile(filePath, (e, data) => {
      if (e) {
        res.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8"
        });
        return res.end("Not found");
      }

      const ext = path.extname(filePath).toLowerCase();

      res.writeHead(200, {
        "Content-Type": mime[ext] || "application/octet-stream"
      });

      res.end(data);
    });
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Child Care Foundation website running on port ${port}`);
});
