# Landing de Fabrica — producción de assets y scroll

Revisión del 10 de septiembre de 2026. La landing conserva Vinext/React, React Three Fiber, Three.js y GSAP ScrollTrigger. La escena anterior de primitivas JSX se sustituyó por assets originales producidos en Blender 4.5.11, con materiales PBR y geometría comprimida en Draco.

## Decisión tecnológica

El realismo depende de la geometría, texturas, iluminación y cámara. Cambiar la librería de scroll por sí solo no resuelve una casa sin detalle. Se conserva el motor existente y se reemplaza su contenido visual.

- **Blender → GLB + R3F/Three + GSAP:** elegido para mantener cámara continua, reversibilidad, etapas de montaje y respuesta sutil del interior al mouse. glTF transporta geometría, materiales y metadatos de montaje. [Khronos glTF](https://www.khronos.org/gltf/), [exportador Blender](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html), [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/).
- **Secuencia de renders o video:** permite recorrer arbitrariamente una timeline fija con scroll y ofrece iluminación offline de mayor calidad. No permite producir nuevas vistas de cámara libres. No se adoptó como motor principal; la alternativa sin WebGL usa siete renders discretos del mismo modelo.
- **WebGPU:** no es necesario para esta escena. La decisión no depende de soporte experimental.

La investigación de tecnologías y alternativas se delegó a GPT-5.6 Luna a pedido del usuario.

## Assets entregados

| Asset | Contenido |
|---|---|
| `assets/casa-patio/casa-patio.blend` | Modelo editable, materiales empaquetados, cámaras y luces de referencia. |
| `scripts/build-casa-patio.py` | Fuente reproducible de modelado, agrupación, exportación y renders. Semilla fija. |
| `scripts/fetch-casa-materials.py` | Descarga de mapas CC0 con manifiesto de procedencia. No se usa la API durante la visita. |
| `web/public/models/casa-patio-exterior.glb` | Terreno, olivos, cimientos, perfiles de acero, muros, cubierta, aberturas, listones, pavimentos, estanque y plantación. 36 unidades de montaje. |
| `web/public/models/casa-patio-interior.glb` | Sofá y almohadones biselados, alfombra, mesa, cerámica, cocina, isla, taburetes, cortina plegada, relieve mural y luminaria. |
| `web/public/environment/rosendal-plains-1k.hdr` | Entorno HDR local para luz y reflejos. |
| `web/public/draco/` | Decoder local. La escena no depende de un CDN de terceros. |
| `web/public/images/casa-patio-*.webp` | Siete renders Cycles: terreno, cimientos, estructura, envolvente, terminaciones, exterior completo e interior. |

Geometría original de Fabrica creada en esta tarea. Materiales de [Poly Haven](https://polyhaven.com/license), CC0: [Concrete Wall 006](https://polyhaven.com/a/concrete_wall_006), [Oak Wood Planks](https://polyhaven.com/a/oak_wood_planks), [Fabric Pattern 07](https://polyhaven.com/a/fabric_pattern_07), [Rosendal Plains 2](https://polyhaven.com/a/rosendal_plains_2). Se usan normal y rugosidad de la tela con color ecru uniforme. URLs y mapas exactos en `assets/casa-patio/sources.json`. Texturas a 1K, UVs con escala física. No se usó ImageGen.

## Coreografía

| Scroll | Montaje |
|---|---|
| 0–15% | Terreno y árboles existentes; trazado del replanteo. |
| 15–30% | Zapatas, vigas de fundación y platea por separado. |
| 30–45% | Columnas y vigas metálicas en orden. |
| 45–62% | Paneles de muro y cassette de cubierta; encastre desde arriba. |
| 60–79% | Aberturas, revestimientos, piso, paisajismo y mobiliario. |
| 79–84% | Casa completa, pausa de lectura. |
| 84–94% | Cámara se acerca y baja a altura de los ojos frente a la abertura. |
| 94–100% | Entrada al estar por el vano libre central; CTA y detalles del interior. |

Las piezas mantienen sus dimensiones: se trasladan e instalan, sin escalar su altura. La progresión se suaviza fuera del render React y se puede invertir. Las etapas se definen en los extras de cada nodo del GLB. La cámara tiene una función compartida verificable (`camera-path.ts`).

## Carga y rendimiento

- Exterior: 3.83 MB, 94.806 triángulos, 53 primitivas. Interior: 2.40 MB, 25.480 triángulos, 8 primitivas. Conteos del GLB, no mediciones de draw calls en GPU.
- Póster WebP liviano visible durante la carga; la escena empieza en el mismo terreno.
- El interior comienza a descargarse a partir del 48% del scroll, antes de mostrarse al 71–79%.
- Render bajo demanda, DPR máximo 1,25 móvil / 1,5 escritorio; sombras 1024 / 2048. Piezas agrupadas por unidad de montaje y material. [R3F: escalado de rendimiento](https://r3f.docs.pmnd.rs/advanced/scaling-performance).
- Entorno HDR y sol con sombras. Vidrio con reflejo y transparencia, sin refracción adicional en runtime. Tonemapping AgX. Los renders offline usan Cycles.
- Movimiento reducido: montaje discreto por etapa, cámara exterior quieta y cambio al interior al final. Se elimina el seguimiento del mouse.
- Si falla WebGL, un asset o el contexto, siete imágenes del mismo modelo mantienen capítulos, navegación y CTA. Es una alternativa por etapas; no reproduce una animación continua.
- No se hornearon lightmaps/AO ni se convirtió a KTX2. No se promete equivalencia entre iluminación Cycles offline y WebGL en tiempo real. KTX2 sería una optimización posterior de memoria GPU, distinta de Draco. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [KTX](https://www.khronos.org/ktx/).

## Verificación

TypeScript, build de producción, estructura binaria del GLB, decodificación de las 61 primitivas con el WASM Draco distribuido y metadatos de 36 unidades de montaje. Se verificaron 20.002 posiciones de cámara en móvil/escritorio, continuidad y paso libre bajo la cubierta y entre los vidrios. Renders de assets inspeccionados para corregir materiales y vegetación. Vista local devuelve HTTP 200.

No se realizó QA visual del navegador ni medición de FPS en teléfonos físicos. El render offline de un asset no demuestra su velocidad ni apariencia exacta en WebGL.

## Regeneración

Desde la raíz: `python3 scripts/fetch-casa-materials.py`, seguido de `blender -b --python scripts/build-casa-patio.py -- --render`. Omitir `--render` para regenerar solo el modelo y los GLB. Blender no hace falta para ejecutar la landing.

Desde `web/`: `node scripts/check-scene.mjs` verifica la cámara y los GLB. El servidor local normal conserva ambas rutas `/` y `/estudio`.
