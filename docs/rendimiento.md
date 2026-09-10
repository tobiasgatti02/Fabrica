# Fabrica — contrato de rendimiento y protocolo de prueba

**10 de septiembre de 2026 · Diseño de pruebas, todavía sin resultados.** No hay modelos de usuario en el proyecto. Los valores de esta página son objetivos iniciales de ingeniería, no capacidades comprobadas ni límites universales.

## Qué significa “smooth”

La cámara responde durante la carga; la selección no congela la escena; abrir comentarios no produce saltos; el visor mantiene una calidad utilizable tras varios minutos en un teléfono. Una media de FPS alta no alcanza si existen tirones frecuentes.

| Experiencia | Objetivo inicial | Condición |
|---|---|---|
| Landing | LCP ≤ 2,5 s; INP ≤ 200 ms; CLS ≤ 0,1 | Percentil 75, móvil y escritorio separados. La primera imagen y el titular no esperan al 3D. |
| Landing 3D | 60 FPS objetivo en escritorio; calidad adaptada en móvil | Medir durante el recorrido completo, con escena y resolución registradas. |
| Visor escritorio | Mediana cercana a 60 FPS; frame time p95 ≤ 20 ms | Recorrido de 60 s con modelo ya utilizable, a 1920×1080 y escala interna 1. |
| Visor móvil | 60 FPS aspiracional; modo estable de 30 FPS, p95 ≤ 40 ms | Resolución interna limitada; informar el modo usado y medir calentamiento. |
| Primera vista navegable | ≤ 5 s para el caso pequeño preparado | Desde abrir revisión, caché vacía, 20 Mbps y 80 ms RTT; excluye subida y conversión. |
| Tocar un elemento | Confirmación visual p95 ≤ 100 ms | Picking, colocación del pin y apertura de editor; guardado remoto medido por separado. |
| Cámara detenida | Dejar de renderizar continuamente | Puede haber frames por progreso, comentarios o transiciones activas. |

Los umbrales de Web Vitals proceden de [web.dev](https://web.dev/articles/vitals). El resto es una propuesta para Fabrica que se ajustará al corpus. Lighthouse no mide por sí solo la fluidez de navegación 3D; hará falta instrumentación del visor y pruebas manuales.

## Corpus inicial

| Caso | Qué representa | Qué puede fallar |
|---|---|---|
| L — casa de landing | Asset de autoría controlada, con cuatro estados | Transiciones, sombras, texturas y calentamiento durante scroll. |
| S — casa real | Export de SketchUp con interiores y jardín | Instancias, caras invertidas, texturas ausentes y exceso de vegetación. |
| M — interior denso | Muebles detallados, vidrios y muchos materiales | Draw calls, transparencias y memoria de texturas. |
| B — edificio BIM | IFC con varias plantas y propiedades | Carga, selección, filtrado, clipping, IDs y metadatos. |
| X — caso de estrés | Modelo federado o terreno con coordenadas grandes | Particiones, precisión, cancelación de cargas y techo de memoria. |

Empezar con L, S y M; B entra en la prueba BIM temprana y X en la fase de escala. Solicitar o preparar modelos con licencia de uso y guardar sus hashes. Los assets públicos sirven para arrancar, pero un asset de demostración no sustituye el archivo de un estudio.

Para cada archivo registrar: aplicación/exportador y versión, unidades, dimensiones, triángulos totales y visibles, elementos, geometrías únicas, instancias, materiales, texturas y resoluciones, bytes transferidos, tiempo de conversión y advertencias. El tamaño del archivo de origen no predice directamente los FPS.

## Dispositivos y ejecución reproducible

Matriz inicial propuesta: portátil Windows con GPU integrada Intel Iris Xe; MacBook Air M1; iPhone 13 con Safari; Android de gama media como Pixel 7 con Chrome. Confirmar qué equipos tenemos antes de comprometer soporte. Registrar OS, navegador, motor/commit, controladores cuando sean accesibles, alimentación, viewport, DPR, resolución interna y calidad efectiva. Emulación y CPU throttling no equivalen a un móvil real.

1. Probar el mismo modelo, ruta de cámara, iluminación, culling y calidad en Three WebGL 2 y WebGPU. Separar compilación inicial de shaders y navegación posterior.
2. Hacer una carga fría y una caliente, cinco repeticiones por combinación inicial. Reportar mediana, dispersión y peores casos; no sacar un SLA de cinco observaciones.
3. Ejecutar un recorrido reproducible de 60 s: órbita exterior, entrada, giro interior, selección, comentario, sección y cambio de revisión. Registrar frame time p50/p95/p99 y frames de más de 50 ms.
4. Mantener una sesión móvil 10 minutos, repetir recorrido y comparar con el comienzo. Probar cambio de orientación, pestaña oculta y recuperación de pérdida del contexto/dispositivo.
5. Cargar y descargar revisiones diez veces. Estimar recursos retenidos para detectar acumulación; verificar `dispose` y cancelación de trabajos anteriores.
6. Volver a comprobar materiales, unidades, IDs y precisión tras optimizar. La selección debe referir al mismo elemento y las vistas deben conservar su escala.

Separar: **tiempo de subida**, **tiempo de procesamiento**, **tiempo hasta primera vista**, **tiempo hasta interacción** y **tiempo hasta calidad completa**. El usuario necesita estados comprensibles: “Subiendo”, “Preparando modelo”, “Listo para revisar” y errores accionables.

La memoria de GPU no tiene una medición uniforme y exacta entre navegadores. Usar estimaciones de recursos asignados y herramientas específicas disponibles, indicando su método. No comparar directamente un contador de heap JS con VRAM.

## Orden de optimización

Medir → identificar cuello → cambiar una variable → comparar calidad y fluidez. Primera prioridad: texturas/instancias/draw calls, después carga por partes y trabajo en workers; luego calidad adaptativa y optimizaciones específicas del backend. R3F describe reutilización y render bajo demanda; Fragments documenta trabajo fuera del hilo principal. [R3F](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/scaling-performance.mdx), [FragmentsManager](https://github.com/ThatOpen/engine_components/blob/main/packages/core/src/fragments/FragmentsManager/example.ts).

Solo abrir un trabajo de motor propio, Rust/WASM o GPU compute si el perfil demuestra una mejora necesaria y permite una prueba acotada. Que una técnica sea nueva no demuestra que mejore nuestro recorrido.

## Criterio de salida

El prototipo debe completar **abrir → recorrer → comentar → volver a una versión** sin pérdida de contexto ni errores de identidad, dentro de los objetivos del caso S en los dispositivos disponibles. Guardar una tabla de resultados, trazas, capturas y limitaciones. Si solo pasa en escritorio, se declara así y se trabaja en el modo móvil; no se anuncia soporte universal.
