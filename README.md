# StudySpace · Fase 2

Organizador académico con temarios, planes de preparación, sesiones de estudio y repetición espaciada. React, TypeScript y Vite; aplicación estática sin servicios de pago ni IA externa.

- Aplicación: https://fabrizio-rda.github.io/studyspace/
- Código: https://github.com/fabrizio-rda/studyspace
- Despliegues y pruebas: https://github.com/fabrizio-rda/studyspace/actions

Se mantiene el diseño aprobado: fondo beige, azul/celeste como acento principal, degradado de morado a naranja en la bienvenida, tipografía Plus Jakarta Sans, tarjetas y navegación redondeadas. Sin estrellas ni mensajes motivacionales genéricos.

## Uso en Chrome, sin instalar programas

1. Abre la aplicación. Los cursos, tareas y eventos existentes siguen en el mismo navegador y la misma URL.
2. En **Mis cursos → un curso → Temario**, crea unidades, temas y subtemas. Edita dificultad y dominio; marcar «completado» es independiente de «Lo domino». Las flechas cambian el orden y las unidades y temas con hijos se pueden desplegar. El botón de historial muestra el tiempo real y los repasos.
3. En **Configuración → Configuración de estudio**, ajusta tu disponibilidad global, días de descanso, horario, intervalos y temporizador. Cero minutos indica descanso. Los valores iniciales son preferencias editables, no una detección automática de tu disponibilidad.
4. En **Planes de estudio → Crear plan**, indica objetivo, fechas, temas, dificultad, máximos diarios, duración, prioridad y porcentaje para repasar. El asistente muestra una vista previa: el plan y su programación solo se guardan al pulsar **Confirmar calendario**.
5. Revisa **Tu plan de hoy** en Inicio. Puedes iniciar, completar, posponer o editar cada sesión y abrir el plan relacionado. Los repasos pendientes aparecen también aquí.
6. En **Sesiones de estudio**, inicia un temporizador libre o una sesión programada. Usa estudio continuo o Pomodoro, pausa, reanuda y guarda el tiempo real junto a notas y comprensión. Al llegar a cero no se inventa un registro: debes guardarlo. En Pomodoro decides cuándo iniciar el descanso o el siguiente bloque.
7. En **Calendario** aparecen tareas, exámenes, sesiones y repasos con etiquetas distintas y colores de curso. Puedes editar fecha/hora/duración de sesiones pendientes. Los cambios manuales se conservan al regenerar.
8. Exporta copias JSON desde Configuración. Incluyen todos los datos y se pueden importar con confirmación. Se aceptan las copias de fase 1.

**Los datos permanecen en este navegador y dispositivo.** No hay sincronización entre dispositivos. Borrar los datos del sitio o usar navegación privada puede eliminarlos. Todavía no se implementan Drive, Supabase, autenticación, Google Classroom ni PWA.

## Cómo planifica

El algoritmo de `src/services/planner.ts` es determinista y no usa una API de IA.

- Ordena planes por fecha objetivo; para una misma fecha, por prioridad. Dentro de cada plan da preferencia a temas difíciles y con dominio bajo.
- Estima la preparación de cada tema a partir de su dificultad y dominio. Esa carga es orientativa, no una medición científica del tiempo que necesitará cada persona.
- Descuenta los minutos reales ya completados y los bloques manuales futuros que se conservarán.
- Comparte una sola disponibilidad global entre todos los planes. El límite de un plan puede reducirla, nunca sumarla. Los días con cero minutos se omiten.
- Reserva el porcentaje de repaso configurado y coloca los repasos después del estudio. También programa los repasos espaciados vencidos o próximos, incluso si ya se cumplió la cuota inicial del plan.
- Cada tarea o actividad reserva por defecto 30 minutos del presupuesto de su fecha, porque el modelo de fase 1 no registra su duración. Si tiene hora, bloquea además ese intervalo. Esta reserva se modifica en Configuración y se explica en la vista previa.
- Considera sesiones existentes, minutos reales registrados, límites diarios y horario de estudio. Genera bloques de al menos cinco minutos sin asignarlos a horas pasadas ni después de la fecha objetivo del plan.
- Si algo no cabe, informa los minutos pendientes por tema y tipo. No amplía la disponibilidad ni elimina tareas para hacerlos caber.
- Regenerar conserva sesiones completadas, canceladas, manuales y la vinculada al temporizador activo. Reemplaza solo las pendientes automáticas después de mostrar la propuesta y obtener confirmación. Si los datos cambian mientras se revisa, exige actualizar la vista previa.

El avance de un plan compara los minutos completados con la carga estimada de sus temas y repasos. Los minutos que no cupieron siguen formando parte del trabajo pendiente. Actualizar dificultad o dominio puede cambiar la estimación y, por tanto, el porcentaje.

## Repetición espaciada y dominio

Al guardar una sesión completada con un tema se solicita una autoevaluación:

| Comprensión        | Intervalo inicial |
| ------------------ | ----------------- |
| No lo entiendo     | 1 día             |
| Necesito practicar | 2 días            |
| Lo entiendo        | 5 días            |
| Lo domino          | 14 días           |

Los intervalos son editables. El próximo repaso se calcula desde la fecha real del estudio. Se conservan última fecha de estudio, última fecha de repaso, contador e historial. Completar una sesión no marca un tema como completado ni dominado por el mero tiempo dedicado.

## Temporizador y recuperación

El tiempo transcurrido se calcula con `Date.now()` y marcas de inicio/pausa, no restando un segundo por intervalo. El refresco visual no determina la duración. Los descansos Pomodoro no suman minutos de estudio.

