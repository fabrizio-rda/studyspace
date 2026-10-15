# StudySpace · Fase 1

Una aplicación académica personal, estática y en español. Paleta beige con morado, rosado, melocotón y azul pastel; diseño inspirado en la composición de FocusMate, con identidad y gráficos propios.

## Estado de la entrega

La implementación de la fase 1 y el flujo de despliegue están preparados en [fabrizio-rda/studyspace](https://github.com/fabrizio-rda/studyspace). La publicación se verifica en GitHub Actions: los trabajos `build` y `deploy` deben finalizar correctamente y el segundo debe devolver la URL del sitio. La revisión visual con navegador y las capturas de escritorio/móvil siguen pendientes porque el entorno de construcción no ofrece la herramienta de navegador requerida.

## Usar sin instalar programas

Una vez desplegado, abre la URL que entregue el trabajo `deploy` de GitHub Actions en Chrome. No necesitas instalar Node, Git, VS Code ni una aplicación. Puedes guardar la dirección como marcador. La app no incluye todavía instalación PWA ni funcionamiento offline garantizado.

1. En **Mis tareas**, crea una tarea y elige curso, tipo, fecha, hora opcional, prioridad y estado.
2. Haz clic en su título o en el lápiz para editarla; usa la casilla para completarla.
3. En **Calendario**, cambia entre Mes, Semana y Día. Pulsa una fecha para crear una actividad independiente; las tareas con fecha aparecen automáticamente.
4. Abre **Mis cursos** para ver y personalizar los once cursos iniciales. Las flechas cambian su orden. Archivar conserva todo. Eliminar un curso conserva sus tareas y actividades como «Sin curso» y requiere confirmación.
5. En **Configuración**, cambia tu nombre y zona horaria, activa la vista compacta y exporta una copia JSON con frecuencia. Importar y restablecer requieren confirmación.

**Los datos viven en este navegador y dispositivo.** No se sincronizan con otros. Borrar los datos del sitio, usar navegación privada o cambiar de origen puede hacer que no estén disponibles. La exportación incluye cursos, tareas, eventos, preferencias y versión de esquema. Los datos personales no se suben al repositorio al utilizar la aplicación. Google Fonts sirve únicamente la fuente; si no carga, se usa sans-serif.

## Publicación en GitHub Pages

### Paso que necesita el titular de la cuenta

1. El repositorio público `fabrizio-rda/studyspace` ya está creado y la conexión tiene acceso.
2. En el repositorio, selecciona **Settings → Pages → Build and deployment → Source → GitHub Actions** si todavía no está habilitado.
3. Abre **Actions → Validate and deploy StudySpace → Run workflow → main → Run workflow** si no se ejecuta automáticamente.
4. Espera a que `build` y `deploy` finalicen en verde. Usa la URL que devuelve `deploy`; no se considera verificada antes de ese resultado.

El flujo ya realiza `npm ci`, pruebas, compilación y despliegue. No necesita secretos personales. `pages: write` y `id-token: write` se conceden al token temporal del flujo. Si GitHub bloquea los workflows, revisa **Settings → Actions → General → Actions permissions** y permite las acciones oficiales usadas por este proyecto. Si la conexión no tiene permiso para escribir archivos en `.github/workflows`, el titular deberá crear ese archivo desde la interfaz web o conceder ese permiso a la aplicación conectada.

`base: './'` hace que Vite genere rutas de recursos relativas válidas bajo el subdirectorio del repositorio. `HashRouter` mantiene la navegación y la recarga sin reglas de redirección. El artefacto desplegado es `dist/`.

### Revisar el HTML autónomo

`StudySpace.html` contiene la misma aplicación compilada, con CSS y JavaScript integrados. Descárgalo y ábrelo en Chrome para revisar el diseño y las funciones sin instalar programas. El almacenamiento de un archivo local depende de Chrome y es independiente de la futura URL pública: exporta/importa JSON si quieres trasladar datos. Esta copia no sustituye el despliegue de GitHub Pages ni constituye una captura de pantalla. Se reproduce con `npm run build` y `npm run preview:html`.

### Alternativa con archivos

El ZIP de entrega incluye `studyspace/` con fuentes, dependencias bloqueadas y workflow, y `sitio-compilado/` con el resultado de producción. No incluye `node_modules`, datos personales, credenciales ni la imagen de referencia. No subas el ZIP como único archivo del repositorio: GitHub no descomprime proyectos automáticamente. La vía más simple con el complemento es crear el repositorio inicializado y dejar que el asistente incorpore las fuentes.

## Funciones de esta fase

- Dashboard con saludo y fecha locales, tareas de hoy, calendario compacto interactivo, evaluaciones y métricas calculadas con tareas reales.
- Navegación con cinco secciones, búsqueda global, menú contraíble, menú móvil y formularios en diálogos nativos con foco y Escape.
- Once cursos sin tareas ni calificaciones de demostración; creación, edición, descripción, colores, iconos, orden, archivo y eliminación sin perder actividades.
- Tareas con CRUD, descripción, curso, cinco tipos, prioridad, estados, creación y finalización; lista, Kanban por estados, filtros, texto, orden por fecha, hoy, próximos siete días y vencidas.
- Calendario mensual, semanal y diario, navegación, filtro por curso, creación/edición/eliminación de actividades independientes y visualización de tareas sin duplicación.
- Persistencia `localStorage`, validación de esquema y referencias con Zod, identificadores estables, errores de escritura, bloqueo de sobrescritura de datos corruptos y actualización entre pestañas.
- Copias JSON validadas, confirmación de reemplazo, exportación de recuperación y restablecimiento confirmado.
- Preferencias de nombre, zona horaria, vista compacta, vista de tareas y cursos archivados.

El temporizador y el plan de estudio son estados futuros claramente identificados, sin botones que simulen funciones. Las fases 2–5 no están implementadas.

## Fechas y zona horaria

La preferencia inicial es `America/Lima`. Las fechas de día completo se guardan como `YYYY-MM-DD` y las horas opcionales como `HH:mm`, separadas de los instantes UTC de creación/finalización. Nunca se usa `toISOString()` para convertir la fecha de vencimiento. Cambiar la zona horaria afecta «hoy», el saludo y las métricas de finalización; no convierte las horas civiles ya ingresadas de tareas y eventos. Esa limitación se explica también en la interfaz.

## Arquitectura

```text
src/
  models/schema.ts          Tipos, validación, versión y cursos iniciales
  services/storage.ts       Lectura/escritura y copias JSON
  services/store.tsx        Estado compartido y operaciones de dominio
  services/dates.ts         Fechas civiles y zona horaria
  components/               Formularios, calendario compacto y elementos comunes
  pages/                    Inicio, tareas, cursos, calendario y configuración
  App.tsx                   Navegación, búsqueda global y composición
  styles.css                Sistema visual y adaptación responsive
.github/workflows/deploy.yml  Validación y publicación en Pages
```

La capa de almacenamiento se puede sustituir en la fase 3 manteniendo las entidades. El esquema 1 se valida al leer/importar; una versión desconocida se rechaza y conserva el original hasta implementar su migración. Cada modificación guarda una instantánea completa validada. Entre pestañas se recarga el estado más reciente antes de escribir y se escucha `storage`; no existe resolución de edición simultánea y la última escritura puede prevalecer.

## Desarrollo en un entorno en la nube

React · TypeScript · Vite · Tailwind CSS · Lucide React · Framer Motion · React Day Picker · date-fns · Zod · React Router.

```sh
npm ci
npm test
npm run build
npm run preview:html
npm run test:production
```

`npm run dev` sirve el entorno de desarrollo cuando el entorno dispone de vista previa. Esos comandos son para el desarrollador o GitHub Actions; el usuario final solo necesita Chrome.

## Verificación

Consulta `VERIFICACION.md` para el alcance y los resultados reales de las pruebas. Las pruebas de interfaz usan JSDOM; no sustituyen una inspección visual en navegador. Antes de considerar la fase completamente cerrada, se debe comprobar el despliegue público, los recursos, la recarga y el diseño real en escritorio y móvil.
