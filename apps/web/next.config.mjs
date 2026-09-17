import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const contents = fs.readFileSync(envPath, "utf8");
  for (const [key, value] of Object.entries(parseEnv(contents))) process.env[key] ??= value;
}

const webConfigDir = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile(path.resolve(webConfigDir, "../../.env"));

/** @type {import('next').NextConfig} */

const nextConfig = {
  typedRoutes: true
};

export default nextConfig;
