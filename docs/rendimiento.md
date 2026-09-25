# Fabrica — contrato de rendimiento y protocolo de prueba

**10 de septiembre de 2026 · Objetivos iniciales; auditoría local agregada el 24 de septiembre.** No hay modelos de usuario en el proyecto. Los valores de esta página son objetivos iniciales de ingeniería, no capacidades comprobadas ni límites universales.

## Auditoría local del 24 de septiembre de 2026

Las primeras mediciones fueron cinco solicitudes en caliente por ruta contra `localhost:3000` (Vinext en desarrollo), con `curl` y la mediana. Se repitieron tras corregir una lectura repetida de sesión y tras recuperar el fallback de carga del área. Incluyen la conexión local y, en las APIs, la base remota. **El primer byte mide la respuesta inicial; el HTML completo mide la llegada de los datos. Ninguno reemplaza el tiempo hasta contenido visible o interacción.** No se midió ese tiempo en navegador antes del cambio.

| Medida local | Antes | Ahora | Interpretación |
|---|---:|---:|---|
| Panel, primer byte HTML | 23 ms, estructura vacía | 62 ms, cabecera y un skeleton del área | El contenido todavía depende de la base. |
| Panel, HTML completo | 23 ms, estructura vacía | 398 ms, contenido inicial | Antes se iniciaba una API de 369 ms después de cargar JS; falta medir el instante de contenido visible anterior. |
| Inspiración, primer byte HTML | 23 ms, estructura vacía | 52 ms, cabecera y un skeleton del área | El contenido todavía depende de la base. |
| Inspiración, HTML completo | 24 ms, estructura vacía | 397 ms, contenido inicial | La API anterior tardaba 392 ms después de cargar JS. |
| Equipo, primer byte / HTML completo | Sin medición anterior | 53 ms / 390 ms | Un skeleton del área precede al contenido. |
| Modelo 3D, primer byte HTML | 37 ms | 35 ms | Diferencia pequeña; el visor conserva un único estado de preparación. |
| Modelo 3D, API de datos completa | 1135 ms | 560 ms | Comparación equivalente: versiones, comentarios, mediciones y planos se leen en paralelo. |
| Landing, primer byte HTML | 26 ms | 23 ms | Diferencia pequeña. |
| Catálogo público | 195 ms | 200 ms | 5 ms de diferencia no son evidencia de regresión; hay variación de red/base. |

En Panel, Inspiración y Equipo el servidor envía pronto el shell con un único skeleton del área y continúa leyendo la base remota. Los enlaces entre áreas usan la navegación cliente de Vinext: el encabezado permanece, solo cambia el contenido y el skeleton aparece durante la transición. La lectura de sesión ya resuelta en la página se reutiliza al preparar los datos, evitando una consulta repetida para usuarios autenticados. Esta mejora de código no tiene aún una medición aislada con sesión real. La variación de la base es visible: una repetición anterior de la API del panel dio 553 ms. El HTML completo crece al transportar los datos. Para decidir si la experiencia completa mejoró, falta comparar FCP, LCP y tiempo hasta interacción con la misma sesión, red y dispositivo, en cargas frías y calientes. `curl` no mide esos resultados.

La landing ya tenía imágenes para el primer cuadro, pero no las dibujaba durante la preparación de WebGL. Se añadió un `picture` visible desde el HTML (40 KB escritorio, 7,5 KB móvil), y se quitaron cuatro preloads de recursos 3D que sumaban aproximadamente 5,4 MB entre GLB y HDR, más decodificadores. La escena empieza después de una oportunidad de inactividad o al interactuar; con ahorro de datos se usa el recorrido en imágenes. Esto mejora la prioridad del primer contenido, pero no reduce necesariamente el total transferido cuando el usuario usa el 3D.

