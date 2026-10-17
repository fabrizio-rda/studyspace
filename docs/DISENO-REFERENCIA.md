# Adaptación de la referencia visual

Composición inspirada en la captura facilitada: barra lateral estrecha de iconos, tipografía grande y ligera, paneles amplios con borde fino y superficies translúcidas. Se conserva la paleta de StudySpace: azul con degradados hacia celeste, tarjeta de Fabrizio celeste y Catalina vino suave. No se incorporan imágenes de montañas, gráficos inventados ni estadísticas de ejemplo.

La portada mantiene las dos tarjetas arriba y el calendario mensual debajo, con el título «Calendario». La barra lateral lleva a la portada, las tarjetas y el calendario. En pantallas pequeñas pasa a una fila superior y las tarjetas se apilan, con ajustes para 390 y 320 px. Se conservan los indicadores de actividad del calendario y sus detalles autorizados.

Dentro del espacio personal se aplican superficies azuladas, barra lateral azul oscuro, panel de bienvenida azul y botones con mayor contraste. La ilustración de libros se sustituye por un resumen de total, pendientes, completadas y porcentaje, calculado únicamente con las tareas de la cuenta activa. Se mantienen cursos, navegación y operaciones existentes.

Archivos de presentación: `reference-theme.css`, `pages/Entry.tsx`, `pages/Dashboard.tsx`, `components/LandingCalendar.tsx` y la importación en `main.tsx`. No se modifican datos, servicios de Supabase, permisos, mecanismos de sesión ni vínculos de cuentas. Los ajustes de acceso y correo pendientes en el PR #3 se conservan como base de esta revisión.

Validación: 131 pruebas en 19 archivos aprobadas, TypeScript, compilación y smoke del bundle/HTML. No se añaden dependencias ni imágenes. Permanece la advertencia de Vite por paquete principal superior a 650 kB. CSS con fallback sin blur y movimiento reducido; blur desactivado en tarjetas móviles.

No está disponible el control de navegador requerido por la previsualización administrada. No se generaron capturas ni se afirma validación visual. Para revisar, abrir el HTML del artefacto del PR en una ventana Invitado sin conectar Supabase; comprobar escritorio, 390 y 320 px, tarjetas, navegación superior móvil y calendario. El diseño con actividades y el resumen personal se verifican funcionalmente en JSDOM, no en un teléfono físico.

La entrega queda en el PR #3, sin merge ni publicación automática.
