# Studio: revisión, importación y entregas

Actualizado el 11 de septiembre de 2026. Disponible en la vista local `/estudio`.

## Flujos implementados

- Acceso con email y contraseña o con ChatGPT. El registro guarda PBKDF2-SHA-256 con salt único, nunca la contraseña original; la sesión usa una cookie `HttpOnly`, `SameSite=Lax` y `Secure` en HTTPS. El campo permite ver u ocultar la contraseña y comunica su fortaleza antes de crear la cuenta.
- Cada identidad profesional puede crear varios proyectos y alternarlos desde la cabecera. Cada proyecto conserva su propio enlace de revisión. Quien accede por ese enlace puede leer entregas publicadas y comentar, pero no importar, publicar, crear vistas ni resolver.
- El importador exige elegir el proyecto y nombrar la entrega. Las entregas nacen como borradores, se publican de forma explícita y siempre pertenecen al proyecto seleccionado.
- Comentarios separados en dos alcances: “Todo el proyecto”, visible en todas sus entregas, y “Punto elegido”, guardado con versión, superficie, coordenadas y cámara. Cada comentario se resuelve individualmente para no cerrar por accidente otros puntos de la misma superficie.
- Cámara orbital libre, desplazamiento, zoom, rotación automática, cinco vistas base y vistas guardadas por versión. Un profesional puede nombrar la posición actual de cámara y publicarla junto con esa entrega.
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
- Prueba de integración `web/tests/studio-api.mjs`: proyectos independientes, dos partes reales (8 MiB + 53 bytes), igualdad SHA-256 de descarga, archivos vacíos/excesivos rechazados, cancelación, borradores ocultos, publicación, vistas guardadas, comentarios generales y espaciales, permisos de cliente y resolución individual.
- Prueba de registro, cierre de sesión y nuevo login contra la API local; los datos temporales de esa prueba se eliminaron al finalizar.
- Lectura del modelo SketchUp y del importador mediante DOMParser de LinkeDOM en un entorno de prueba temporal; sin agregar dependencias a la aplicación.
- Migraciones Drizzle para Neon Postgres generadas, inspeccionadas y aplicadas a la rama de desarrollo configurada.
- No se hizo QA visual automatizada en navegador ni se verificó el login del sitio alojado. El acceso y las invitaciones del sitio siguen sujetos a su política privada de Sites.

Para repetir la integración: levantar el servidor de desarrollo en `http://localhost:3000` y ejecutar `node tests/studio-api.mjs` desde `web`. Usa una identidad de prueba aislada y deja registros de prueba en la base local de esa identidad.
