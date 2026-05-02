import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const skipped = new Set(["node_modules", "dist", ".git", "server/data", "server/uploads"]);
const extensions = new Set([".js", ".jsx", ".json", ".md", ".css", ".yml", ".yaml"]);
const problems = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(root, fullPath);
      if ([...skipped].some((name) => rel === name || rel.startsWith(`${name}${path.sep}`))) return;
      if (entry.isDirectory()) {
        await walk(fullPath);
        return;
      }
      if (!extensions.has(path.extname(entry.name))) return;
      const text = await readFile(fullPath, "utf8");
      if (/\t/.test(text)) problems.push(`${rel}: contains tabs`);
      if (/[ \t]$/m.test(text)) problems.push(`${rel}: contains trailing whitespace`);
      if (!text.endsWith("\n")) problems.push(`${rel}: missing final newline`);
      if (rel.includes(".env")) problems.push(`${rel}: env files must not be committed`);
    })
  );
}

await walk(root);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("Lint checks passed");
