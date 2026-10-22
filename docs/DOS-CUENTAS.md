# Dos cuentas independientes y calendario compartido

StudySpace mantiene dos espacios en la misma aplicación. Reutiliza los propietarios, las políticas de fase 3 y las protecciones de fase 4; no mueve datos de Fabrizio a Catalina. La portada encamina al acceso autenticado de la cuenta seleccionada. Los cursos iniciales solo se configuran después de autenticar y confirmar una cuenta vacía.

## Estado real de la entrega

El código y la migración se verifican con identidades de prueba aisladas. La auditoría posterior consultó metadatos y permisos de Supabase en modo lectura. No se accedió a tu almacenamiento privado de Chrome ni existe todavía una cuenta real de Catalina creada por estas pruebas. Por tanto, no se afirma haber registrado a Catalina, vinculado sus cuentas ni aplicado SQL sobre tu base real. Las autorizaciones Google de fase 3 también deben completarse si aún faltan.

## 1. Preparar la base de datos sin reiniciarla

1. Exporta tus datos personales desde **StudySpace → Configuración → Exportar mis datos** y conserva el JSON en privado.
2. En Supabase, comprueba y descarga una copia de base de datos con las opciones de respaldo disponibles en tu proyecto. Si no dispones de un respaldo gestionado, utiliza las herramientas de exportación de la consola; la exportación JSON de StudySpace recupera los datos académicos de tu cuenta, pero no sustituye un backup administrativo de Auth o de las invitaciones.
3. Conserva también los archivos del esquema original [001](../supabase/migrations/202610150001_phase3.sql), la ampliación [002](../supabase/migrations/202610150002_shared_calendar.sql) y la [reversión](../supabase/rollback/202610150002_shared_calendar.sql). Estos archivos son una copia recuperable del diseño SQL versionado; **no son una copia de los registros reales**.
4. En **Supabase → SQL Editor**, puedes comprobar la instalación actual con:

   ```sql
   select
     to_regprocedure('public.studyspace_read()') as phase3_read,
     to_regprocedure('public.studyspace_save(jsonb,bigint,text)') as phase3_save,
     to_regprocedure('public.studyspace_calendar_feed(date,date)') as shared_calendar;
   ```

5. Si ya funciona la fase 3, aplica **solo** [202610150002_shared_calendar.sql](../supabase/migrations/202610150002_shared_calendar.sql), completo, una vez. No vuelvas a ejecutar el esquema inicial ni borres tablas. En un proyecto realmente nuevo se aplican primero 001 y después 002. Si tu esquema está personalizado o faltan las funciones de fase 3, revisa esa diferencia antes de continuar.
6. La migración 002 añade tres tablas de vinculación/invitaciones y seis funciones. No cambia filas académicas, UUID de usuarios, IDs de cursos, tablas de tareas ni sus políticas RLS. Si falla, la transacción se revierte. No continúes con una migración fallida.
7. Repite la consulta anterior: `shared_calendar` debe mostrar la función instalada. El panel **Calendario compartido** dejará de informar que falta la migración una vez iniciada la sesión y actualizada su consulta.

No hace falta añadir `service_role`, secretos ni una nueva aplicación OAuth. La URL y la clave pública de Supabase siguen siendo las de la fase 3.

### Reversión

El archivo de reversión elimina únicamente funciones, invitaciones y relaciones de calendario. **Revoca las vinculaciones y elimina su historial**, por eso debe usarse solo por el administrador después de respaldar esa información y confirmar que quiere retirarla. No elimina cursos, tareas, sesiones, documentos ni datos de Auth. La reversión se prueba localmente comparando los estados académicos completos antes y después.

La nueva [portada](PORTADA.md) pide elegir la persona y confirmar una vez su UUID autenticado por navegador. Las tarjetas no sustituyen el inicio de sesión.

## 2. Fabrizio conserva su cuenta

