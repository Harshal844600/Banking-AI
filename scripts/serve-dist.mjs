import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(projectRoot, "dist");
const clientDir = path.join(distDir, "client");
const serverEntryPath = path.join(distDir, "server", "server.js");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "0.0.0.0";

if (!existsSync(serverEntryPath)) {
  console.error("Build output not found. Run `npm run build` first.");
  process.exit(1);
}

const { default: server } = await import(pathToFileURL(serverEntryPath).href);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".txt", "text/plain; charset=utf-8"],
]);

const isAssetRequest = (urlPath) =>
  urlPath.startsWith("/assets/") || urlPath.startsWith("/favicon");

createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? `${host}:${port}`}`);

    if (isAssetRequest(requestUrl.pathname)) {
      const assetPath = path.join(clientDir, requestUrl.pathname);
      if (!assetPath.startsWith(clientDir) || !existsSync(assetPath)) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      const ext = path.extname(assetPath).toLowerCase();
      res.setHeader("Content-Type", mimeTypes.get(ext) ?? "application/octet-stream");
      res.statusCode = 200;
      res.end(await readFile(assetPath));
      return;
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      } else {
        headers.set(key, value);
      }
    }

    const method = req.method ?? "GET";
    const body =
      method === "GET" || method === "HEAD" ? undefined : Buffer.from(await readRequestBody(req));

    const response = await server.fetch(
      new Request(requestUrl, {
        method,
        headers,
        body,
      }),
      {},
      {},
    );

    res.statusCode = response.status;
    res.statusMessage = response.statusText;
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (method === "HEAD") {
      res.end();
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Internal Server Error");
  }
}).listen(port, host, () => {
  console.log(`Preview server running at http://${host}:${port}`);
});

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
