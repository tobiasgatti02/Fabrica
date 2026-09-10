# Fabrica — plan de trabajo

**10 de septiembre de 2026.** Investigación inicial terminada; las tareas de implementación de abajo están pendientes. Este plan consolida las recomendaciones de las investigaciones. Prioridad: probar el recorrido completo y su rendimiento antes de ampliar el producto.

Tamaños relativos: **S** = tarea acotada; **M** = componente con integración; **L** = trabajo que debe dividirse antes de implementar. No son estimaciones de calendario: faltan modelos reales, equipo, cotizaciones y pruebas.

## Etapa 0 — demostrar la viabilidad

| ID | Tarea pendiente | Tamaño | Depende de | Criterio de aceptación |
|---|---|---|---|---|
| F-01 | Preparar corpus y matriz de dispositivos | S | — | Casa, interior y caso BIM identificados, con permisos de uso, hashes, unidades y versiones. |
| F-02 | Crear banco de prueba del visor | M | F-01 | Mismo recorrido medible en WebGL 2 y WebGPU, con métricas reproducibles y registro de calidad. |
| F-03 | Abrir GLB y navegar exterior/interior | M | F-02 | Órbita, zoom, pan, recorrido, tacto, vistas y recuperar orientación funcionan. |
| F-04 | Probar importación desde SketchUp | L | F-01 | Una ruta SKP directa o exportación explícita produce un resultado fiel y repetible; documentar requisitos, licencia e IDs. |
| F-05 | Probar un comentario espacial entre dos revisiones | M | F-03, F-04 | Pin con cámara y elemento; vuelve a su revisión; un elemento borrado no recibe un ancla incorrecta. |
| F-06 | Probar IFC → Fragments | M | F-01, F-02 | Geometría, propiedades, selección, sección y uso de memoria evaluados; comprobar convivencia con renderer y UI. |
| F-07 | Resolver decisión técnica con evidencia | S | F-02 a F-06 | Informe con resultados, limitaciones por dispositivo, formato inicial y motor elegido. |

**Salida:** prueba “abrir → recorrer → comentar → volver a versión” y resultados del [protocolo](rendimiento.md). Puede haber una demo local antes de completar toda la plataforma. Si falla el móvil, se optimiza esa ruta antes de comunicar compatibilidad general.

## Etapa 1 — dirección visual y landing

La exploración visual puede empezar junto con la etapa 0. La promesa pública depende de F-07.

| ID | Tarea pendiente | Tamaño | Depende de | Criterio de aceptación |
|---|---|---|---|---|
| F-08 | Definir identidad y sistema tipográfico | M | — | Dos direcciones breves, elección coherente, escala, contraste, tipografías y licencias verificadas. |
| F-09 | Producir la casa y su storyboard | L | F-08 | Asset propio/autorizado, cimientos/estructura/materiales/interior separables, trayectoria y versiones ligeras. |
| F-10 | Implementar landing en español | M | F-08, F-09 | Narrativa corta, responsive, scroll reversible, demo/CTA claros y estados reales. |
| F-11 | Ajustar movimiento, accesibilidad y rendimiento | M | F-07, F-10 | Teclado, saltar recorrido, movimiento reducido, móvil y presupuestos de carga verificados. |

**Salida:** landing revisable con la casa funcionando y un proyecto de muestra. Un formulario solo se publica cuando exista un destino de datos probado; no simular envíos correctos.

## Etapa 2 — plataforma y piloto

