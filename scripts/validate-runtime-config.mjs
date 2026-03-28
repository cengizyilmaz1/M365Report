import fs from "node:fs";
import path from "node:path";
import { hasPlaceholders, normalizeConfig, parseRuntimeConfig } from "./runtime-config.mjs";

const [, , inputPath = "./public/runtime-config.json", mode] = process.argv;
const strict = mode === "--strict";
const resolvedPath = path.resolve(process.cwd(), inputPath);

const fileContent = fs.readFileSync(resolvedPath, "utf8");
const parsedJson = JSON.parse(fileContent);
const config = normalizeConfig(parseRuntimeConfig(parsedJson));

if (strict && hasPlaceholders(config)) {
  throw new Error(`Runtime config at ${resolvedPath} still contains placeholder values.`);
}

console.log(`Runtime config validated: ${resolvedPath}`);
