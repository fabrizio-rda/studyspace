# StudySpace — verificación de la fase 1

Fecha: 15 de octubre de 2026.

## Resultados observados

| Comprobación                              | Resultado y alcance                                                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript + compilación Vite             | Correcto. `npm run build` genera `dist/` sin errores.                                                                                                                             |
| Pruebas automatizadas                     | 14 pruebas aprobadas en dos archivos con Vitest.                                                                                                                                  |
| Abrir y navegar por la app                | Las cinco rutas se renderizan y responden en JSDOM. También se ejecutó el bundle real de producción.                                                                              |
| Crear, editar, completar una tarea        | Aprobado mediante interacción con formularios y botones. Se comprueban estado y fecha de finalización.                                                                            |
| Persistencia                              | Aprobada al desmontar y volver a montar la app leyendo `localStorage`. No se ha cerrado y reabierto Chrome real.                                                                  |
| Crear un examen y verlo en calendario     | Aprobado. Una entrada mensual y su detalle diario; no se crea un evento duplicado. Vistas Semana y Día verificadas en DOM.                                                        |
| Abrir, crear y editar un curso            | Aprobado. Descripción editable y datos conservados.                                                                                                                               |
| Archivar y eliminar un curso              | Aprobado. Se conserva la tarea asociada y queda sin curso después de confirmar la eliminación.                                                                                    |
| Filtros y Kanban                          | Aprobados: curso, prioridad, estado y texto; cambio de vista.                                                                                                                     |
| Exportar JSON                             | Aprobado: se genera el Blob y se inicia la descarga. El diálogo de descarga real de Chrome no se ha probado.                                                                      |
| Importar JSON                             | Aprobado: esquema válido reemplaza datos tras confirmar; JSON inválido se rechaza; cancelar conserva los datos previos.                                                           |
| Actividades independientes                | Crear, editar y eliminar desde calendario; no se convierten en tareas.                                                                                                            |
| Búsqueda global                           | Encuentra una actividad y abre su editor.                                                                                                                                         |
| Datos corruptos y cuota de almacenamiento | Los datos corruptos no se sobrescriben; la escritura rechazada genera error sin comunicar éxito.                                                                                  |
| Esquema y referencias                     | Se rechazan versiones incompatibles, fechas inválidas, IDs duplicados y referencias a cursos inexistentes.                                                                        |
| Zona horaria y fechas civiles             | Aprobados los límites de medianoche entre Lima y Madrid y los cálculos entre meses. Las fechas no se convierten a UTC.                                                            |
| Bundle de producción y HTML autónomo      | Ejecutados con JSDOM, sin errores de ejecución, recorriendo las cinco rutas. El HTML integra CSS y JavaScript.                                                                    |
| Revisión visual en escritorio y móvil     | **Pendiente.** Se implementaron los breakpoints y el menú móvil, pero no se midió el layout en un navegador real.                                                                 |
| Capturas reales                           | **No disponibles.** No se generaron imágenes que simulen capturas de la aplicación.                                                                                               |
| GitHub remoto                             | **Creado por el titular y acceso comprobado.** Repositorio público `fabrizio-rda/studyspace`, rama `main`; fuentes incorporadas con esta entrega.                                 |
| GitHub Pages                              | **Publicación inicial verificada.** `build` y `deploy` finalizaron correctamente; https://fabrizio-rda.github.io/studyspace/ y sus recursos CSS/JavaScript respondieron HTTP 200. |

Los diálogos nativos, el desplazamiento y las descargas se simulan en JSDOM. Las pruebas no certifican el contraste visual final, el ajuste de elementos ni la consola de Chrome. No se inició un servidor ni se instaló un navegador como sustituto de la herramienta de revisión requerida por el entorno.

## Comandos utilizados

```sh
npm test
npm run build
npm run preview:html
npm run test:production
```

`npm ci` es el paso de instalación reproducible del workflow; las dependencias están bloqueadas en `package-lock.json`.

## Comprobación pendiente después del despliegue

1. Repositorio `studyspace` creado por el titular y acceso comprobado.
2. Incorporar las fuentes y seleccionar **Settings → Pages → Source → GitHub Actions**.
3. Verificar `build` y `deploy` en verde y abrir la URL devuelta por el trabajo de despliegue.
4. En Chrome, comprobar que CSS y JavaScript cargan sin errores de consola, navegar y recargar una ruta como `#/tareas`.
5. Crear datos, recargar y cerrar/abrir Chrome. Confirmar persistencia; exportar e importar una copia real.
6. Inspeccionar 1440×900 y 390×844: cuadrícula, legibilidad, formularios, calendario desplazable y menú móvil; capturar esas pantallas.

## Límites funcionales de esta entrega

- Almacenamiento por origen, navegador y dispositivo. No hay sincronización ni autenticación.
- La copia HTML autónoma usa el almacenamiento que Chrome permita para archivos locales. Sus datos son independientes de los de la futura URL pública. Usa Exportar/Importar para trasladarlos. Si el navegador impide `localStorage`, se muestra un aviso y no se afirma que los cambios se hayan guardado.
- Las horas son horas civiles del calendario. Cambiar la zona horaria no convierte horas existentes; sí actualiza la fecha de hoy, el saludo y las métricas de finalización.
- Kanban cambia estados con un selector o el formulario; no ofrece arrastrar tarjetas.
- No hay algoritmo de estudio, Pomodoro activo, archivos, Drive, Supabase, estadísticas de sesiones ni PWA en esta fase.
- La última escritura desde varias pestañas puede prevalecer; no existe resolución de conflictos simultáneos.
- Google Fonts requiere conexión; se dispone de fuente sans-serif alternativa.
