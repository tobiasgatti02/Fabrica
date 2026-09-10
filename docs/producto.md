# Fabrica — definición inicial de producto

**Estado: propuesta para validar · 10 de septiembre de 2026.** Nombre solicitado: **Fabrica**, sin cambiar su escritura. Idioma inicial de toda la experiencia: español.

## Visión y primer alcance

Un estudio virtual donde profesionales presentan espacios, comparten iteraciones y toman decisiones con sus clientes sobre un modelo navegable. El proyecto puede ser una casa, jardín, edificio o interior. El historial debe permitir entender qué se presentó y qué se comentó en cada entrega.

Supuesto inicial: el profesional sigue modelando en su herramienta de autoría y publica revisiones en Fabrica. El cliente navega, señala y comenta. La edición geométrica/CAD dentro del navegador sería una ampliación de producto, no una condición asumida de esta primera versión.

Primera prueba recomendada: casas e interiores que llegan desde SketchUp, con GLB como formato preparado de visualización. IFC se evalúa temprano para evitar una arquitectura que cierre el camino a ingeniería y BIM. DWG tiene una ruta propia para contenido 2D/3D y no se anuncia como soportado hasta validarla.

## Usuarios y permisos

| Persona | Necesita | Acciones iniciales |
|---|---|---|
| Responsable del estudio | Preparar y controlar la presentación | Crear proyecto, subir/publicar revisiones, invitar, resolver comentarios y revocar acceso. |
| Colaborador profesional | Revisar una disciplina y explicar cambios | Subir según permisos, guardar vistas, comentar y consultar versiones. |
| Cliente invitado | Entender el espacio y dejar feedback | Recorrer, abrir vistas, añadir comentarios y consultar las revisiones compartidas. |
| Visitante de demo | Entender Fabrica antes de registrarse | Explorar un proyecto de muestra claramente identificado como demo. |

Acceso de cliente con enlace revocable y sesión ligera; atribuir los comentarios a una identidad verificable. Las capacidades para ver, comentar y descargar se configuran por separado. Un borrador del estudio no se hace visible al cliente por el solo hecho de subirlo.

## Flujo principal

1. El estudio crea “Casa del patio” y carga su archivo, texturas y referencias necesarias.
2. Fabrica valida unidades y contenido, muestra progreso y avisa qué pudo conservar.
3. El estudio recorre el resultado, elige una vista de inicio y publica “Entrega 01 — propuesta inicial”.
4. El cliente abre el enlace, recorre libremente o usa vistas “Exterior”, “Estar” y “Jardín”.
5. Toca una superficie, elige “Comentar aquí” y escribe “¿Podemos ampliar esta ventana?”. El comentario guarda el punto, la cámara y la revisión.
6. El estudio responde, actualiza el diseño en su herramienta y publica “Entrega 02 — ventana y circulación”.
7. Ambos pueden volver a la entrega anterior. Si un elemento cambió o desapareció, su comentario conserva el contexto original y no se recoloca silenciosamente.

## Navegación y pantalla de proyecto

El modelo ocupa la mayor superficie. Cabecera con proyecto, entrega y acción de compartir; controles compactos de órbita, recorrido, vistas y sección; panel de comentarios con aparición contextual. En móvil, panel inferior y gestos consistentes, evitando controles superpuestos al punto que se quiere señalar.

“100% navegable” se traduce en órbita, pan y zoom; recorrido libre en perspectiva; acceso al interior mediante entrada, vistas y corte; controles táctiles; recuperar orientación con “Volver a la vista inicial”. Colisiones y modo caminar con suelo requieren geometría auxiliar: se validan sin bloquear la órbita ni las vistas guardadas. Una planta 2D nunca se presentará como un espacio 3D inventado.

El primer historial permite abrir revisiones y alternarlas con una cámara coherente. La comparación simultánea y el diff geométrico son funciones posteriores: duplicar la escena puede duplicar costes de memoria y los IDs pueden cambiar entre exportaciones.

