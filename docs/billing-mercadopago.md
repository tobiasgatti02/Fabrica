# Billing con Mercado Pago

La integración usa planes asociados de Mercado Pago: un plan externo por versión de precio y una suscripción `preapproval` por estudio. Los derechos se calculan desde `billing_accounts` y `billing_price_versions`; el proveedor no es la fuente única de permisos.

## Estado de Test (2026-09-23)

- La rama Neon `test` del proyecto `fabrica` tiene aplicadas las migraciones `0000` a `0016` (17 en total). Se verificaron las 7 tablas de billing, los 4 planes locales y los 7 triggers de cuotas. La rama `main` no se migró en esta operación.
- El worker Cloudflare `fabrica-test` usa la conexión pooled de Neon `test` y tiene configurados `APP_BASE_URL`, las credenciales y el secreto de webhook de Mercado Pago, los tres IDs de planes y `MERCADOPAGO_TEST_MODE=true`.
- El despliegue de Test corresponde a la versión de Cloudflare `98326f96-8966-455d-8c0d-5d178f23b6bb`. El endpoint del webhook rechazó una firma inválida con HTTP 401.
- Aún falta una prueba de suscripción con un comprador y una tarjeta de prueba para confirmar la entrega del webhook y la activación del período pagado. Esta comprobación puede crear un cargo de prueba y no se ejecutó durante la migración.
- El simulador del panel envió `subscription_preapproval` con el ID ficticio `123456` y reportó 503. La telemetría de Cloudflare muestra que la URL de esa misma petición contenía `type=subscription_authorized_payment`; el receptor anterior daba prioridad al querystring y consultaba un pago autorizado inexistente. Ahora prioriza el tipo del cuerpo y reconoce el 404 del ID ficticio **solo en Test** como prueba aceptada, tras validar la firma. Conserva el 503 para fallos transitorios y recursos reales todavía no registrados localmente. Este cambio requiere desplegar una nueva versión de `fabrica-test` y volver a pulsar la prueba del panel.
- Una petición sin firma al endpoint público devolvió 401 el 23 de septiembre. Wrangler local no tiene sesión autenticada y el secreto de firma no está en el entorno local; por eso la prueba firmada del panel sigue pendiente de repetirse tras el despliegue.
- La landing muestra los cuatro planes y sus importes con una nota visible de que los cobros siguen en Test. En facturación, un estudio con suscripción activa confirma un cambio de plan por la ruta de modificación, sin abrir un segundo formulario de alta.

## Información confirmada por MCP

- Para Argentina, los tópicos de Suscripciones son `subscription_preapproval`, `subscription_authorized_payment` y `subscription_preapproval_plan`.
- La creación usa `POST /preapproval`, `preapproval_plan_id`, `external_reference`, `payer_email`, `card_token_id` y estado `authorized` cuando se vincula un plan.
- La gestión usa `PUT /preapproval/{id}` para modificar monto, cancelar (`canceled`), pausar (`paused`) o reactivar.
- La firma `x-signature` se valida con HMAC-SHA256 sobre `id:{data.id};request-id:{x-request-id};ts:{ts};`, omitiendo campos ausentes y normalizando `data.id` a minúsculas.
- Los requests que crean recursos admiten `X-Idempotency-Key`; los webhooks se deduplican por tópico e identificador externo.

## Configuración

Crear planes mensuales en el panel/API con moneda ARS y guardar sus IDs en `MERCADOPAGO_PLAN_INICIAL`, `MERCADOPAGO_PLAN_ESTUDIO` y `MERCADOPAGO_PLAN_EQUIPO`. Mantener token, public key y secreto únicamente en variables del servidor. Los valores pegados en el pedido no se copiaron al repositorio y el access token expuesto debe revocarse.

En el entorno Test, registrar `https://test.f4brica.app/api/billing/webhooks/mercadopago` para los tópicos `subscription_preapproval` y `subscription_authorized_payment`. Mercado Pago envía las pruebas a la API habitual; no hay una URL sandbox alternativa. Configurar `MERCADOPAGO_WEBHOOK_SECRET` con la clave de firma del panel.

La pantalla usa CardForm de MercadoPago.js para generar `card_token_id` en campos seguros. El backend crea una suscripción con un plan externo asociado y espera el webhook de un cargo aprobado antes de dar acceso al plan pagado.

## Preparación de Test

1. Crear una rama de Neon para Test y colocar sus URL de conexión en la configuración del worker `fabrica-test`. No usar la rama `main` de `.env.local` para migraciones de Test.
2. Aplicar `web/drizzle/0016_famous_azazel.sql` en esa rama antes de desplegar. Incluye tablas, precios y reglas de límites; la aplicación no puede consultar facturación sin esa migración.
3. Configurar en `fabrica-test` los secretos `DATABASE_URL`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_PLAN_INICIAL`, `MERCADOPAGO_PLAN_ESTUDIO`, `MERCADOPAGO_PLAN_EQUIPO`, `MERCADOPAGO_TEST_MODE=true` y `APP_BASE_URL=https://test.f4brica.app`. Los planes de prueba creados se guardan solo en `web/.env.local`.
4. Desplegar con `npm run deploy:test` desde `web/`. Iniciar sesión en Fabrica, abrir `/estudio/facturacion`, elegir un plan y usar el correo de la cuenta compradora de prueba y una tarjeta de prueba. Para pago aprobado, usar `APRO` como nombre del titular y DNI `12345678`.
5. Comprobar que el webhook se procese y que `billing_accounts.state` pase a `active` con `paid_through` futuro. Los pagos rechazados deben quedar en gracia sin conceder un nuevo período pagado.
