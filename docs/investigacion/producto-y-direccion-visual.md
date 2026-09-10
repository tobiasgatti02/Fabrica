# Fabrica — investigación de producto y dirección visual

**Corte de investigación: 10 de septiembre de 2026.** Este documento distingue entre capacidades observadas en fuentes oficiales y propuestas para Fabrica. No incluye precios.

## Qué espacio ocupa el producto

Fabrica puede ocupar una franja más pequeña y comprensible que un CDE/BIM de obra completo: un estudio web para arquitectos, ingenieros civiles e interioristas donde el cliente entiende el proyecto, navega su modelo 3D y deja decisiones localizadas. La promesa no es “otro repositorio de archivos”, sino continuidad entre relato, modelo y conversación.

## Referentes de producto (capacidades verificadas)

| Producto | Evidencia observada | Lectura para Fabrica |
|---|---|---|
| **Trimble Connect** | Su 3D Viewer de navegador permite abrir el historial, cargar una versión anterior y descargar una revisión ([Model Versions](https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-browsers-3d-viewer/models/model-versions)). El panel de detalle incluye versión, historial y comentarios ([Model Details](https://help.trimble.com/en/trimble-connect/trimble-connect/connect-for-browsers-3d-viewer/models/model-details)); sus markups 3D se guardan con las Views ([3D Markups](https://help.trimble.com/doc/trimble-connect/trimble-connect/connect-for-mobile/work-in-3d/3d-markups)). | Buen patrón de “versión + vista guardada + anotación”. La complejidad de un CDE grande debe quedar detrás de una lectura de cliente simple. |
| **Autodesk Viewer / Docs / Forma** | Autodesk Viewer ofrece comentarios y markups; un markup se guarda como comentario con el punto de vista y un marcador, y el panel permite volver a esa posición ([Marking Up Designs](https://help.autodesk.com/cloudhelp/ENU/Autodesk-360-New/files/GUID-40C7FAB1-4008-44A9-9EB6-44C8A7321CF5.htm)). En modelos cloud, Version History permite abrir versiones previas y buscar por autor, comentario o fecha ([View and Open an Earlier Version](https://help.autodesk.com/cloudhelp/2025/ENU/Revit-Cloud/files/GUID-FA47544E-91DD-439F-8A31-41C065379B62.htm)). | Confirma que comentario espacial y versionado son comprensibles si se muestran junto al modelo. Fabrica puede reducir el vocabulario técnico a “versión”, “comentario” y “resolver”. |
| **Speckle** | La documentación describe historial de versiones, comentarios 3D fijados a objetos, federación y seguimiento en tiempo real ([Quickstart](https://docs.speckle.systems/quickstart/welcome)). Su Front-End anuncia comparación visual entre dos versiones y discusiones que persisten entre versiones ([FE2](https://speckle.systems/blog/introducing-fe2-the-new-speckle-front-end/)). | Es el competidor más cercano en colaboración web alrededor del modelo. Diferenciar Fabrica por la experiencia de cliente, el lenguaje español y la transición visual de landing a proyecto. |
| **BIMcollab** | Model WebViewer reúne modelo, propiedades e incidencias; sus notas de versión documentan pines de conflictos/incidencias en el modelo 3D enlazados al detalle ([release notes](https://helpcenter.bimcollab.com/en/articles/326485-release-notes)). BIMcollab Zoom permite comentarios, snapshots y viewpoints guardados en incidencias ([creating and editing issues](https://helpcenter.bimcollab.com/en/articles/347289-creating-and-editing-issues-in-bimcollab-zoom)). | Valida el patrón “pin + estado + vista guardada”. Para Fabrica basta un flujo de observación y decisión; la validación automática y el clash management pueden esperar. |
| **Revizto** | Revizto sincroniza issues y markups a una ubicación exacta en 2D/3D ([Integrated Issue Management](https://revizto.com/product/integrated-issue-management)); los issues admiten comentarios y adjuntos ([Managing issues](https://help.revizto.com/hc/en-us/articles/5007130794511-Managing-issues)). Documenta versiones de láminas y permisos para revertir un proyecto a una versión anterior ([Viewing sheets](https://help.revizto.com/hc/en-us/articles/4404217613967-Viewing-sheets), [Project access rights](https://help.revizto.com/hc/en-us/articles/360004012216-Project-access-rights)). | Referente fuerte para coordinación operativa. No se debe asumir, a partir de estas páginas, un diff general de modelos; Fabrica puede hacer explícita una historia de snapshots del proyecto desde el primer día. |

La convergencia es clara: revisión espacial, contexto guardado y trazabilidad. El hueco de oportunidad es la capa de comunicación para clientes no técnicos: una persona debería poder abrir un enlace, orientarse y contestar una decisión sin aprender BIM.

## Referencias: contenido accesible de las páginas

- **Kanzo Studio (Webflow):** la página lo describe como plantilla para arquitectura e interiorismo, con layouts limpios, composición editorial, portfolio/blog CMS e interacciones suaves ([página](https://webflow.com/templates/html/kanzo-studio-website-template)). Es una base razonable para precisión, retícula y presentación de proyectos.
- **Aureas (Webflow):** se presenta como plantilla de agencia creativa de estética clara y minimalista, con tipografía sutil, secciones estructuradas, imágenes, CMS, CSS Grid y lightbox ([página](https://webflow.com/templates/html/aureas-website-template)). Puede aportar aire y ritmo para la landing.
- **Noura (Webflow):** la descripción confirma animaciones de scroll, revelado de texto, cambio de titular, layouts flexibles, video de fondo y transformaciones 3D ([página](https://webflow.com/templates/html/noura-website-template)). Conviene tomar la idea de movimiento narrativo con moderación, porque el producto necesita confianza y legibilidad.
- **Portfolio homepage layout (Recent.design):** la URL abre el directorio y categorías, pero no expone en el contenido accesible una imagen o preview del layout ([página](https://recent.design/i/75uqgzu-portfolio-homepage-layout)). No se atribuyen rasgos visuales adicionales.

Se revisaron las descripciones públicas de las plantillas; no se hizo una auditoría visual o de rendimiento de sus demos. Estas referencias sugieren una dirección premium basada en mucho espacio, tipografía editorial, retícula precisa, imágenes grandes y movimiento controlado. La propuesta de casa cálida en isometría es una extensión de la idea del usuario, no una observación de estas páginas.

## Dirección visual propuesta

La landing puede contar una casa como una sección vertical continua: **cimientos → estructura → pintura → interior**. El scroll revela la misma axonometría por capas, con transiciones lentas y una paleta de piedra, arena, terracota y verde apagado. El modelo debe sentirse táctil y habitable, no como un dashboard técnico. Un cambio de escala gradual lleva del detalle constructivo al ambiente terminado.

Usaría fondo marfil o gris cálido, texto carbón, una sans humanista para interfaz y una serif discreta solo para titulares o frases de proyecto. Las líneas de plano pueden aparecer como acentos finos; el color de estado de comentarios debe ser accesible y no competir con el material. El movimiento debe tener pausa, control de teclado, alternativa reducida para `prefers-reduced-motion` y 3D simplificado en móviles capaces y una imagen equivalente cuando los recursos no alcancen.

## UX propuesta en español

**Landing pública:** navegación “Proyectos · Cómo funciona · Para estudios · Acceder”, hero con “Tu próximo espacio empieza acá”, CTA “Ver un proyecto” y CTA secundario “Solicitar acceso”. Luego, el recorrido de la casa en cuatro escenas; una demo breve de modelo navegable; tres beneficios (“ver”, “comentar”, “decidir”); un proyecto destacado; y cierre con formulario de contacto. La landing vende claridad y confianza, no una lista de funciones.

**Plataforma:** al entrar, “Mis proyectos” con estado de cada entrega. Dentro de un proyecto: cabecera con nombre, versión actual y última actividad; visor 3D central; lista de modelos o disciplinas a la izquierda; panel “Comentarios” a la derecha; y una línea de versiones inferior. Un cliente selecciona un objeto o punto, pulsa “Añadir comentario”, escribe, adjunta una captura de la cámara y elige “Abierto” o “Resuelto”. Cada pin conserva posición, vista, autor, fecha, versión y estado. “Comparar versiones” puede empezar como cambio de snapshot con dos miniaturas antes de evolucionar a diff geométrico.

La jerarquía debe separar claramente **landing** y **plataforma**: la primera narra y demuestra; la segunda resuelve tareas en pocos clics. El mismo lenguaje de materiales y numeración de etapas puede conectar ambas sin hacer que la app parezca una pieza publicitaria.

## Diferencial y alcance

El diferencial defendible es “revisión espacial para personas”: comentarios anclados a una posición comprensible, continuidad entre versiones y una presentación cálida que permite al cliente participar sin leer planos. La promesa debe ser verificable con enlaces compartibles y un historial claro.

**MVP:** landing responsive; acceso por invitación; proyectos y roles de estudio/cliente; carga de un formato inicial acordado; visor 3D navegable; snapshots versionados; pins con cámara y objeto; comentarios con estado abierto/resuelto; actividad básica; enlace con permisos separados para ver y comentar.

**Fuera del MVP:** autoría BIM, edición de geometría, motor propio de clash detection, reglas IFC, presupuesto, cronograma, compras, permisos empresariales avanzados, app móvil offline, AR/VR, soporte exhaustivo de formatos y comparación geométrica automática. Es mejor validar primero si una revisión con pin reduce idas y vueltas entre estudio y cliente.

## Ruta recomendada

1. Probar el flujo con un proyecto pequeño y tres roles: estudio, ingeniería y cliente.
2. Medir tiempo hasta el primer comentario, porcentaje de comentarios resueltos sin correo y errores al volver a una versión.
3. Ajustar la narrativa de la landing con el lenguaje real de esas revisiones.
4. Añadir comparación visual, menciones, archivos adjuntos y más formatos solo cuando los datos muestren demanda.