GSAP y ScrollTrigger dejaron de estar en el chunk inicial de la landing. En el build, ese chunk pasó de 126,8 KB a 14,1 KB sin comprimir (48,4 KB a 5,0 KB con gzip); las dos bibliotecas se descargan aparte tras la hidratación. Se comprobó que el botón del recorrido sigue avanzando de la primera a la segunda etapa.

En el estudio se usa el mismo diseño de skeleton para la carga de ruta y de vista, de modo que no aparezcan dos estados distintos. Panel y Equipo entregan su vista y sus datos juntos desde el servidor; Inspiración conserva su carga local cuando corresponde. Modelo 3D usa solo su estado de preparación hasta recibir los datos. Configuración abre un modal sobre la vista actual en lugar de navegar al modelo. Los enlaces compartidos e invitaciones mantienen su flujo. La cabecera, el aviso de renovación y facturación comparten una misma lectura concurrente de estado; las actualizaciones de pagos fuerzan una lectura nueva.

Fuentes que guiaron los cambios: [Next.js sobre streaming y `loading.tsx`](https://nextjs.org/docs/app/getting-started/linking-and-navigating), [Next.js sobre Cache Components y límites de Suspense](https://nextjs.org/docs/app/getting-started/partial-prerendering), [estado actual de compatibilidad de Vinext](https://github.com/cloudflare/vinext), [post de Jared Palmer en X sobre una migración con PPR](https://x.com/jaredpalmer/status/1912119848521314366) y [post de Andrew Clark en X sobre streaming SSR](https://x.com/acdlite/status/1549853625673023488). Los resultados de otras apps no se extrapolaron a Fabrica. Vinext indica que `cacheComponents`/PPR completo sigue incompleto; por eso no se activó globalmente.

Verificación: `npm run build` pasa. `npx tsc --noEmit` sigue fallando en cuatro accesos preexistentes a `WorkspacePermissions.propuestas` en `workspace-proposals.tsx`; no provienen de esta auditoría. Falta un benchmark de producción con sesión autenticada y un corpus de proyectos reales para cerrar los objetivos de la tabla siguiente.

## Cómo comparar la carga completa

La unidad de comparación debe ser **abrir una ruta y llegar a contenido utilizable**, no solamente recibir el primer byte. Para Panel registrar TTFB, FCP, LCP, el instante en que aparecen los indicadores y el instante en que se pueden usar las pestañas. Para Modelo 3D registrar además cuándo se ven las versiones, cuándo aparece la primera imagen del modelo y cuándo responde la cámara. Para las acciones ya cargadas, medir la latencia al abrir Configuración, cambiar de proyecto y pasar entre áreas; Lighthouse no produce INP sin interacciones.

Usar el mismo build de producción, base de prueba, cuenta, proyecto, navegador, viewport, red y estado de caché. Separar escritorio y móvil, primera visita con recorrido guiado y visita posterior, carga fría y caliente. Hacer al menos cinco corridas **secuenciales** por caso y guardar mediana, p75, dispersión, captura de red y el elemento LCP; comparar los mismos casos antes y después. En producción, añadir medición real de LCP, INP y CLS por ruta y dispositivo, sin enviar datos privados del proyecto. [Guía de medición de Web Vitals](https://web.dev/articles/vitals-measurement-getting-started).

Como prueba exploratoria se ejecutó Lighthouse 12.8.2 en Chrome de escritorio contra Vinext **en desarrollo**, una vez por estado. En Panel con el recorrido de primera visita, Lighthouse tomó el texto del modal como LCP y registró **8,09 s**. En la misma ruta con el recorrido omitido (`?share=` vacío solo para esta prueba local), el LCP fue el título “Resumen del estudio”: **1,53 s**; FCP **1,11 s**, TBT **49 ms**, CLS **0**. Estas dos corridas no son un benchmark antes/después ni representan usuarios reales. El servidor de producción local sin sesión mostró el formulario de acceso, por lo que medirlo como si fuera Panel daría un resultado inválido. Falta una cuenta de prueba autenticada para el benchmark de producción.

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
