# Verificación — StudySpace, fase 2

15 de octubre de 2026. Mismo repositorio y URL de fase 1.

## Resultados locales

**41 pruebas automatizadas** en cinco archivos: 14 del planificador/tiempo/repasos, 6 de migración, 7 de almacenamiento/fechas, 7 recorridos de fase 1 y 7 recorridos de estudio de fase 2. Se ejecutaron con Vitest, Testing Library y JSDOM. Compilación TypeScript/Vite correcta.

| Escenario solicitado           | Evidencia                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear unidad, tema y subtema   | Recorrido UI: creación, dominio, tema completado y recarga.                                                                                                       |
| Editar dominio                 | La prueba cambia «Lo domino» explícitamente y comprueba que otro tema completado sigue sin dominarse.                                                             |
| Crear plan y generar sesiones  | Asistente completo; se comprueba que no existe nada guardado antes de confirmar la vista previa.                                                                  |
| Disponibilidad diaria          | Algoritmo: nunca supera el límite configurado; respeta días de descanso y máximos del plan.                                                                       |
| Tiempo compartido entre planes | Algoritmo con dos planes: no multiplica el presupuesto y avisa de los minutos que no caben.                                                                       |
| Calendario                     | Recorrido UI: sesiones visibles y apertura de su información; las pruebas de fase 1 siguen comprobando exámenes sin duplicación.                                  |
| Reprogramación                 | Recorrido UI: cambia fecha y duración de una sesión, conserva su ID y la marca manual.                                                                            |
| Iniciar, pausar y reanudar     | UI con marcas temporales: se comprueban segundos reales tras una pausa y reanudación.                                                                             |
| Completar sesión y tiempo real | UI: guarda 150 segundos y notas; no utiliza la duración prevista como tiempo real.                                                                                |
| Progreso de plan               | Se comprueba el avance por tiempo completado, conservando trabajo pendiente.                                                                                      |
| Próxima fecha de repaso        | Intervalos comprobados para autoevaluaciones distintas; historial y contador de repasos reales.                                                                   |
| Tu plan de hoy                 | UI: sesión, motivo y acciones visibles; al posponer, desaparece de hoy y sigue en la fecha nueva.                                                                 |
| Persistencia                   | Temario conservado al desmontar/montar; temporizador recuperado pausado sin inventar una sesión completa.                                                         |
| Exportación/importación        | Copias válidas, inválidas y canceladas; roundtrip con unidades, temas, planes, sesiones, logs, historial y temporizador.                                          |
| Datos de fase 1                | Igualdad exacta de cursos, tareas, eventos y preferencias al migrar. Primera copia de recuperación byte por byte. Fallo de cuota impide sobrescribir el original. |
| Fechas límite y pasado         | Algoritmo: sin nuevas sesiones en horas pasadas ni después del objetivo; aviso para planes vencidos.                                                              |
| Regeneración                   | Determinismo, ausencia de duplicados y conservación de completadas, manuales y sesión del temporizador activo.                                                    |
| Actividades previas            | Reserva diaria y bloqueo horario por actividad; no cambia las tareas existentes.                                                                                  |
| Repasos recurrentes            | Se genera el siguiente repaso espaciado aun después de completar la cuota inicial del plan; sin duplicados tema/fecha.                                            |
| Pomodoro                       | Descanso largo cada cuatro bloques y exclusión de descansos del tiempo de estudio.                                                                                |
| Esquema                        | Rechazo de referencias rotas, jerarquías cíclicas, versiones incompatibles e IDs duplicados.                                                                      |

El bundle real compilado se ejecuta además mediante `npm run test:production` y recorre siete rutas sin errores de ejecución. Esto no equivale a una inspección visual de Chrome.

## Alcance y publicación

El workflow de GitHub Actions ejecuta las mismas pruebas y compilación antes de publicar. La entrega se confirma comprobando que `build` y `deploy` terminan correctamente y que la página y sus recursos coinciden con la compilación. El resultado remoto y el enlace de la versión se comunican al finalizar la publicación.

- Aplicación: https://fabrizio-rda.github.io/studyspace/
- Código: https://github.com/fabrizio-rda/studyspace
- Historial de despliegues: https://github.com/fabrizio-rda/studyspace/actions

**Pendiente de revisión visual real:** capturas, medidas de layout, contraste final y experiencia en escritorio/móvil. Se implementaron estilos responsive y navegación móvil; el entorno no ofrece la herramienta de navegador requerida para esa inspección. No se generaron imágenes que simulen capturas ni se presenta JSDOM como navegador real.

La migración se verificó con datos representativos de fase 1. No hay acceso a los datos locales del navegador personal del usuario; por tanto, no se afirma haber leído o inspeccionado esos registros.

## Limitaciones prácticas

La disponibilidad depende de lo que se configure. Las duraciones de preparación son estimaciones; la reserva por tarea/actividad es configurable porque el modelo antiguo no tiene duración. El planificador utiliza bloques de cinco minutos y un horizonte máximo de 730 días; avisa del trabajo que no cabe. No convierte una sesión en dominio automáticamente. Un cierre abrupto puede perder los últimos segundos desde la marca de recuperación de 15 segundos, pero no añade tiempo ausente ni completa sesiones por su cuenta. Los descansos no se programan como eventos.

No hay sincronización externa, Google Drive, Supabase, autenticación, Classroom ni funciones de las fases 3–5.
