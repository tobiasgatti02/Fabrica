# Studio: revisión, importación y entregas

Implementado el 10 de septiembre de 2026. Disponible en la vista local `/estudio`; estos cambios no se publicaron en el sitio alojado.

## Flujos implementados

- Selector de entrada: cliente o profesional (arquitectura/interiorismo). En desarrollo se identifica explícitamente como prueba local. El build alojado usa el inicio de sesión de ChatGPT proporcionado por Sites; no incluye la identidad de desarrollo.
- Cada identidad tiene un proyecto propio. El enlace de revisión contiene un token del proyecto y exige identidad. Quien accede por ese enlace puede leer entregas publicadas y comentar, pero no importar, publicar ni resolver. El propietario puede revisar su proyecto como cliente; esa elección de interfaz no modifica sus permisos de propietario.
- Entregas importadas inicialmente como borradores, publicación explícita, selector de versiones y filtrado de comentarios por entrega. V02/V03 son dos variantes de materiales del proyecto de ejemplo.
- Comentarios con coordenadas locales sobre el modelo, recuperación del punto al seleccionarlos, filtro por superficie o toda la versión y resolución limitada a la versión/superficie. Guardado en D1; actualización cada 15 segundos mientras la página está visible y al recuperar el foco.
- Cámara orbital libre, desplazamiento, zoom, rotación automática, cinco vistas, regreso a la vista elegida y alternancia de pantalla completa. Las transiciones dejan de controlar la cámara cuando comienza un gesto manual.
- Panel de comentarios recuperable en escritorio y móvil, con estado accesible y contenido oculto fuera de la navegación por teclado.

## Importación real y límites

El visor incluye cargadores bajo demanda para GLB/glTF (incluido Draco), DAE, OBJ con MTL, FBX, STL, PLY y 3DS. Se selecciona un archivo principal y sus recursos, o se arrastran juntos. Las referencias externas se resuelven contra los archivos incluidos, sin descargar recursos arbitrarios citados por un modelo. Nombres duplicados se rechazan para evitar resolver una textura equivocada.

Se conservan archivos originales de cualquier extensión, incluidos SKP, RVT, PLN, DWG e IFC, pero **no hay conversores nativos para estos formatos**. Una extensión aceptada para almacenamiento no equivale a compatibilidad de visualización. Las exportaciones deben usar uno de los formatos implementados; las rutas particulares de cada aplicación y versión todavía requieren más modelos de prueba.

Almacenamiento R2 mediante partes de 8 MiB, tres intentos por parte, validación de tamaño, cancelación de la subida activa e integridad al completar. Límite deliberado de aplicación: 5 GiB por archivo, hasta 200 archivos por entrega. El servidor no lee el archivo completo en memoria. Una subida interrumpida al cerrar la pestaña no se reanuda entre sesiones. Las subidas completadas sin una versión final pueden dejar objetos huérfanos; para producción falta un trabajo de limpieza y cuotas por cuenta.

El visor abre entregas de hasta 200 MiB combinados. Las mayores quedan almacenadas y descargables, con un aviso de que requieren una copia optimizada. Este umbral no certifica rendimiento: un archivo pequeño también puede expandirse a mucha geometría o memoria de texturas. Faltan conversión en segundo plano, particiones/LOD, carga por demanda, límites de memoria y pruebas en dispositivos reales. No se promete peso ilimitado ni 60 FPS.

GLB autocontenido es la ruta más simple para distribución. Los materiales, animaciones y metadatos BIM no están certificados entre aplicaciones. Los archivos se ajustan al visor con una transformación de presentación; no hay herramientas de medición ni garantía de unidades de medición en la interfaz.

## Prueba de SketchUp

Ejemplo real: silla de `gazebo_plugins/Media/models/chair`, repositorio público `ros-simulation/gazebo_ros_pkgs`, rama `noetic-devel`. El DAE declara `Google SketchUp 7.0.8657` y contiene unidades en pulgadas y eje Z superior. Se incluye con `texture0.jpg` y `texture1.jpg`, accesible mediante «Probar ejemplo de SketchUp» en el espacio profesional.

El cargador de producción leyó 22 mallas y 810 triángulos. La caja física antes de ajustar al visor mide aproximadamente 0,416 × 0,902 × 0,482 metros. Pasaron la resolución de recursos y la detección de texturas ausentes. Se comprobó además importación OBJ y rechazo de geometría vacía. No se ejecutó SketchUp ni se importó SKP directamente. Las pruebas de lectura no equivalen a una certificación visual de materiales o rendimiento GPU.

Fuentes:
- [DAE original](https://github.com/ros-simulation/gazebo_ros_pkgs/blob/noetic-devel/gazebo_plugins/Media/models/chair/models/Chair.dae).
- [SketchUp: trabajar con GLTF](https://help.sketchup.com/en/sketchup/working-gltf-files).
- [SketchUp: interoperabilidad](https://help.sketchup.com/en/sketchup/using-sketchup-data-other-modeling-programs-or-tools).
- [Three.js: FBXLoader](https://threejs.org/docs/pages/FBXLoader.html).

## Verificación

- TypeScript y build de producción completados.
- Prueba de integración `web/tests/studio-api.mjs`: dos partes reales (8 MiB + 53 bytes), igualdad SHA-256 de descarga, archivos vacíos/excesivos rechazados, cancelación, borradores y archivos ocultos al cliente, publicación, comentario del cliente y resolución que no modifica otra versión.
- Lectura del modelo SketchUp y del importador mediante DOMParser de LinkeDOM en un entorno de prueba temporal; sin agregar dependencias a la aplicación.
- Migración D1 generada e inspeccionada y aplicada únicamente a la base local. El despliegue debe aplicar la migración incluida antes de servir las rutas persistentes.
- No se hizo QA visual automatizada en navegador ni se verificó el login del sitio alojado. El acceso y las invitaciones del sitio siguen sujetos a su política privada de Sites.

Para repetir la integración: levantar el servidor de desarrollo en `http://localhost:3000` y ejecutar `node tests/studio-api.mjs` desde `web`. Usa una identidad de prueba aislada y deja registros de prueba en la base local de esa identidad.