| ID | Tarea pendiente | Tamaño | Depende de | Criterio de aceptación |
|---|---|---|---|---|
| F-12 | Montar cuentas, espacios de estudio y permisos | M | F-07 | Roles y aislamiento entre dos estudios comprobados; invitaciones y revocación funcionales. |
| F-13 | Construir subida y procesamiento asíncrono | L | F-04, F-07, F-12 | Subida reanudable, cola, progreso, reintentos, informe de importación y cuota; último modelo válido se conserva ante error. |
| F-14 | Persistir proyectos y entregas | M | F-12, F-13 | Revisiones inmutables, vistas iniciales, publicación explícita y restauración de contexto. |
| F-15 | Completar comentarios y actividad | M | F-05, F-14 | Cliente crea/responde; estudio resuelve; anclas por revisión, autoría y concurrencia controladas. |
| F-16 | Crear pantalla de proyecto y experiencia móvil | L | F-03, F-08, F-14, F-15 | Navegación y feedback utilizables en escritorio y móvil; versiones y comentarios comprensibles. |
| F-17 | Compartir proyecto con el cliente | M | F-12, F-16 | Enlaces revocables; permisos de ver/comentar/descargar alcanzan también todos los recursos 3D. |
| F-18 | Hacer piloto con estudios y clientes | M | F-11, F-17 | Revisiones reales observadas, problemas priorizados, costes de conversión/almacenamiento/entrega medidos. |

**Salida:** MVP probado de extremo a extremo. El alcance inicial integra la ruta SketchUp seleccionada y GLB; IFC se incorpora según F-06 y demanda del piloto. No anunciar importación nativa cuando solo existe un procedimiento de exportación.

## Etapa 3 — interoperabilidad y escala

| ID | Tarea pendiente | Tamaño | Depende de | Criterio de aceptación |
|---|---|---|---|---|
| F-19 | Certificar IFC para Revit/Archicad y estudiar RVT directo | L | F-06, F-18 | Matriz de versiones, propiedades, materiales e IDs; APS/ODA comparados con archivos y cotización aplicable. |
| F-20 | Añadir AutoCAD DWG/DXF | L | F-18 | Rutas separadas 2D/3D, bloques/XRefs/proxies/unidades verificados; requisitos y pérdidas visibles. |
| F-21 | Conectores de autoría y Rhino/Blender | L | F-18 | Prioridad según uso observado; licencias por paquete; reimportación con identidad estable cuando sea posible. |
| F-22 | Comparar revisiones y exportar incidencias | L | F-15, F-18 | Comparación por cámara; después diff fiable donde haya correspondencia; BCF validado con otra herramienta. |
| F-23 | Escalar edificios, jardines y civil | L | F-18, F-19 | Carga por partes, límites de memoria, vegetación y georreferencia; LandXML si civil lo demanda. |
| F-24 | Experimentos de I+D | S por experimento | Cuello medido | Hipótesis, tiempo acotado y criterio de descarte para GPU compute, splats, WASM o render remoto. |

Las tareas L se dividen por formato o capacidad antes de comenzar. Un renderer alternativo se adopta si mejora la experiencia observada sin perder selección, materiales y anotaciones.

## Uso de modelos y presupuesto de trabajo

La investigación inicial delegó ecosistema/importación y producto/referencias a **dos agentes gpt-5.6-luna**. La arquitectura, los presupuestos de rendimiento y la consolidación se resolvieron en el agente principal.

En implementación, reservar modelos chicos para tareas con contrato claro: inventario de formatos, textos en español, documentación, tablas, componentes de interfaz acotados y comprobación de enlaces. Usar el principal para decisiones del visor, perfiles de rendimiento, pipeline, identidad entre versiones y revisión de integraciones. Compartir contexto breve y archivos, evitar repetir investigaciones completas y validar las salidas antes de integrarlas.

No hay presupuesto monetario ni consumo de tokens total calculado. Tampoco hay servicios contratados o recursos cloud creados.

## Decisiones abiertas que no frenan esta investigación

- Segmento de entrada: propuesta inicial casas/interiores con SketchUp; la pregunta al usuario sigue abierta.
- Muestras reales y dispositivos disponibles para certificar la experiencia.
- Nivel visual esperado al importar: geometría/materiales fieles y navegables frente a coincidencia exacta con renders externos.
- Mercado geográfico, retención de versiones, tamaño típico de archivos y concurrencia para elegir infraestructura y costes.
- Necesidad futura de editar geometría dentro de Fabrica; por ahora la iteración de autoría ocurre en las herramientas existentes.
