# StudySpace · Fase 3 + cuentas independientes

Espacios académicos privados con cuentas autenticadas independientes. Mismo repositorio y GitHub Pages; calendario combinado solo mediante invitación aceptada y visibilidad explícita.

- [Aplicación](https://fabrizio-rda.github.io/studyspace/)
- [Configurar Supabase, Drive y Classroom](docs/CONFIGURACION.md)
- [Dos cuentas, migración y calendario compartido](docs/DOS-CUENTAS.md)
- [Verificación y límites reales](VERIFICACION.md)

## Ampliación 3.1 — dos cuentas y calendario autorizado

Reutiliza el aislamiento por propietario. Una cuenta nueva autenticada puede crear los diez cursos de Catalina sin datos ficticios; una cuenta existente nunca se vuelve a inicializar. El dashboard, la planificación, la biblioteca, Google y las estadísticas siguen siendo personales. La copia local migrada se asocia a su cuenta y queda oculta al salir.

La migración SQL **002** es aditiva: tres tablas y seis RPCs, sin modificar los 16 conjuntos académicos ni sus políticas. Invitación dirigida al email verificado, aceptación, cancelación y revocación; una vinculación activa de dos cuentas. Los calendarios combinados muestran únicamente los campos autorizados. Privado es el valor inicial, disponibilidad oculta título/curso/tipo y los detalles excluyen notas, documentos y resultados. No existe acceso a otra cuenta mediante un selector.

El dashboard muestra Ambos cuando las cuentas están vinculadas. El calendario completo conserva vistas mensual/semanal/diaria y Mi calendario. Actualización cada 30 segundos con página visible y al recuperar el foco, sin Realtime ni caché offline compartida. Los horarios se convierten entre zonas y las fechas de día completo se conservan. Los datos del otro usuario nunca entran en AppState, el buscador global o la exportación personal.

**Estado externo:** migración y cuentas reales pendientes de configuración/autorización en el proyecto del usuario. No se crearon credenciales de Catalina ni se aplicó SQL remoto. [Pasos y reversión](docs/DOS-CUENTAS.md).

## Funciones

Conserva cursos, tareas y Kanban, calendario mensual/semanal/diario, temarios, planes con disponibilidad compartida y revisión previa, sesiones, Pomodoro, tiempo real, estadísticas y repetición espaciada. Añade 20 colores nombrados y hexadecimal con vista previa, Biblioteca con carpetas/subcarpetas virtuales, enlaces manuales, cursos, temas, etiquetas, búsqueda, cuadrícula/lista y acciones de organización.

El buscador global agrupa cursos, tareas, Classroom, actividades, temas, planes, carpetas y documentos. Mantiene el diseño beige con azul/celeste principal y acentos morado/rosa/naranja.

## Integraciones: implementación disponible, autorización externa pendiente

**Supabase:** email OTP en memoria, caché por cuenta, importación local a cuenta vacía con IDs estables, respaldo y verificación de contenido/recuentos. RPC transaccional con revisión esperada y clave de reintento. Si otro dispositivo guardó una revisión más reciente, detiene el envío y conserva los cambios para exportar/revisar. No combina espacios automáticamente. Los datos de la cuenta no se muestran al cerrar sesión.

**Drive:** GIS, Picker y Drive API con `drive.file`, selección explícita y referencias de metadatos. No se copian contenidos privados ni se mueven/eliminan originales. Se abre el archivo original en otra pestaña; no se promete preview incrustado de archivos privados.

**Classroom:** lectura de cursos seleccionados, vínculos con cursos existentes, importación idempotente por ID original, materiales y entrega escolar separada del estado personal. Fechas UTC convertidas a la zona configurada. Conserva campos personales y ediciones locales frente al último snapshot remoto. Actividades con fecha pueden ser objetivo de un plan; cambios de fecha requieren revisar y confirmar reprogramación. Sin entrega automática ni consulta constante en segundo plano.

Los botones no muestran una conexión ficticia. Faltan el proyecto Supabase configurado, sus identificadores públicos, el proyecto Google Cloud y la autorización de la cuenta escolar. Sigue la guía desde el navegador; no necesitas instalar software en tu equipo. No se han leído ni migrado datos del navegador personal del usuario.

## Datos y seguridad

La clave local `studyspace:data:v1` permanece y el contenido usa **schemaVersion 3**. Acepta copias de esquema 1/2; valida IDs, jerarquías, relaciones y enlaces http(s). Antes de sustituir un esquema anterior conserva una copia original verificable en `studyspace:backup:before-phase3`; mantiene la copia histórica de fase 2. Los errores de lectura y cuota detienen la escritura.

Entrar en nube no sustituye el espacio local original. La caché y los recibos de migración se separan por proyecto y usuario. La importación inicial mantiene un identificador de operación para reintentar sin duplicados; verifica todos los registros devueltos. Exportar JSON incluye también Biblioteca y referencias de Classroom, pero nunca tokens ni configuración de credenciales.

La migración SQL de fase 3 crea **16 tablas**, claves foráneas compuestas por propietario/ID, índices y RLS forzada. Los payloads JSONB conservan todos los campos versionados, con columnas de relación generadas e índices, tabla de unión de temas/planes y configuración separada. `auth.uid()` determina el propietario; las funciones son `security invoker`. El guardado reemplaza el grafo personal en una sola transacción y comprueba la revisión bajo bloqueo. No hay service_role en el frontend.

La sesión Supabase y los tokens Google viven en memoria. No se guardan access/refresh tokens en localStorage ni en JSON. Las únicas claves configurables en la interfaz son públicas. Al cambiar de cuenta se descartan formularios/búsqueda y se desconecta Google; una importación asíncrona que empezó en otro espacio se rechaza.

Sin conexión puede consultarse la caché de la sesión ya autenticada y abierta. Editar en modo nube requiere conexión. Un guardado que pierde conexión queda persistido para reintento, conservando su revisión y operación. No existe edición offline, PWA, service worker ni auto-merge de conflictos. Recargar exige autenticarse de nuevo. En modo local siguen funcionando las herramientas sin Google. El temporizador se recupera pausado al consultar la nube en otro dispositivo.

## Desarrollo y verificación

React 19, TypeScript estricto, Vite, Tailwind, Framer Motion, Lucide, date-fns, Zod y Supabase JS. HashRouter y `base: './'` para GitHub Pages.

```sh
npm ci
npm test
npm run test:database
npm run build
npm run preview:html
npm run test:production
```

GitHub Actions ejecuta pruebas DOM/unidad, migración SQL y RLS en PostgreSQL/PGlite, compilación y ocho secciones más la vista compartida del bundle compilado en JSDOM antes de desplegar `dist/`. La prueba SQL local no certifica la configuración de un proyecto Supabase remoto. Las pruebas de SDK/API controladas no certifican OAuth escolar real. La revisión visual en navegador y las capturas siguen pendientes; no se presentan pruebas DOM como capturas.

## Archivos principales de fase 3

| Archivo                                       | Responsabilidad                                              |
| --------------------------------------------- | ------------------------------------------------------------ |
| `src/models/schema.ts`                        | Esquema 3, integridad, Biblioteca y referencias externas     |
| `src/services/storage.ts`                     | Compatibilidad, respaldo y almacenamiento local              |
| `src/services/store.tsx`                      | Espacio activo, autenticación, sincronización y conflictos   |
| `src/services/cloud.ts`                       | Supabase, RPC, caché por cuenta y verificación               |
| `supabase/migrations/202610150001_phase3.sql` | Tablas, relaciones, RLS y funciones atómicas                 |
| `src/services/google.ts`                      | GIS, tokens efímeros, Picker y Drive                         |
| `src/services/classroom.ts`                   | API readonly, paginación, fechas y actualización idempotente |
| `src/pages/Library.tsx`                       | Explorador de carpetas/documentos                            |
| `src/components/Integrations.tsx`             | Cuenta, conexiones, migración y configuración                |
| `docs/CONFIGURACION.md`                       | Configuración externa y comprobaciones de uso                |

No se han iniciado las fases 4 ni 5. La siguiente revisión debe aplicar la migración 002 en el proyecto real, completar las autorizaciones, comprobar las dos cuentas/dispositivos y revisar móvil.
