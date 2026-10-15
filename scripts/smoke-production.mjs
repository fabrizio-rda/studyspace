import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { JSDOM, VirtualConsole } from "jsdom";
const root = resolve(import.meta.dirname, "..");
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
    ["/biblioteca", "Biblioteca"],
    ["/planes", "Planes de estudio"],
    ["/sesiones", "Sesiones de estudio"],
    ["/", "Cursos, tareas y evaluaciones."],
  ]) {
    w.location.hash = route;
    await delay(400);
    assert(
      w.document.querySelector("main").textContent.includes(heading),
      `Ruta de producción: ${route}`,
    );
  }
  assert.equal(w.document.querySelectorAll("nav a").length, 8);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "Producción: HTML autónomo, recursos integrados y ocho rutas ejecutados en JSDOM sin errores de ejecución. Esto no es una prueba visual de navegador.",
  );
} finally {
  dom.window.close();
}
