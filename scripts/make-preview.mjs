import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const output = resolve(
  process.argv[2] ?? resolve(root, "dist-preview/StudySpace.html"),
);
let html = await readFile(resolve(root, "dist/index.html"), "utf8");
const script = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const style = html.match(/<link[^>]+href="(\.\/assets\/[^\"]+\.css)"[^>]*>/);
if (!script || !style)
  throw new Error(
    "No se encontraron los recursos compilados. Ejecuta npm run build primero.",
  );
const code = await readFile(resolve(root, "dist", script[1]), "utf8");
const css = await readFile(resolve(root, "dist", style[1]), "utf8");
const favicon = await readFile(resolve(root, "public/favicon.svg"), "utf8");
html = html
  .replace(script[0], "")
  .replace(style[0], () => `<style>${css}</style>`)
  .replace(
    'href="./favicon.svg"',
    () => `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`,
  );
html = html.replace(
  "</body>",
  () =>
    `<script type="module">${code.replace(/<\/script/gi, "<\\/script")}</script></body>`,
);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`HTML autónomo preparado: ${output}`);
