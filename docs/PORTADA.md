# Portada de StudySpace

Una sola aplicación. `#/` muestra las tarjetas de Fabrizio y Catalina y, debajo, el calendario conjunto. `#/espacio` conserva el panel personal; las demás rutas internas mantienen su navegación. «Cambiar de espacio» y el logotipo regresan a la portada.

## Acceso y separación

- Las tarjetas contienen información de presentación: nombre, inicial y seis cursos de ejemplo. No leen cursos privados de otra cuenta ni crean datos académicos.
- La primera vez, tras autenticar, se pide confirmar el correo y la persona antes de asociar su tarjeta al UUID. En una cuenta vacía se confirma antes de crear cursos. La asociación se guarda únicamente en este navegador y proyecto. No se deduce autorización por nombre, color ni lista de cursos.
- Después de confirmarla, elegir la tarjeta con ese UUID ya autenticado abre directamente su espacio. La sesión sigue siendo la de Supabase; la portada no cambia propietarios ni suplanta usuarios.
- Al elegir la otra persona aparece su acceso, sin mostrar el espacio anterior. «Cambiar de cuenta y continuar» utiliza el cierre de sesión existente; si hay pendientes, este se bloquea y permite sincronizar o descargar una copia. Después se usa el mismo formulario OTP de Configuración.
- Una cuenta autenticada diferente a la asociada no puede continuar por esa tarjeta. El mismo UUID no puede asociarse a ambas. Los perfiles académicos y nombres solo impiden una equivocación evidente durante la primera configuración; nunca conceden entrada automática.
- La asociación de tarjeta es una preferencia local explícita, no una política de seguridad del servidor. Supabase, UUID, revisión transaccional, RLS, protección de formularios y Web Locks siguen siendo los controles de acceso/escritura de fase 4. No se modifica SQL, Auth ni ninguna cuenta real.
- En otro navegador o después de borrar esta preferencia será necesario confirmar de nuevo. Las asociaciones son locales; no se sincronizan ni se publican correos/UUID en el repositorio. Para corregir una asociación equivocada se puede eliminar exclusivamente `studyspace:entry-identities:v1:<URL-del-proyecto>`; no borrar el resto del almacenamiento ni las cachés de recuperación.
- Los enlaces directos e invitaciones conservan su ruta y parámetros después de elegir e iniciar sesión. La copia local anterior se mantiene en un acceso explícito «Datos de este navegador → Abrir espacio local», separado de las tarjetas.

## Calendario conjunto

Reutiliza SharingProvider, useSharing y useSharedFeed: la vinculación aceptada y los RPC existentes deciden qué puede consultar la sesión. La portada presenta una agenda semanal de lunes a domingo, navegación entre semanas y actualización manual; no tiene edición.

El feed existente contiene también entradas privadas propias. La portada las excluye expresamente. Las entradas «Ocupado», incluso propias, muestran solo disponibilidad, sin título ni curso. No se consultan datos académicos anónimos, no se hacen públicos calendarios ni se cachean actividades ajenas. Sin sesión, vinculación, conexión o permisos se presenta el estado correspondiente, sin inventar actividades.

El calendario no puede mostrarse públicamente antes de autenticar sin cambiar su modelo de privacidad. Se conserva el acceso privado existente. No se crearon cuentas ni invitaciones para esta entrega.

## Avatares y presentación

Avatares provisionales de iniciales F/C; no se necesitan fotos para utilizar la portada. Para usar fotos reales, añadirlas a `public/avatars/` y cambiar `avatarSrc` en `src/services/entry.ts`, por ejemplo `import.meta.env.BASE_URL + "avatars/fabrizio.jpg"`. Si la imagen falla vuelve a las iniciales. Los dos perfiles comparten estructura; celeste/azul para Fabrizio y vino suave/borgoña para Catalina.

Grid de dos columnas en escritorio y una por debajo de 700 px; ajustes específicos hasta 390 px para incluir 320 px, controles de al menos 44 px, listas con ajuste de línea, desplazamiento acotado de agenda y foco visible. No se afirma validación visual por leer CSS o ejecutar JSDOM.

## Pruebas y revisión manual

11 regresiones nuevas con StoreProvider y App reales, sustituyendo Auth/HTTP: anónimo sin filtraciones, UUID reconocido, confirmación inicial, cambio de cuenta, identidad cambiada durante el uso, calendario sin privados y disponibilidad redactada, pendientes, alta de Catalina con diez cursos/C1 propio, preferencia corrupta y enlaces de invitación antes/después de login. Los recorridos anteriores de CRUD se ejecutan explícitamente en el espacio local conservado.

La suite completa tiene 130 pruebas en 19 archivos. TypeScript, build, HTML autónomo y smoke de producción verifican portada, acceso, rutas internas e iconos. El smoke no valida geometría de pantalla. Se mantiene la advertencia de Vite por el paquete principal superior a 650 kB. Dependencias, esquema y políticas no cambian en esta rama.

No está disponible el control de navegador requerido por Sites. No se inició un servidor alternativo ni se generaron capturas. Antes de aprobar la publicación:

1. Abrir el HTML de revisión del artefacto del PR o la rama local con `npm ci`, `npm run build` y `npx vite preview --host 127.0.0.1 --port 4173` en una ventana Invitado. Abrir `http://127.0.0.1:4173/`; no conectar Supabase real para revisar el aspecto.
2. Revisar en escritorio y DevTools a 390 y 320 px: tarjetas apiladas, cursos legibles, botones completos, acceso y campos sin recortes, agenda sin desplazamiento horizontal. Sin sesión, el calendario muestra su estado vacío real. La agenda con contenido solo se probó en DOM con respuestas controladas.
3. Comprobar navegación con Tab, foco al cambiar de pantalla y retorno a portada. Las fotos reales pueden reemplazarse posteriormente; no hay imágenes personales en esta entrega.
4. Comprobar por separado con los propietarios el recorrido real de cuentas y la vinculación, cuando corresponda. No se afirma prueba física ni autenticación real de Catalina.

La rama y el PR no se fusionan ni publican automáticamente.
