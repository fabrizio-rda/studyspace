# Apuntes de clase en Google Docs

En cada curso, la pestaña **Apuntes de clase** permite crear un Google Doc nuevo o pegar un enlace de un documento existente. Cada referencia tiene título, fecha y curso, usa la colección `documents` existente y también aparece en Biblioteca. No hay migración SQL ni nueva tabla. El texto permanece en Google; no se copia al calendario conjunto ni se comparte con la otra cuenta.

La creación utiliza la autorización existente `drive.file`, sin ampliar scopes. Requiere configurar Google Cloud/Drive en Configuración y conectar la cuenta Google elegida. Solo el clic «Crear y escribir» ejecuta `files.create`; después se comprueban los metadatos. Un fallo al vincular deja visible el enlace del documento creado y permite reintentar sin volver a crearlo. No se borran archivos de Drive. Los cambios de identidad invalidan la creación/lectura en curso y los commits conservan el token del espacio que inició la operación.

El enlace existente solo acepta HTTPS en `docs.google.com/document/d/...` (también `/document/u/N/d/...`). Se guarda una URL canónica y el editor utiliza únicamente ese origen. Esto valida el formato del enlace, no comprueba los permisos del archivo: Google los aplica al abrirlo.

## Edición y límites

Se carga el editor oficial `/edit?embedded=true` en un iframe, con un enlace permanente «Abrir en Google Docs». El funcionamiento del editor privado incrustado depende de la sesión Google, cookies y políticas institucionales. No se publican documentos ni se cambian permisos para conseguir que cargue. El iframe no permite al código de StudySpace inspeccionar el contenido, detectar si se guardó o verificar errores internos de Google. No se presenta como una sincronización de texto propia.

Antes de considerar probada la edición real, conectar una cuenta Google autorizada en StudySpace y comprobar: creación, edición y guardado de un Doc privado, selección por fecha/título, recuperación al recargar y edición desde otro dispositivo. Repetir con la otra identidad; comprobar 390 y 320 px. Las pruebas automatizadas sustituyen las llamadas de Google y verifican URLs, guardado de referencias, duplicados, recuperación y aislamiento; no prueban el editor remoto.

Referencias: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create y https://developers.google.com/workspace/drive/api/guides/api-specific-auth. Google también documenta restricciones de proveedores y permisos en incrustaciones: https://docs.cloud.google.com/data-studio/embed-external-content-in-reports (ese producto exige publicación; no usamos ese mecanismo ni publicamos apuntes).
