# Shell del estudio

Las rutas `/estudio` (visor) y `/estudio/panel`, `/estudio/inspiracion`, `/estudio/equipo` (workspace) comparten la misma navegación superior. No deben implementar por separado la marca, el selector de proyecto, la cuenta ni las pestañas.

- `web/components/fabrica/studio-header.tsx`: `StudioHeader` compone el encabezado con tres slots: proyecto, acciones propias de la vista y cuenta. `StudioProjectSwitcher` recibe proyectos/grupos normalizados, selección y acciones opcionales; es dueño de la apertura, Escape y cierre al seleccionar o clicar afuera. `StudioAccount` mantiene el mismo control visual aunque una ruta abra el diálogo y la otra enlace a él.
- `web/components/fabrica/studio-area-nav.tsx`: define una única vez el orden, iconos, rutas y filtro por permisos de las áreas. Las vistas aportan el área activa, proyecto y contexto de enlace compartido.
- `web/app/estudio/studio-shell.css`: tokens visuales y geometría del shell compartido, cargados por el layout del estudio. `studio.css` y `workspace.css` solo deben definir las superficies y acciones particulares de cada vista.

El visor y el workspace siguen siendo responsables de sus datos y de ejecutar `onSelect` (refrescar el visor o actualizar la ruta del workspace). El componente compartido no conoce la API, la sesión ni el motor 3D. Para sumar una nueva área, cambiar primero el registro de `StudioAreaNav` y luego crear la página y sus permisos; para sumar una acción contextual, usar el slot `actions` sin duplicar el encabezado.
