import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const copies = [
  ["shared/brand-shell.css", "public/assets/brand-shell.css"]
];

for (const [sourceRelativePath, destinationRelativePath] of copies) {
  const sourcePath = path.join(rootDir, sourceRelativePath);
  const destinationPath = path.join(rootDir, destinationRelativePath);

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath, { force: true });
}

console.log("Shared brand assets synchronized.");