Inicia sesión con el mismo email que ya usabas. Supabase devuelve su UUID existente. Si la cuenta ya tiene datos, StudySpace los carga; no vuelve a inicializar los cursos, no cambia nombres y no agrega cursos por coincidencia de nombre. English HL y Cambridge C1 siguen siendo cursos independientes cuando ya existen como tales.

Si todavía utilizas solo el espacio local de las fases anteriores, usa el asistente de migración **desde el navegador original**, revisa la copia y elige **Importar a mi cuenta**. La importación solo puede entrar en una nube vacía y necesita verificación de contenido. La copia local queda intacta y se asocia a ese usuario/proyecto. Después de cerrar sesión se oculta y no se permite importarla mediante la interfaz a otra cuenta.

Los datos locales antiguos que aún no se han asociado a una cuenta siguen siendo el espacio local de ese navegador. No los importes en la cuenta de Catalina. Ninguna cuenta nueva los hereda automáticamente.

## 3. Incorporar a Catalina

1. Catalina abre [StudySpace](https://fabrizio-rda.github.io/studyspace/) en su dispositivo.
2. Si hace falta, introduce la misma URL y **clave pública** del proyecto Supabase en **Configuración → Configurar servicios externos**. No necesita tu contraseña ni tu código de acceso.
3. En **Mi cuenta** introduce **su propio email real**, solicita el código y lo confirma. El registro se hace con Supabase Auth; no se crean credenciales ficticias desde el código.
4. El proyecto debe permitir nuevos registros para esta incorporación. Si deshabilitaste esa opción tras crear tu cuenta, habilítala temporalmente en Supabase Auth para que ella complete su registro y luego puedes volver a limitarla. Revisa también los destinatarios permitidos de SMTP si utilizas el servicio de prueba de Supabase; consulta la [guía de fase 3](CONFIGURACION.md).
5. Una cuenta vacía muestra **Configura tu espacio académico**, con estadísticas vacías. Escribe **Catalina** y conserva **Catalina · 10 cursos**. Pulsa **Crear mi espacio**.
6. Se crean: English HL, Literatura HL, Matemática NM, Gestión Empresarial, Historia, TOK / Teoría del Conocimiento, CAS, Cambridge C1 Advanced, Biology y Psicología. No se crean Física IB, Química IB ni AP Physics C. No hay tareas, evaluaciones, temarios ni progreso inventados.
7. La inicialización usa guardado con revisión cero y un recibo de reintento. Si se pierde la respuesta, puede repetirse con los mismos cursos/IDs; una cuenta con datos no se vuelve a inicializar. Si Catalina modifica o elimina cursos después, no reaparecen al volver a entrar.

La elección de cursos iniciales es una plantilla para una cuenta nueva autenticada, **no un selector de personas ni un permiso de acceso a otra cuenta**. Los cursos comunes tienen registros independientes y cada planificador usa únicamente datos de su propietario.

## 4. Vincular los calendarios con aceptación

1. Fabrizio entra en **Configuración → Calendario compartido** y escribe el email real con el que Catalina inició sesión.
2. Pulsa **Crear invitación**. Se guarda una invitación individual en Supabase y aparece un enlace. **No se envía un correo automáticamente.** Copia el enlace y compártelo con ella por el medio que prefieras.
3. Catalina abre el enlace e inicia sesión con ese mismo email verificado. Si aún no configuró su espacio, debe hacerlo primero. La invitación también aparece en su panel de invitaciones recibidas.
4. Catalina revisa el nombre y el email verificado del remitente y pulsa **Aceptar invitación**. No basta con conocer el enlace o el UUID: la base valida el email verificado de la persona destinataria. Otra cuenta no puede aceptarlo.
5. La vinculación concede lectura de las actividades autorizadas en ambos sentidos. Cada cuenta puede tener una vinculación activa con otra cuenta; no se forma un calendario público de todos los usuarios registrados.
6. Las invitaciones vencen a los siete días. El remitente puede cancelarlas y la destinataria rechazarlas. Crear la misma invitación vigente o repetir su aceptación no crea duplicados.
7. Cualquiera puede pulsar **Revocar acceso**. La otra persona deja de recibir esos registros en futuras consultas; ninguno pierde sus actividades personales. Para vincular de nuevo hace falta otra invitación aceptada.

## 5. Calendario conjunto automático

Las tareas, actividades y sesiones con fecha se guardan para el calendario conjunto sin selector de visibilidad. También las sesiones regeneradas por el planificador. Al guardar cambios en un espacio, se normalizan sus registros anteriores a `details`; la importación desde Configuración hace lo mismo.

Las actividades propias se calculan directamente desde el estado actual: aparecen inmediatamente sin esperar un guardado remoto ni tener una segunda cuenta vinculada. Las ajenas se consultan únicamente a través del vínculo aceptado y la RPC autenticada. No se permite consultar a cualquier usuario ni editar sus tareas.

El calendario muestra propietario, título, curso/color, fecha, hora, duración y tipo. No incluye descripciones, notas personales, resultados, progreso, estado de entrega de Classroom, enlaces ni documentos. El backend conserva compatibilidad con registros antiguos `private`/`busy`; el cliente valida que no lleguen detalles ajenos por esas vías.

El color azul/celeste o rosado/lila identifica a la persona; el nombre aparece también como etiqueta. El color del curso se conserva como un punto aparte. El nombre y el color de propietario pertenecen a las preferencias de cada cuenta.

## 6. Calendario y actualización

Cuando existe una vinculación válida, el calendario del dashboard muestra **Ambos** por defecto. Puedes filtrar por cada nombre. En **Calendario** elige **Mi calendario** o **Calendario compartido**, con vistas mensual, semanal y diaria. Seleccionar una actividad compartida abre únicamente su información autorizada. La vista compartida es de lectura; la edición personal continúa en Mi calendario.

El feed se calcula desde los registros originales de Supabase, no copiando actividades entre cuentas. La clave incluye propietario y origen, por lo que un mismo ID de evento en dos cuentas no los fusiona. Una tarea de Classroom sigue siendo una tarea y no se duplica como evento.

No se utiliza Supabase Realtime en esta versión. Se consulta cada **30 segundos mientras la página está visible**, al recuperar el foco y con el botón **Actualizar**. El panel de vinculación sigue el mismo comportamiento. La revocación se aplica en el servidor inmediatamente para las siguientes consultas; una vista ya abierta puede conservar lo visto hasta su siguiente actualización. No puede retirarse de forma retroactiva algo que alguien ya leyó.

Los datos compartidos no se guardan en localStorage, exportaciones personales ni una caché offline. Si falla una consulta o se pierde conexión, se ocultan de la vista y se cierran los detalles correspondientes. Tus datos personales siguen usando la caché autenticada y las reglas de sincronización de fase 3.

Las actividades con hora se convierten desde la zona de su propietario a la zona del usuario que consulta, incluyendo cambios de día. Las actividades de día completo mantienen su fecha civil. La zona inicial es `America/Lima`; no cambia la preferencia de la otra persona.

## 7. Drive, Classroom y Cambridge

Cada sesión Google permanece en memoria y se descarta al cambiar de cuenta o cerrar sesión de StudySpace. Una respuesta OAuth tardía de la cuenta anterior se rechaza. Cada persona debe autorizar su propio Google Drive/Classroom. Los documentos, carpetas, IDs externos, vínculos de cursos y entregas permanecen dentro de su propietario; no se consultan desde el calendario compartido.

Si Google Cloud está en modo de prueba, añade como usuario de prueba el email real de Catalina y completa los permisos de su institución cuando corresponda. No hace falta cambiar permisos de los documentos originales. Las conexiones no se consideran verificadas hasta probarlas con ambas cuentas reales.

Los cursos de Cambridge son propios de cada cuenta. Temarios, resultados de prácticas, vocabulario y futuras herramientas de la fase 4 no se comparten por tener el mismo nombre. En esta ampliación no se implementan esas herramientas especializadas.

## 8. Comprobación final con los dispositivos reales

- Inicien sesión por separado y comprueben nombre, cursos y estadísticas personales.
- Creen una tarea en cada cuenta y comprueben que no aparece en el gestor de la otra.
- Acepten la invitación. Creen una tarea y una sesión de estudio en cada cuenta sin elegir visibilidad.
- Actualicen desde el otro dispositivo. Comprueben los filtros, el curso/color y que no aparezcan notas personales.
- Cambien la fecha y luego revoquen la vinculación. Actualicen el otro dispositivo: ya no debe recibir registros de la cuenta revocada.
- Prueben Drive y Classroom autorizados individualmente y sus exportaciones JSON.

Estas comprobaciones reales quedan pendientes hasta tener el proyecto configurado y la cuenta real de Catalina. Los resultados automatizados y sus límites están en [VERIFICACION.md](../VERIFICACION.md).

## Auditoría de seguridad

Las 16 tablas académicas conservan las políticas `auth.uid() = owner_id` y sus FKs compuestas. Las tres tablas nuevas tienen RLS forzada y acceso directo denegado a `anon`/`authenticated`; solo las funciones comprobadas gestionan las relaciones. Las funciones de compartición son `security definer` con `search_path` vacío, validación de identidad y consulta explícita de campos autorizados. No se amplía el acceso a tablas privadas ni se usan secretos en el frontend. El feed no admite un `user_id` arbitrario: obtiene a los participantes de la vinculación del usuario autenticado.

Referencias: [funciones y permisos Supabase](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [zonas horarias date-fns-tz](https://github.com/marnusw/date-fns-tz).

## Comprobación de incorporación en fase 4

1. Catalina abre StudySpace en su computadora y configura la misma URL y clave **pública** del proyecto. No usa credenciales de Fabrizio.
2. Autentica su propio correo real y elige su nombre y el perfil Catalina: diez cursos, incluido Cambridge C1 Advanced. No debe importar la copia local de Fabrizio.
3. Comprueba que su espacio está vacío de tareas, planes y sesiones ajenos; Cambridge tiene sus propios identificadores y progreso.
4. Fabrizio crea una invitación dirigida a ese correo verificado. Catalina revisa la identidad y acepta desde su propia sesión.
5. Crear una actividad y comprobar que aparece automáticamente en ambos calendarios, sin compartir notas, documentos ni resultados. Revocar debe impedir las siguientes consultas ajenas.
6. En equipos compartidos, cerrar sesión. La sesión Supabase se conserva en el navegador mientras no se cierre; cambiar de UUID oculta inmediatamente el espacio anterior y cancela solicitudes pendientes.

Este procedimiento queda preparado, **no ejecutado con cuentas reales**. No se creó la cuenta de Catalina ni se enviaron invitaciones. SMTP, permisos institucionales Google y pruebas entre dispositivos reales siguen requiriendo configuración y validación de sus propietarios.

## Si no llega el correo de acceso

La URL y la clave pública son las mismas para ambos; el correo y la sesión son individuales. La solicitud aceptada por Supabase no demuestra entrega en la bandeja. Revisar spam y filtros institucionales; abrir el enlace «Sign in» / «Confirm your signup» si el mensaje no contiene un código. La app conserva el formulario al recargar y permite reenviar después de 60 segundos, con mensajes específicos para límites, destinatario no autorizado, error SMTP, enlace vencido y conexión.

Si Supabase devuelve destinatario no autorizado, el administrador debe configurar SMTP. El servicio predeterminado tiene restricciones de destinatarios y frecuencia: https://supabase.com/docs/guides/auth/auth-smtp. No se cambian plantillas, cuentas ni configuración de correo desde esta revisión, ni se envían mensajes de prueba a cuentas reales.
