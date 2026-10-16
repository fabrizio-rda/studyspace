import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
const root = resolve(import.meta.dirname, "..");
// Validate public icon paths under the real GitHub Pages subdirectory.
const production = await readFile(resolve(root, "dist/index.html"), "utf8");
for (const name of [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "apple-touch-icon.png",
  "site.webmanifest",
]) {
  assert(production.includes(`./${name}`), `Ruta relativa del icono: ${name}`);
  assert((await readFile(resolve(root, "dist", name))).length > 0);
  assert.equal(
    new URL(`./${name}`, "https://studyspace.test/studyspace/").pathname,
    `/studyspace/${name}`,
  );
}
for (const [name, size] of [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["favicon-48x48.png", 48],
  ["apple-touch-icon.png", 180],
]) {
  const bytes = await readFile(resolve(root, "dist", name));
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
}
const manifest = JSON.parse(
  await readFile(resolve(root, "dist/site.webmanifest"), "utf8"),
);
for (const icon of manifest.icons)
  assert((await readFile(resolve(root, "dist", icon.src))).length > 0);
console.log(
  "Iconos: formatos, dimensiones, manifiesto y rutas /studyspace/ verificados (sin comprobación visual de pestaña).",
);
const html = await readFile(
  resolve(root, "dist-preview/StudySpace.html"),
  "utf8",
);
assert(
  !/<script[^>]+src=/.test(html),
  "El HTML de revisión debe contener el código de la aplicación.",
);
assert(
  !/href="\.\/assets\//.test(html),
  "El HTML de revisión debe contener el CSS.",
);
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (e) => errors.push(e.message));
virtualConsole.on("error", (e) => errors.push(String(e)));
const dom = new JSDOM(html.replace('<script type="module">', "<script>"), {
  url: "https://studyspace.test/studyspace/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(w) {
    w.scrollTo = () => {};
    w.structuredClone = structuredClone;
    w.matchMedia = () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    });
    w.HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    w.HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  },
});
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await delay(300);
  const w = dom.window;
  assert(
    w.document
      .querySelector("main")
      .textContent.includes("Cursos, tareas y evaluaciones."),
  );
  for (const [route, heading] of [
    ["/tareas", "Mis tareas"],
    ["/cursos", "Mis cursos"],
    ["/calendario", "Mi calendario"],
    ["/configuracion", "Configuración"],
    ["/calendario?compartido=1", "Calendario compartido"],
    ["/biblioteca", "Biblioteca"],
    ["/planes", "Planes de estudio"],
    ["/sesiones", "Sesiones de estudio"],
    ["/", "Cursos, tareas y evaluaciones."],
  ]) {
    w.location.hash = route;
    const deadline = Date.now() + 4000;
    while (
      !w.document.querySelector("main").textContent.includes(heading) &&
      Date.now() < deadline
    )
      await delay(25);
    assert(
      w.document.querySelector("main").textContent.includes(heading),
      `Ruta de producción: ${route}`,
    );
  }
  assert.equal(w.document.querySelectorAll("nav a").length, 8);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "Producción: HTML autónomo, recursos integrados y ocho secciones y la vista compartida ejecutadas en JSDOM sin errores de ejecución. Esto no es una prueba visual de navegador.",
  );
} finally {
  dom.window.close();
}
