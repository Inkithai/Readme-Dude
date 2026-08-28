#!/usr/bin/env node
/**
 * Generates src/data/tech-brands.json from simple-icons.
 *
 * Why a build-time script instead of importing simple-icons at runtime:
 * the package exposes one giant barrel (3,453 exports) whose icon objects
 * carry a full SVG path each (~3–5 kB per icon). A curated picker only needs
 * three short strings, so we extract them here and ship ~2 kB instead of
 * pulling brand data into the boot chunk.
 *
 * For icons *inside the generated README* we use the official CDN
 * (https://cdn.simpleicons.org/<slug>/<hex>) — no bundling at all.
 *
 * Usage: node scripts/gen-tech-brands.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as icons from "simple-icons";

const CURATED = [
  // languages
  "typescript", "javascript", "python", "go", "rust", "java", "c", "cpp", "csharp", "php", "ruby", "swift", "kotlin", "dart", "elixir", "haskell", "zig", "lua", "r", "scala", "bash", "powershell", "html5", "css", "sass",
  // runtimes / packages
  "nodedotjs", "bun", "deno", "pypi", "npm", "pnpm", "yarn", "uv", "cargo", "maven", "gradle",
  // frameworks / libraries
  "react", "nextdotjs", "vue", "nuxtdotjs", "svelte", "astro", "angular", "solid", "preact", "tailwindcss", "bootstrap", "materialdesign", "chakraui", "shadcnui", "radixui", "express", "nestjs", "fastify", "django", "flask", "fastapi", "spring", "laravel", "rails", "dotnet", "gin", "actix", "flutter", "reactnative", "electron", "tauri", "threejs", "d3dotjs", "chartdotjs",
  // data
  "postgresql", "mysql", "mariadb", "sqlite", "redis", "mongodb", "supabase", "prisma", "drizzle", "neo4j", "clickhouse", "duckdb", "elasticsearch", "graphql", "apollo", "kafka", "rabbitmq", "minio", "snowflake", "bigquery",
  // infra / devops
  "docker", "kubernetes", "terraform", "ansible", "githubactions", "gitlabci", "circleci", "jenkins", "vercel", "netlify", "cloudflare", "amazons3", "amazonec2", "awslambda", "googlecloud", "azure", "flydotio", "railway", "render", "heroku", "nginx", "traefik", "vite", "vitest", "jest", "playwright", "cypress", "storybook",
  // ml / ai
  "pytorch", "tensorflow", "huggingface", "openai", "anthropic", "ollama", "langchain", "opencv", "scikitlearn", "pandas", "numpy", "matplotlib", "jax",
  // tooling / misc
  "git", "github", "figma", "notion", "obsidian", "neovim", "vscode", "webstorm", "linux", "apple", "android", "applepay", "stripe", "firebase", "sentry", "zustand", "zod", "redux", "tanstack", "socketdotio", "protobuf", "opencv2",
];

/**
 * Brands removed from simple-icons (trademark takedowns) keep their historical
 * slug + colour here. shields.io resolves the logo when it still has it and
 * silently drops the logo parameter when it does not — the badge still renders,
 * so an unknown slug degrades gracefully rather than breaking the README.
 */
const FALLBACK = {
  java: { name: "Java", hex: "007396" },
  c: { name: "C", hex: "A8B9CC" },
  cpp: { name: "C++", hex: "00599C" },
  csharp: { name: "C#", hex: "239120" },
  bash: { name: "Bash", hex: "4EAA25" },
  powershell: { name: "PowerShell", hex: "5391FE" },
  cargo: { name: "Cargo", hex: "000000" },
  maven: { name: "Maven", hex: "C71A36" },
  vue: { name: "Vue", hex: "4FC08D" },
  rails: { name: "Rails", hex: "D30001" },
  reactnative: { name: "React Native", hex: "61DAFB" },
  threejs: { name: "Three.js", hex: "000000" },
  d3dotjs: { name: "D3.js", hex: "F9A03C" },
  apollo: { name: "Apollo GraphQL", hex: "3EED90" },
  kafka: { name: "Kafka", hex: "231F20" },
  bigquery: { name: "BigQuery", hex: "546BFF" },
  gitlabci: { name: "GitLab CI", hex: "FC6D26" },
  amazons3: { name: "Amazon S3", hex: "569A31" },
  amazonec2: { name: "Amazon EC2", hex: "FF9900" },
  awslambda: { name: "AWS Lambda", hex: "FF9900" },
  azure: { name: "Azure", hex: "0078D4" },
  heroku: { name: "Heroku", hex: "430098" },
  traefik: { name: "Traefik", hex: "24A1C1" },
  playwright: { name: "Playwright", hex: "2EAD33" },
  openai: { name: "OpenAI", hex: "412991" },
  matplotlib: { name: "Matplotlib", hex: "11554C" },
  jax: { name: "JAX", hex: "000000" },
  vscode: { name: "VS Code", hex: "007ACC" },
  zustand: { name: "Zustand", hex: "F5D06F" },
  protobuf: { name: "Protocol Buffers", hex: "3E5B74" },
};

const bySlug = new Map();
for (const [key, value] of Object.entries(icons)) {
  if (!key.startsWith("si") || !value || typeof value !== "object") continue;
  const slug = value.slug ?? key.slice(2).toLowerCase();
  if (!bySlug.has(slug)) {
    bySlug.set(slug, { name: value.title, slug, hex: value.hex, slugCamel: key });
  }
}

const out = [];
const missing = [];
for (const slug of CURATED) {
  const found = bySlug.get(slug) ?? (FALLBACK[slug] ? { name: FALLBACK[slug].name, slug, hex: FALLBACK[slug].hex, slugCamel: "" } : undefined);
  if (found) {
    if (!out.some((o) => o.slug === found.slug)) out.push(found);
  } else missing.push(slug);
}
out.sort((a, b) => a.name.localeCompare(b.name));

const here = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(here, "..", "src", "data");
await mkdir(dest, { recursive: true });
await writeFile(path.join(dest, "tech-brands.json"), `${JSON.stringify(out, null, 0)}\n`, "utf8");
console.log(`wrote ${out.length} brands → src/data/tech-brands.json`);
if (missing.length) console.log(`skipped (not in simple-icons): ${missing.join(", ")}`);
