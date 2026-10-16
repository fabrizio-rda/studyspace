import { build } from "vite";
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
const bundled = await build({
  logLevel: "error",
  build: {
    write: false,
    rollupOptions: {
      input: resolve(root, "src/main.tsx"),
      output: { format: "iife", inlineDynamicImports: true },
    },
    cssCodeSplit: false,
  },
});
const code = bundled.output.find((file) => file.type === "chunk").code;
const css = await readFile(resolve(root, "dist", style[1]), "utf8");
html = html
  .replace(script[0], "")
  .replace(style[0], () => `<style>${css}</style>`);
for (const match of [
  ...html.matchAll(/href="(\.\/(?:favicon[^" ]+|apple-touch-icon\.png))"/g),
]) {
  const file = match[1];
  const mime = file.endsWith(".ico") ? "image/x-icon" : "image/png";
  const bytes = await readFile(resolve(root, "public", file));
  html = html.replace(
    match[0],
    `href="data:${mime};base64,${bytes.toString("base64")}"`,
  );
}
html = html.replace(/<link[^>]*rel="manifest"[^>]*>/g, "");
html = html.replace(
  "</body>",
  () =>
    `<script type="module">${code.replace(/<\/script/gi, "<\\/script")}</script></body>`,
);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`HTML autónomo preparado: ${output}`);
