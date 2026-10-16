# Verificación · Fase 4 (rama de revisión, sin publicar)

Validación final acotada del PR #1: [casos, correcciones y pasos manuales](docs/VALIDACION-PR1.md).

Resultados obtenidos sobre la propuesta de fase 4. Los registros de fases anteriores se conservan debajo como historial, no como descripción del estado actual.

| Comprobación                | Resultado                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Instalación limpia `npm ci` | Aprobada                                                                                                     |
| Árbol `npm ls --all`        | Aprobado, sin dependencias inválidas                                                                         |
| `npm test`                  | 119/119 pruebas, 18 archivos                                                                                 |
| `npm run test:database`     | 14 comprobaciones académicas + 66 de calendario, PGlite aislado                                              |
| `npx tsc --noEmit`          | Aprobada                                                                                                     |
| `npm run build`             | Aprobada                                                                                                     |
| `npm run preview:html`      | Aprobada, HTML autónomo de revisión                                                                          |
| `npm run test:production`   | Aprobada: iconos, tamaños, manifiesto, rutas bajo `/studyspace/`, ocho secciones y vista compartida en JSDOM |
| `npm audit`                 | 0 vulnerabilidades reportadas                                                                                |
| `npm audit --omit=dev`      | 0 vulnerabilidades reportadas                                                                                |
| `git diff --check`          | Aprobada                                                                                                     |

Regresiones permanentes: renovación y recuperación de sesión, cambio de UUID, respuestas antiguas, sujeto firmado de JWT, credencial fijada y cancelación de RPC, dos pestañas y recuperación del bloqueo, formularios concurrentes, conexión perdida durante consultas compartidas, reorganización de materiales, perfil Catalina, límites de fechas, paneles de tareas, paginación y reintento de carga de páginas.

JavaScript inicial: 793.94 kB / 232.29 kB gzip frente a 996.10 kB / 292.02 kB gzip de la versión auditada (aproximadamente 20 % menos). Es el archivo inicial, no la suma de todos los módulos. CSS: 91.25 kB / 19.10 kB gzip. Los módulos secundarios se descargan al visitar sus páginas.

Advertencias que permanecen:

- Vite: `Some chunks are larger than 650 kB after minification.` El archivo inicial continúa sobre ese umbral; no se elevó el umbral para ocultarlo.
- `whatwg-encoding@3.1.1` aparece deprecado como dependencia de desarrollo de JSDOM. No produjo fallos y no forma parte de la aplicación publicada.
- El entorno de ejecución emite `Unknown env config "http-proxy"`. Es configuración del entorno, no una variable añadida al proyecto.

Vitest se actualizó de 3.2.7 a 4.1.11 compatible con Node 22. Se retiró Framer Motion después de reemplazar la única transición que lo utilizaba por CSS. Se reconciliaron las versiones declaradas de dos entradas del lock con sus tarballs originales verificados (`jsesc` y `@csstools/css-color-parser`), sin alterar sus URL ni integridad; una nueva instalación limpia y `npm ls --all` confirmaron un árbol válido.

## Límites de verificación

No se realizaron escrituras en Supabase de producción, cambios SQL/RLS, cuentas nuevas, invitaciones reales, autorizaciones escolares ni pruebas físicas entre dispositivos. El esquema académico sigue siendo 3. Las pruebas SQL no son cuentas reales y JSDOM no valida diseño visual.

La previsualización administrada requiere una habilidad de control de navegador que no está disponible en este entorno. Quedan pendientes capturas comparativas, revisión visual a 390/320 px y escritorio, y comprobación del favicon en una pestaña. No se afirma validación en un teléfono físico ni lector de pantalla. Revisar esos puntos antes de autorizar merge y publicación.

La disponibilidad del favicon en Google depende del rastreo y de la regla por hostname; no está garantizada. Ver docs/FASE4.md.

---

# Registro histórico de fases anteriores

# Verificación — StudySpace 3.1, cuentas y calendario compartido

