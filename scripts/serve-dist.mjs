import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "4321");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"]
]);

async function resolveFile(requestPath) {
  const normalizedPath = decodeURIComponent(requestPath.split("?")[0]);
  const candidatePath = path.join(distDir, normalizedPath);

  try {
    const candidateStats = await stat(candidatePath);
    if (candidateStats.isDirectory()) {
      return path.join(candidatePath, "index.html");
    }

    return candidatePath;
  } catch {
    const directoryIndex = path.join(distDir, normalizedPath, "index.html");
    try {
      await access(directoryIndex);
      return directoryIndex;
    } catch {
      return path.join(distDir, "404.html");
    }
  }
}

createServer(async (request, response) => {
  const filePath = await resolveFile(request.url ?? "/");
  const extension = path.extname(filePath);
  const contentType = contentTypes.get(extension) ?? "application/octet-stream";
  const statusCode = filePath.endsWith("404.html") ? 404 : 200;

  response.writeHead(statusCode, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Serving dist at http://${host}:${port}`);
});
