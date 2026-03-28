import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blogDir = path.join(rootDir, "blog");

const child = spawn("bundle", ["exec", "jekyll", "build", "--destination", "../dist/blog"], {
  cwd: blogDir,
  stdio: "inherit",
  shell: process.platform === "win32"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