15 de octubre de 2026. Mismo repositorio y URL de GitHub Pages.

## Ampliación de cuentas: resultados y alcance

**84 pruebas de aplicación en 11 archivos**, con Vitest/Testing Library/JSDOM. Se conservan los recorridos anteriores y se añaden incorporación con diez cursos, reintento idempotente de inicialización, copia local asociada al propietario, cierre de sesión durante una consulta tardía, cancelación de respuesta OAuth de otra cuenta, calendario combinado, filtros, detalles de solo lectura, invitaciones, revocación y ocultación sin conexión. También se comprueban conversión de zonas, rechazo de campos privados y conservación de privacidad al regenerar sesiones.

**SQL/PGlite:** 14 comprobaciones del esquema anterior y **66 de calendario compartido**, con tres identidades de prueba aisladas y un rol anónimo. Se ejecutan las migraciones 001/002 y la reversión 002. Se comprueba que los estados académicos originales permanecen idénticos, que una tercera cuenta no acepta ni accede a invitaciones ajenas, que los datos privados no salen del servidor, que disponibilidad no revela título/curso/tipo, que no salen notas, URLs de Classroom ni estados de entrega, que no se duplican tareas/sesiones y que actualizar/revocar se refleja en consultas posteriores. Las 19 tablas tienen RLS; las tres nuevas además deniegan acceso directo a los clientes.

| Solicitud                   | Evidencia ejecutada                                                                                                           | Pendiente real                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Incorporar a Catalina       | Cuenta vacía, diez cursos exactos, sin Física/Química/AP ni actividades; reintentos con mismos IDs                            | Registro con su email real y SMTP/autorización               |
| Conservar a Fabrizio        | SQL antes/después/rollback idéntico, pruebas de carga/migración y cursos existentes                                           | Exportar/comprobar los datos reales de su navegador/proyecto |
| Cuentas aisladas            | RLS con tres identidades, FKs por propietario, caché por cuenta, bloqueo de copia local ajena, respuestas tardías descartadas | Login/logout real en ambos dispositivos                      |
| Invitación y consentimiento | Crear/repetir, aceptación por destinatario verificado, rechazo de tercero, vencimiento, cancelación y revocación              | Crear y aceptar la invitación real                           |
| Calendario combinado        | Filtros de propietario, vistas, etiqueta/nombre y color separados del curso, modal sin edición ajena                          | Revisión visual real y consulta entre dos dispositivos       |
| Privacidad                  | Proyección SQL explícita y pruebas de ausencia de datos privados; cliente rechaza payloads extra                              | Aplicar 002 al proyecto real y repetir controles allí        |
| Actualización               | Datos SQL actuales tras cambio de fecha/revocación; hooks de consulta, foco y desconexión                                     | Comprobar latencia real de red y foco en ambos dispositivos  |
| Google individual           | Tokens borrados al cambiar de cuenta; respuesta OAuth tardía rechazada; regresiones readonly/Picker                           | Consentimiento real de cada cuenta escolar/Drive             |
| Planes y estudio            | Suite de temarios, presupuesto, sesiones/Pomodoro/repasos y privacidad de regeneración                                        | Recorrido de uso personal con datos reales                   |

No se ejecutó SQL en el proyecto del usuario ni se creó una cuenta real de Catalina. No se inventaron credenciales. Las conexiones reales de fase 3 siguen pendientes si el propietario aún no las configuró. La nueva migración es aditiva y no permite avanzar sobre una aplicación SQL fallida: la interfaz muestra la configuración pendiente.

La actualización compartida usa consultas cada 30 segundos con página visible, al recuperar el foco y con el botón Actualizar; **no usa Realtime**. Las revocaciones bloquean consultas futuras en el servidor. No se cachean datos ajenos offline ni se incluyen en JSON personal. La revisión visual real continúa pendiente por falta de la herramienta de navegador requerida en este entorno.

[Guía de dos cuentas y migración segura](docs/DOS-CUENTAS.md)