Se guarda una marca de recuperación cada 15 segundos y al abandonar la página. Al volver, el temporizador se recupera **pausado**, hasta la última marca persistida. Una caída abrupta puede perder los últimos segundos desde esa marca; el tiempo ausente no se cuenta como estudio ni se registra una sesión completa. Puedes corregir la duración real al guardar, recuperar la sesión o descartarla. El estado vive en la misma capa de datos y se incluye en las copias.

## Migración y seguridad de los datos

Se conserva la clave `studyspace:data:v1`; el contenido nuevo utiliza `schemaVersion: 2`.

1. Una lectura de fase 1 valida el formato y lo migra **en memoria**, sin escribir durante cada renderizado.
2. Se conservan exactamente cursos, tareas, eventos y preferencias de la fase 1. Se añaden colecciones de estudio vacías y preferencias iniciales.
3. Antes de la primera escritura sobre datos de fase 1, se guarda su JSON original, byte por byte, en `studyspace:backup:before-phase2`.
4. Si no hay espacio para esa copia, se cancela la escritura y se conserva el original.
5. Las siguientes escrituras validan el estado completo. No se reinician las entidades al cargar la aplicación.
6. Las copias antiguas se aceptan y migran; versiones desconocidas, relaciones rotas y datos inválidos se rechazan.

Configuración incluye una descarga de la copia anterior a fase 2, cuando existe. El reset sigue requiriendo confirmación y elimina también los datos de estudio actuales; la copia de recuperación anterior se conserva.

Eliminar un curso conserva sus actividades y datos de estudio sin curso. Los temarios conservados se pueden consultar desde Mis cursos. Eliminar un tema cancela su programación pendiente, lo retira de planes y mantiene los registros históricos con su nombre. Eliminar un plan conserva registros y cancela sus pendientes, sin inventar sesiones completadas.

Se escucha `storage` para actualizar otras pestañas y se relee el estado antes de modificar. No existe resolución de conflictos simultáneos: la última escritura puede prevalecer.

## Arquitectura

```text
src/models/schema.ts          Esquemas 1/2, modelos y preferencias
src/services/storage.ts       Migración, validación, copias y persistencia
src/services/store.tsx        Operaciones compartidas y recuperación
src/services/planner.ts       Planificador, conflictos, progreso y recomendaciones
src/services/study.ts         Temporizador, registros, repasos y relaciones
src/components/Syllabus.tsx   Jerarquía de unidades/temas e historial
src/components/SchedulePreview.tsx  Confirmación de programación
src/components/SessionCards.tsx     Acciones de sesiones
src/components/StudyDialogs.tsx     Edición y registro real
src/components/TodayPlan.tsx        Recomendaciones del dashboard
src/components/Reviews.tsx          Repasos pendientes y próximos
src/components/StudyPreferences.tsx Preferencias de estudio
src/components/TimerRuntime.tsx     Persistencia del temporizador entre rutas
src/pages/Plans.tsx            Planes y asistente
src/pages/StudySessions.tsx    Temporizador, estadísticas e historial
src/study.css                 Estilos de fase 2, adaptados a móvil
```

Los modelos separan tareas/eventos, programación, registros reales y repasos. No se duplica una tarea como evento. Las fechas civiles siguen en `YYYY-MM-DD` y las horas en `HH:mm`; creación y finalización utilizan instantes ISO. `America/Lima` sigue siendo la preferencia inicial. Cambiar de zona no convierte las horas civiles ya ingresadas.

## Verificación y desarrollo en la nube

```sh
npm ci
npm test
npm run build
npm run preview:html
npm run test:production
```

La suite cubre recorridos de ambas fases, migración y cuotas de almacenamiento, límites compartidos, prioridades, conflictos, fechas, regeneración, temporizador y repasos. El bundle compilado se ejecuta en JSDOM recorriendo las siete rutas. Consulta `VERIFICACION.md` para el alcance real.

La inspección visual y capturas en un navegador real siguen pendientes: el entorno de construcción no ofrece la herramienta requerida. La implementación incluye breakpoints de escritorio/móvil, pero una prueba DOM no certifica su aspecto en pantalla.

## Publicación

Se utiliza el mismo repositorio y la misma URL de GitHub Pages. `.github/workflows/deploy.yml` instala el lockfile, ejecuta pruebas, compila, verifica el bundle y despliega `dist/`. Pages debe permanecer configurado con **Source → GitHub Actions**. Los usuarios finales solo necesitan Chrome; no deben instalar las herramientas de desarrollo.

## Límites explícitos

- El planificador es una heurística determinista, no un optimizador exacto. Puede requerir aumentar disponibilidad, reducir contenido o ajustar manualmente una sesión. Informa el trabajo que no pudo ubicar.
- Horizonte máximo de generación: 730 días; se avisa si el objetivo queda más lejos. Resolución de cinco minutos.
- Las tareas y eventos de fase 1 no tienen duración; por eso consumen la reserva configurable mencionada arriba. Los descansos del temporizador no se añaden como eventos del calendario.
- Las sesiones manuales se conservan incluso si después cambian las preferencias; se informa de los conflictos y solo se reprograma con confirmación.
- El dominio es una autoevaluación del usuario. No se infiere de minutos ni se presenta como una calificación oficial.
- Los registros locales reales del usuario no son accesibles desde este entorno. La conservación se comprueba con datos de fase 1 en pruebas de migración, sin afirmar una inspección de su navegador personal.
- No se han iniciado las fases 3, 4 o 5.
