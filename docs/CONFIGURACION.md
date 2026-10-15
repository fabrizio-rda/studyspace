# Conectar StudySpace

StudySpace sigue en https://fabrizio-rda.github.io/studyspace/ y usa el mismo repositorio. Biblioteca, colores y funciones locales funcionan sin servicios externos. Las integraciones necesitan proyectos propios y autorización real. No envíes contraseñas, códigos de acceso, claves privadas ni client secrets por chat o GitHub.

## 1. Antes de conectar

Abre StudySpace en el navegador donde tienes tus datos. En **Configuración → Copias de seguridad → Exportar mis datos**, descarga el JSON. En **Mi cuenta y datos → Revisar datos locales y migrar** puedes consultar el número de cursos, tareas, temarios, planes, registros, carpetas y documentos detectados. El entorno de desarrollo no ha accedido a tus datos de Chrome ni los ha migrado.

Las copias anteriores de fases 1/2 se leen sin cambiar IDs ni colores. Antes del primer guardado en esquema 3 se conserva el JSON original y se comprueba que puede recuperarse. Un fallo de almacenamiento impide la sustitución. El espacio local original se conserva también al entrar en modo nube.

## 2. Supabase, desde el navegador

1. Entra en [Supabase Dashboard](https://supabase.com/dashboard) y crea un proyecto. Guarda su contraseña de base de datos de forma privada; StudySpace no la necesita.
2. Abre **SQL Editor → New query**. Copia el contenido completo de [202610150001_phase3.sql](../supabase/migrations/202610150001_phase3.sql), incluido `begin` y `commit`, y ejecuta **Run** una vez. Si falla, la transacción se revierte: conserva el mensaje para diagnosticarlo. No borres tablas para reintentar.
3. En **Table Editor** verás 16 tablas `studyspace_*`. En **Database → Security Advisor** revisa las políticas. Todas las tablas personales tienen RLS forzada. Las funciones obtienen el propietario de `auth.uid()`; ningún campo del cliente elige a otro usuario.
4. En **Authentication → Sign In / Providers**, mantén **Email** habilitado. En **Authentication → Email Templates → Magic Link**, usa una plantilla con el código, por ejemplo: `<p>Tu código de StudySpace: {{ .Token }}</p>`. Si tu consola muestra una plantilla separada para confirmar una nueva cuenta, incluye allí también `{{ .Token }}`. La interfaz usa código OTP, no un callback de magic link.
5. En **Authentication → URL Configuration** establece **Site URL** y la URL permitida exacta: `https://fabrizio-rda.github.io/studyspace/`. El flujo OTP no redirige, pero deja configurada la URL correcta para los emails.
6. Revisa el envío de correo: el SMTP incluido por Supabase tiene restricciones de destinatarios y cuota; para una prueba personal usa una dirección autorizada del equipo del proyecto. Si tu email no está autorizado, configura un SMTP propio en Authentication. Sus credenciales se guardan únicamente en Supabase, nunca en StudySpace. Consulta [SMTP oficial](https://supabase.com/docs/guides/auth/auth-smtp).
7. En el diálogo **Connect** del proyecto o **Settings → API / API Keys**, copia la URL `https://<proyecto>.supabase.co` y la **publishable key** (`sb_publishable_…`). También se admite la antigua **anon key**. Nunca uses `service_role`, `sb_secret_…`, la contraseña de Postgres ni un token de administración.
8. En StudySpace abre **Configuración → Configurar servicios externos**. Pega la URL y la clave pública en sus campos y guarda. No hacen falta cambios en GitHub Actions ni variables secretas. Estos identificadores públicos se guardan por navegador; repítelos en el otro dispositivo.
9. En **Mi cuenta**, solicita el código por email e introdúcelo. Un código válido abre la cuenta real. Si la cuenta está vacía, revisa el asistente antes de importar. Tras crear tu cuenta, puedes limitar nuevos registros si quieres. Para incorporar a Catalina debes permitir su registro con su email verificado: consulta [Dos cuentas](DOS-CUENTAS.md). El inicio de sesión de cuentas existentes no crea otro usuario.

Las sesiones de Supabase viven en memoria. Recargar o cerrar la página requiere volver a iniciar sesión; los datos y guardados pendientes permanecen en la caché de esa cuenta y no se muestran antes de autenticar. Cada cuenta tiene su espacio privado y no hay un selector para entrar en otra persona. La vinculación opcional de calendarios se documenta en [Dos cuentas](DOS-CUENTAS.md).

### Importar y comprobar los dos dispositivos

1. En el dispositivo original, exporta la copia local desde el asistente.
2. Con la cuenta vacía autenticada, pulsa **Importar a mi cuenta**. El asistente conserva IDs y relaciones, compara el contenido devuelto y muestra los recuentos verificados. No elimina el almacenamiento local.
3. Si se pierde la respuesta, reintenta: se reutiliza el identificador de importación. Si la nube ya tiene otro contenido, se rechaza la importación inicial. No hay una combinación automática de dos espacios existentes.
4. Crea una tarea de comprobación y espera el indicador **Sincronizado**.
5. En otro dispositivo, configura la misma URL y clave pública, inicia sesión con el mismo email y comprueba esa tarea. Crea o edita otra y pulsa **Sincronizar ahora** en el primer dispositivo.
6. Ante un conflicto, exporta los cambios pendientes y usa **Cargar versión de la nube** con confirmación. No se sobrescribe automáticamente la revisión más nueva. La importación JSON reemplaza todo el espacio activo y debe usarse con cuidado tras exportar copias.

Se consulta la nube aproximadamente cada 30 segundos mientras la página está abierta; un cambio local se intenta guardar tras 750 ms. No se promete sincronización cerrando la página ni en segundo plano. Sin conexión, la página ya abierta permite consultar su caché autenticada; editar en modo nube se bloquea. No hay edición offline ni PWA. Los guardados iniciados con conexión se conservan para reintento si falla la red. Otra pestaña o dispositivo puede provocar un conflicto que requiere revisión.

El temporizador se usa en un dispositivo a la vez. La nube guarda puntos de recuperación pausados; no empieza a contar automáticamente en otro dispositivo. Los descansos y el tiempo previsto no se convierten en estudio real. Tras un cierre abrupto pueden faltar los últimos segundos desde el checkpoint, como en la fase anterior.

## 3. Google Cloud: Drive y Classroom

Supabase Auth y la autorización de Google son independientes. Puedes usar un email personal para StudySpace y autorizar tu cuenta escolar en Google. Cada permiso se solicita al pulsar su botón, no al abrir la web.

1. Abre [Google Cloud Console](https://console.cloud.google.com/) y crea o elige un proyecto. En su información general copia el **número de proyecto**, no el Project ID textual.
2. En **APIs & Services → Library**, habilita **Google Drive API**, **Google Picker API** y **Google Classroom API**.
3. En **Google Auth Platform / OAuth consent screen**, configura el nombre StudySpace y el email de soporte propio. Si no administras la organización escolar, no elijas una audiencia interna de una organización ajena. Con audiencia externa y modo de prueba, añade como usuario de prueba el email exacto con el que autorizarás Google.
4. Registra la página de inicio `https://fabrizio-rda.github.io/studyspace/` y la política `https://fabrizio-rda.github.io/studyspace/privacy.html` cuando la consola las solicite. Revisa y completa los datos de soporte del proyecto. Google puede requerir verificación del dominio, consentimiento o publicación para determinados usos; este código no evita esos requisitos.
5. En **Clients / Credentials → Create OAuth client ID → Web application**, añade como **Authorized JavaScript origin** exactamente `https://fabrizio-rda.github.io`, sin `/studyspace/`, barra final ni fragmento. Este flujo usa el popup de GIS; no requiere un redirect URI de Google ni client secret en el navegador. No copies un secreto aunque la consola lo muestre.
6. Copia el **Client ID**, terminado en `.apps.googleusercontent.com`.
7. Crea una API key para Picker. En **Application restrictions**, elige **Websites / HTTP referrers** y autoriza `https://fabrizio-rda.github.io/*`. En **API restrictions**, limita la clave a **Google Picker API**. La API de Drive se consulta con OAuth. Si Google muestra un error de restricciones, comprueba el nombre de la API y las instrucciones de Picker antes de ampliar permisos.
8. En StudySpace guarda el Client ID, la API key pública y el número de proyecto. Usa valores del mismo proyecto. La web carga GIS; si una extensión o la red lo bloquea, aparecerá un error y no se mostrará como conectado.

### Drive

Pulsa **Conectar Drive**, elige tu cuenta y autoriza `https://www.googleapis.com/auth/drive.file`. En **Biblioteca → Seleccionar de Drive** se abre Picker con selección múltiple. Se consultan únicamente ID, nombre, tipo y enlace de los archivos elegidos; no se copia su contenido. Edita sus referencias para asignar carpeta, curso, tema y etiquetas.

Abre los documentos con el enlace al original; el acceso final depende de los permisos de tu cuenta en Google. Esta versión utiliza ese acceso en otra pestaña y no promete una vista previa incrustada de archivos privados. Mover o eliminar una referencia no llama a las operaciones de mover/eliminar en Drive.

### Classroom

Pulsa **Conectar Classroom** y autoriza los alcances de lectura:

- `https://www.googleapis.com/auth/classroom.courses.readonly`
- `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
- `https://www.googleapis.com/auth/classroom.student-submissions.me.readonly`

Abre **Seleccionar cursos**, vincula cada curso elegido con uno existente en StudySpace y guarda. Los no seleccionados no se sincronizan. Después pulsa **Sincronizar ahora**. Verás nuevas, actualizadas, errores y la última consulta. No se crean cursos ni planes automáticamente.

Las actividades se identifican por curso + ID original. La fecha y hora UTC de Classroom se convierten a tu zona al importar. Las tareas sin entrega permanecen sin fecha y no se inventa un evento en el calendario. Los materiales accesibles se guardan como referencias en Biblioteca.

La prioridad, notas personales, tiempo estimado, estado personal y progreso se conservan. El título, descripción, fecha y hora se actualizan si siguen iguales al último valor remoto; una edición local los conserva. La entrega escolar se muestra por separado. StudySpace nunca entrega, devuelve ni modifica tareas de Classroom. Eliminar una tarea importada elimina su referencia local de sincronización; si la vuelves a sincronizar, se importará de nuevo.

Al crear un plan, elige una actividad con fecha como objetivo. Un cambio posterior de entrega muestra un aviso en ese plan; **Revisar fecha y recalcular** permite revisar y confirmar otra programación conservando las sesiones completadas. Una entrega retirada o una fecha anterior al inicio requiere elegir un objetivo válido manualmente.

Si la institución bloquea la aplicación, solicita al administrador autorización para el Client ID y los permisos indicados. No desactives sus controles. Un error `403`, API no habilitada, cuenta de prueba ausente, popup bloqueado o `redirect/origin mismatch` debe corregirse en la consola o con el administrador. Google puede exigir verificación OAuth antes de publicar la aplicación para más usuarios.

Los tokens de Google están en memoria, expiran y se renuevan mediante otra acción del usuario. No existen refresh tokens guardados ni sincronización constante. **Desconectar Google** borra la sesión e intenta revocar la autorización del Client ID; esto afecta Drive y Classroom si comparten ese cliente. También puedes retirar el acceso en [tu cuenta Google](https://myaccount.google.com/permissions). Las referencias académicas se conservan.

## 4. Qué está pendiente de comprobar realmente

El código, las migraciones y las pruebas automatizadas están en el repositorio. Hasta aplicar el SQL, configurar los identificadores e iniciar sesión/autorización, Supabase, Drive y Classroom están **pendientes de configuración externa**. No se ha realizado una migración de tu Chrome ni comprobado el envío de email, Picker con tu cuenta, acceso escolar o sincronización física entre dos dispositivos.

## Referencias oficiales

- [Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [claves públicas](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [URLs](https://supabase.com/docs/guides/auth/redirect-urls).
- [GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Client ID y origen](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid), [Picker](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample).
- [Classroom scopes](https://developers.google.com/workspace/classroom/guides/auth), [fechas de CourseWork](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork).