## Evidencia conservada de la fase 3

### Automatizadas de la entrega anterior

**65 pruebas Vitest / Testing Library / JSDOM** en nueve archivos. Incluyen las 41 pruebas de fases 1/2, ocho de esquema/Biblioteca/Classroom, cinco recorridos de Biblioteca/colores/calendario, seis de estado de nube con API sustituida y cinco de adaptadores Google con SDK/red sustituidos.

| Área                  | Comprobación ejecutada                                                                                                                                                                                                                        | Alcance                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Regresión fases 1/2   | Tareas CRUD/estados/filtros/Kanban, cursos/archivo/eliminación, calendario y actividades, búsqueda, JSON, temarios, dominio, planes, presupuesto compartido, conflictos, reprogramación, sesiones, recuperación de tiempo, Pomodoro y repasos | DOM y funciones reales locales                    |
| Paleta                | 20 valores únicos; hexadecimal de 3/6 dígitos y rechazo de valores inválidos                                                                                                                                                                  | Unitarias                                         |
| Colores               | Cambio hexadecimal, preview inmediato, persistencia y recarga; color de curso en tarea de calendario                                                                                                                                          | Recorrido DOM                                     |
| Migración local       | Lectura de esquemas 1/2, conservación de IDs/entidades, respaldo original byte por byte y protección ante cuota/corrupción                                                                                                                    | localStorage de pruebas; no navegador del usuario |
| Biblioteca            | Crear carpetas/subcarpetas, renombrar, cambiar icono/color, heredar curso al añadir referencia, etiquetas, búsqueda, lista, mover documento, abrir enlace original, eliminar jerarquía conservando documentos                                 | Recorrido DOM y modelo                            |
| Integridad            | Jerarquías cíclicas, referencias inexistentes, duplicados, enlaces javascript y secretos administrativos rechazados                                                                                                                           | Validación local                                  |
| Búsqueda global       | Resultados agrupados y navegación al documento correcto                                                                                                                                                                                       | Recorrido DOM                                     |
| Classroom             | Conversión UTC/Lima con cambio de día, tarea sin fecha, cinco sincronizaciones sin duplicados, materiales, actualización remota y conservación de notas/prioridad/estimación/estado y descripción personal                                    | Datos de API controlados                          |
| Classroom/calendario  | Una tarea importada aparece una sola vez, conserva color y abre el origen; entrega escolar separada del estado personal                                                                                                                       | Recorrido DOM con importación local controlada    |
| Classroom/planes      | Cambio de entrega avisa al plan y no altera sesiones completadas                                                                                                                                                                              | Funciones reales, datos controlados               |
| Nube                  | Guardado verificado, conservación del espacio local, cierre de sesión, conflicto de revisión, caché autenticada, bloqueo offline, migración, reintento con el mismo ID y recuperación de pendientes tras recarga                              | API Supabase sustituida; no servicio remoto       |
| Google                | Scope drive.file separado, autorización parcial rechazada, tokens fuera de localStorage, paginación, consultas solo GET, 401/403 y selección Picker con metadatos de Drive                                                                    | GIS/Picker/red sustituidos                        |
| Configuración inicial | Botones de conexión no autorizada deshabilitados y sin estado conectado inventado                                                                                                                                                             | DOM                                               |

**SQL/PostgreSQL local:** `npm run test:database` ejecuta la migración completa en PGlite. Comprueba roundtrip relacional/orden, revisión y reintento idempotente, detección de ciclos con rollback, aislamiento de dos usuarios, rechazo de escritura ajena y FK entre propietarios, RLS forzada en las 16 tablas y denegación anónima. No sustituye aplicar y comprobar las políticas en el proyecto Supabase real.

**Producción:** TypeScript estricto y Vite compilan. `npm run preview:html && npm run test:production` ejecuta el bundle compilado y recorre ocho rutas en JSDOM sin errores. Vite advierte que el bundle principal supera 650 kB sin comprimir; gzip ronda 292 kB. No impide desplegar; una división del bundle se puede evaluar después de validar las integraciones reales.