Anotaciones: hilo, autor, fecha, revisión, ancla espacial y estados “Abierto”/“Resuelto”. Ocultar o agrupar pines lejanos cuando haya muchos. El historial de actividad registra publicaciones, respuestas y resoluciones. La aprobación formal de entregas puede añadirse después de definir quién aprueba y qué alcance tiene.

## Landing: una casa que se vuelve habitable

Dirección propuesta: composición editorial, pocos mensajes, tipografía con carácter, tonos minerales y luz cálida. La casa es la protagonista; los controles, la tipografía y los espacios deben ser igual de cuidados. Las referencias aportadas son orientación, no plantillas a copiar.

| Progreso | Escena | Mensaje |
|---|---|---|
| 0–15% | Terreno y primer trazo | “Todo empieza con una idea.” |
| 15–30% | Cimientos | “Empezamos desde cero.” |
| 30–45% | Columnas y vigas | “Las ideas toman forma.” |
| 45–60% | Muros y cubierta | “Un adentro. Un afuera.” |
| 60–75% | Materiales, aberturas y mobiliario | “La diferencia se siente.” |
| 75–85% | Casa terminada | “Ya no es solo una idea.” |
| 85–100% | Entrada continua al estar | “Ahora, pasá.” |

Rangos actualizados según la especificación del usuario del 10 de septiembre. Ver [implementación, verificaciones y límites](landing-implementacion.md).

La secuencia requiere un asset 3D creado con capas y materiales separables, una trayectoria de cámara y controles de calidad. No puede obtenerse con la misma calidad narrativa de cualquier archivo subido. Las fases ilustran la evolución del proyecto; no afirman que Fabrica ya gestione avances de obra.

Hero tentativo: **“Tu próximo espacio empieza acá.”** Bajada: “Presentá tus proyectos, recorré cada versión y decidí con tus clientes, en un mismo lugar.” CTA principal “Explorar un proyecto”; secundario “Conocer Fabrica”. Validar tono rioplatense frente a español neutro cuando se defina el mercado.

Después del recorrido: una demostración breve del comentario espacial, tres beneficios concretos y un cierre. No añadir métricas, testimonios, logos de clientes o promesas de compatibilidad sin evidencia. La lista de herramientas debe explicar la ruta real de importación.

Scroll nativo con progresión continua y reversible; preparar las etapas siguientes sin bloquear el texto. Teclado, opción “Saltar recorrido”, `prefers-reduced-motion`, póster inicial y recorrido por etapas como alternativa. En móvil capaz, conservar 3D simplificado; imagen o secuencia accesible cuando los recursos no alcancen. Ninguna animación impide llegar al CTA.

## MVP y siguientes extensiones

MVP: landing, demo, cuentas de estudio/cliente, proyectos, primera ruta de importación certificada, visor navegable, vistas, pines, respuestas, revisiones publicadas, historial y enlaces con permisos. Las capacidades se entregan como un flujo completo antes de multiplicar formatos.

Después: IFC con propiedades, DWG/DXF, comparación, BCF, notificaciones, conectores nativos, federación y escenas de mayor tamaño. Jardines densos e ingeniería civil merecen pruebas específicas de vegetación, terreno, precisión y unidades.

Quedan fuera de esta propuesta inicial: reemplazar SketchUp/Revit, cálculo estructural, presupuestos y planificación de obra, edición BIM paramétrica, multiplayer de geometría, AR/VR y render fotorrealista idéntico a motores externos.

Validación sugerida: observar a profesionales y clientes haciendo una revisión real. Medir apertura exitosa, tiempo hasta orientarse, primer comentario, recuperación de contexto entre versiones y cuestiones resueltas sin reenviar capturas. El posicionamiento sigue siendo una hipótesis hasta esas sesiones; ver [investigación de producto y referencias](investigacion/producto-y-direccion-visual.md).
