# Verificación — StudySpace, fase 3

15 de octubre de 2026. Mismo repositorio y URL de GitHub Pages.

## Automatizadas

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

**Producción:** TypeScript estricto y Vite compilan. `npm run preview:html && npm run test:production` ejecuta el bundle compilado y recorre ocho rutas en JSDOM sin errores. Vite advierte que el bundle principal supera 650 kB sin comprimir; gzip ronda 280 kB. No impide desplegar; una división del bundle se puede evaluar después de validar las integraciones reales.

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

- Un solo espacio personal por cuenta, sin calendarios compartidos ni perfiles adicionales.
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