GitHub Actions ejecuta la suite, SQL local, compilación y smoke antes de desplegar. La publicación solo se confirma cuando terminan `build` y `deploy` y el HTML/JS/CSS públicos coinciden con la compilación local.

## Pendientes de autorización externa

| Servicio          | Implementación disponible                                                                                     | Comprobación real pendiente                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase          | SQL/RLS, OTP, RPC, caché por cuenta, estados, control de revisiones, migración/recibos e integridad           | Crear proyecto, ejecutar SQL, configurar email y clave pública, iniciar/cerrar sesión real, probar persistencia y dos dispositivos, repetir controles RLS en ese proyecto |
| Drive             | GIS + Picker + Drive API, referencias seleccionadas, curso/tema/carpetas, apertura y desconexión              | Configurar Cloud/OAuth/key/origen, consentimiento real, Picker con archivos propios, acceso permitido y revocación                                                        |
| Classroom         | Selección/vínculos, consultas readonly, importación y actualización idempotente, materiales, estados y planes | Habilitar API/scopes, autorización escolar o del administrador, consultar cursos reales y comprobar importación/entregas/cambios reales                                   |
| Datos del usuario | Asistente de preview/exportación/importación, validación y copias locales                                     | No se accedió a localStorage del navegador personal ni se migraron sus registros                                                                                          |

No se afirma haber creado proyectos externos, recibido permisos escolares, enviado emails de acceso ni completado esas conexiones.

## Manual y visual

La revisión de código y configuración se realizó en el entorno de desarrollo. **No se realizó una inspección visual con navegador real**: faltó la herramienta de navegador requerida por el entorno. No hay capturas reales de Biblioteca/Integraciones. Los breakpoints responsive están implementados y las rutas se ejecutan en DOM; la apariencia y usabilidad en móvil/escritorio requieren revisión visual del usuario. No se generaron imágenes para simular capturas.

## Límites prácticos

- Un espacio personal por cuenta autenticada. El calendario compartido de 3.1 requiere vinculación y visibilidad explícitas; no hay acceso a perfiles sin autenticarse.
- Sesiones y tokens en memoria: recargar requiere iniciar sesión/autorizar nuevamente. La caché académica queda separada por cuenta y no se muestra antes de autenticar.
- Edición offline en nube no implementada: solo consulta de la página ya abierta. Los guardados que pierden conexión se conservan para reintento con revisión original. No hay PWA/service worker ni sincronización cerrando la aplicación.
- Un conflicto exige exportar/revisar y cargar explícitamente la nube. No hay combinación automática ni sobrescritura silenciosa de la revisión más reciente.
- El temporizador se debe usar en un dispositivo a la vez; se guarda una recuperación pausada en la nube y puede perder los últimos segundos de un cierre abrupto.
- Las importaciones JSON y restablecimiento reemplazan el espacio activo, incluida su nube si está activa; requieren confirmación. El espacio local original y las copias descargadas permanecen separados.
- Los documentos privados se abren en su origen con los permisos de la cuenta. No hay preview privado incrustado garantizado. Eliminar/mover referencias nunca llama a borrar/mover archivos de Drive.
- Classroom se consulta manualmente, sin entregas ni actualización constante. Una tarea eliminada de StudySpace puede volver a importarse al sincronizar. El estado de entrega no cambia el estado personal.
- Planificación y repasos conservan los límites documentados de fase 2: heurística determinista, resolución de cinco minutos, horizonte de 730 días y reserva configurable para actividades sin duración. El dominio requiere autoevaluación.

[Configuración paso a paso](docs/CONFIGURACION.md) · [Aplicación](https://fabrizio-rda.github.io/studyspace/) · [Código](https://github.com/fabrizio-rda/studyspace)

No se han iniciado las fases 4 ni 5. Antes de la fase 4 conviene cerrar la configuración externa, comprobar dos dispositivos y revisar el diseño real en móvil.
