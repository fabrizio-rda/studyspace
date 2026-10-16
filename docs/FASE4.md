# Fase 4 · propuesta para revisión

Sin merge, publicación ni cambios sobre Supabase de producción. El esquema académico sigue siendo 3; la versión de la aplicación es 4.0.0. No se crean usuarios, invitaciones ni datos académicos reales.

## Cuentas y sincronización

- Se procesan INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED y SIGNED_OUT. Un UUID distinto vacía inmediatamente la vista anterior y bloquea las ediciones durante la carga.
- Cada RPC usa la identidad comprobada con getClaims, una credencial fijada para esa solicitud y una señal que se cancela al cambiar de cuenta. Las respuestas antiguas se descartan mediante la generación del espacio.
- Web Locks permite una sola pestaña escritora por proyecto y UUID. Las otras consultan la nube sin reemplazar la copia de pendientes. Al cerrar la escritora, otra puede tomar el bloqueo con Sincronizar ahora o la consulta periódica. Sin Web Locks, la edición en nube queda bloqueada por seguridad.
- Los formularios de tareas, actividades, cursos, documentos, carpetas, temario, sesiones, preferencias y planes preservan cambios remotos en campos no editados. Los cambios incompatibles detienen la operación; se pueden exportar base, formulario y versión actual. La exportación triple es para comparación y recuperación manual, no para importarla directamente.
- Los proveedores compartidos invalidan solicitudes obsoletas, liberan su estado ocupado y consultan sin demora al recuperar conexión.
- Se mantienen el guardado transaccional con revisión y los conflictos entre dispositivos. No hay edición offline compleja ni combinación automática de cambios globales pendientes.

## Inicio

La tarjeta Tareas próximas diferencia Hoy y Mañana, con número de pendientes, tareas completadas identificadas y botones que preasignan la fecha correcta. Muestra hasta tres tareas por grupo y permite abrir el día completo.

Tareas de esta semana usa lunes a domingo, agrupa por fecha, identifica el curso y permite editar. Empieza con seis resultados, permite mostrar más y mantiene un área de desplazamiento limitada. Es un resumen semanal y puede repetir actividades presentes en Hoy o Mañana. Ninguna tarea se duplica entre los grupos de días distintos.

Las fechas parten de la zona IANA del espacio activo. Las pruebas incluyen el cambio de año y el domingo visto desde Lima cuando UTC ya es lunes. No se introducen tareas de demostración en la aplicación.

## Materiales, repasos y perfiles

Los materiales de Classroom usan una identidad estable derivada del curso, actividad y archivo/enlace, independiente de la posición. Las referencias antiguas se reconocen por URL, conservando ID, carpetas y etiquetas. No se adivina cómo corregir referencias que una versión anterior ya hubiese asociado incorrectamente; esas requieren revisión del propietario. Los permisos de Classroom y Drive siguen siendo de las integraciones existentes.

Repasos y registros de estudio se consultan en páginas de 30. Los filtros reinician la página y el orden se conserva. El restablecimiento se realiza sobre el perfil activo; Catalina conserva diez cursos y Cambridge propio. No se ejecutó sobre ninguna cuenta real.

## Icono

Fuente original: `public/branding/studyspace-source.png`. Recorte y escalado convencional, sin generación IA y conservando proporciones y colores del diseño. Se conserva un máster transparente de 512 px y se incluyen ICO, PNG de 16, 32, 48, 192 y 512 px y Apple de 180 px.

![Icono de 32 px](../public/favicon-32x32.png) ![Icono de 48 px](../public/favicon-48x48.png)

Las rutas son relativas y funcionan bajo `/studyspace/`. El manifiesto no añade PWA ni edición offline. No se verificó visualmente el icono en una pestaña de navegador en este entorno.

Google no garantiza mostrar el favicon y su actualización requiere rastreo. Además, admite un favicon por hostname, no por subdirectorio: `/studyspace/` comparte el hostname de GitHub Pages con otros proyectos del propietario. Si Google no lo adopta, habrá que revisar la portada del hostname o usar un dominio propio; no se cambió otro repositorio ni un dominio. Referencia: https://developers.google.com/search/docs/appearance/favicon-in-search.

## Presentación y rendimiento

Se conserva el diseño azul/celeste sobre beige y los acentos discretos. Se aumentan a 12 px los textos fijos menores de ese tamaño, se refuerza el contraste de textos secundarios y se amplían controles móviles. El menú móvil oculta los enlaces cerrados, contiene el foco y responde a Escape.

Configuración incorpora accesos a cuenta, estudio, perfil y copias. La disponibilidad y el restablecimiento se agrupan en desplegables; las conexiones técnicas mantienen su desplegable y Supabase sigue disponible.

Las páginas secundarias se cargan bajo demanda. La transición de rutas pasa a CSS, respetando movimiento reducido y retirando el motor de animaciones de la carga inicial. La prueba de producción compila un HTML de revisión independiente con imports integrados, sin cambiar los archivos divididos de producción.

## Verificación y límites

Resultados finales: 103/103 pruebas en 17 archivos, 80 comprobaciones SQL aisladas, TypeScript, compilación, HTML de revisión y humo de producción aprobados; ambos npm audit sin vulnerabilidades. El registro completo y advertencias están en VERIFICACION.md. JSDOM comprueba funcionamiento y navegación, no el aspecto visual. PGlite utiliza usuarios sintéticos aislados y no valida las cuentas reales.

Este entorno no ofrece la habilidad de control de navegador requerida por la previsualización administrada. No se inició un servidor alternativo ni se instalaron navegadores. Quedan pendientes capturas comparativas, revisión visual de escritorio/móvil y favicon en pestaña antes de aprobar la publicación. No se afirma prueba en teléfono físico, lector de pantalla ni dos dispositivos reales.

No se autorizó Google con cuentas escolares reales, no se registró Catalina ni se enviaron invitaciones. El procedimiento de incorporación está en DOS-CUENTAS.md. Los objetos de Supabase y su historial de migraciones necesitan una revisión específica antes de cualquier cambio de base de datos; esta rama no altera SQL ni RLS.

## Fase 5

PWA/edición offline con resolución de conflictos, Realtime si hace falta, sincronización incremental y optimizaciones de índices basadas en volumen real. El almacenamiento de archivos completos y nuevas funciones colaborativas quedan fuera de esta fase.
