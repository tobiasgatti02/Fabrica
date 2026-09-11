# Fabrica

Estudio virtual en español para arquitectos, ingenieros civiles, interioristas y sus clientes. Modelos navegables en la web, entregas versionadas y conversaciones ancladas al espacio.

**Estado al 11 de septiembre de 2026:** documentación de producto y aplicación web en `web/`. La landing incluye una casa original de Blender con GLB/Draco, materiales PBR, construcción guiada por scroll y entrada al interior; `/estudio` incluye login/registro seguro, varios proyectos por profesional, versiones asignadas y nombradas, vistas de cámara guardadas, comentarios generales y espaciales, publicación e importación multipart. Los datos relacionales se guardan en Neon Postgres mediante Drizzle y los archivos grandes permanecen en almacenamiento de objetos. Se probó un DAE exportado desde SketchUp; no hay importadores certificados ni resultados de rendimiento en dispositivos. Ver [estado y límites del Studio](docs/studio-implementacion.md). Ver [implementación de la landing](docs/landing-implementacion.md).

## Recomendación

Empezar con una prueba del recorrido completo: **importar una casa → navegar su interior → comentar un punto → publicar otra entrega → recuperar el contexto anterior**. Ese resultado debe decidir el stack final y el alcance de compatibilidad.

La propuesta inicial evaluaba Astro para la landing y React + Vite para la plataforma. La implementación actual usa **Vinext + React + TypeScript**, con **React Three Fiber, Drei y GSAP ScrollTrigger** en la landing, y Three.js en el visor. El pipeline asíncrono de importación sigue pendiente. WebGL 2 sirve como referencia de compatibilidad; WebGPU se compara con el mismo corpus. Three.js ofrece fallback entre backends, pero su propia guía todavía documenta limitaciones del renderer nuevo. [Three.js](https://threejs.org/manual/en/webgpurenderer).

La fluidez se consigue preparando geometría y texturas, reutilizando instancias, cargando solo lo necesario, trabajando fuera del hilo principal y adaptando la calidad. **60 FPS es un objetivo medible, no una promesa universal.** Los modelos grandes necesitan su propia estrategia de particiones y memoria.

SketchUp y GLB son el punto de partida recomendado para casas/interiores. IFC se prueba temprano para BIM. AutoCAD DWG/DXF requiere diferenciar dibujos 2D y modelos 3D; RVT, PLN, 3DM y los archivos de render tienen rutas y restricciones propias. La matriz de importación distingue capacidades documentadas de integración aún pendiente.

La landing contará una casa cálida que evoluciona con el scroll: **cimientos → construcción → pintura/materiales → interior**. La escena se produce especialmente para esa narrativa. La plataforma dará protagonismo al modelo, a las revisiones y al comentario del cliente, con una interfaz más contenida.

## Desarrollo local

La aplicación requiere Node.js 22.13 o posterior. Dentro de `web/`, copiá `.env.example` a `.env.local`, reemplazá los valores por las conexiones pooled y direct de tu proyecto de Neon y ejecutá:

```bash
npm install
npm run db:migrate
npm run dev
```

`DATABASE_URL` es la conexión pooled usada por la aplicación. `DATABASE_URL_UNPOOLED` es la conexión directa reservada para migraciones. Ninguno de los dos secretos se versiona.

## Documentos y orden de lectura

| Documento | Qué resuelve |
|---|---|
| [Producto](docs/producto.md) | Audiencias, flujos, navegación, landing y alcance inicial. |
| [Plan de trabajo](docs/plan-de-trabajo.md) | 24 tareas con prioridades por etapa, dependencias y criterios de aceptación. |
| [Arquitectura](docs/arquitectura.md) | Stack candidato, alternativas, preparación de archivos, anotaciones y operación. |
| [Rendimiento](docs/rendimiento.md) | Objetivos, corpus, dispositivos, protocolo y criterio de salida. |
| [Importación y ecosistema](docs/investigacion/importacion-y-ecosistema.md) | Herramientas, formatos, pérdidas, licencias y rutas de integración. |
| [Producto y referencias visuales](docs/investigacion/producto-y-direccion-visual.md) | Competidores, referencias aportadas y oportunidades de experiencia. |

Los documentos de producto, arquitectura y plan consolidan las decisiones propuestas; las investigaciones aportan evidencia. Toda ruta de importación está pendiente de pruebas en Fabrica. Las fuentes se consultaron en la fecha indicada; una página accesible hoy puede documentar versiones anteriores, señaladas donde corresponde.

## Qué construir primero

Etapa 0: banco de prueba 3D y primera ruta SketchUp. Etapa 1: dirección visual, asset de la casa y landing. Etapa 2: plataforma completa con cuentas, procesamiento, versiones y feedback. Etapa 3: ampliar interoperabilidad y escala según las pruebas y el piloto.

El diferencial propuesto es la calidad de presentación y la claridad de la revisión con clientes. Versiones y comentarios espaciales ya existen en otras herramientas; la oportunidad debe validarse con usuarios. La investigación acotada se delegó a dos agentes de menor coste y sus resultados se consolidaron aquí.
