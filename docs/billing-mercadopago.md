# Billing con Mercado Pago

La integración usa planes asociados de Mercado Pago: un plan externo por versión de precio y una suscripción `preapproval` por estudio. Los derechos se calculan desde `billing_accounts` y `billing_price_versions`; el proveedor no es la fuente única de permisos.

## Información confirmada por MCP

- Para Argentina, los tópicos de Suscripciones son `subscription_preapproval`, `subscription_authorized_payment` y `subscription_preapproval_plan`.
- La creación usa `POST /preapproval`, `preapproval_plan_id`, `external_reference`, `payer_email`, `card_token_id` y estado `authorized` cuando se vincula un plan.
- La gestión usa `PUT /preapproval/{id}` para modificar monto, cancelar (`canceled`), pausar (`paused`) o reactivar.
- La firma `x-signature` se valida con HMAC-SHA256 sobre `id:{data.id};request-id:{x-request-id};ts:{ts};`, omitiendo campos ausentes y normalizando `data.id` a minúsculas.
- Los requests que crean recursos admiten `X-Idempotency-Key`; los webhooks se deduplican por tópico e identificador externo.

## Configuración

Crear planes mensuales en el panel/API con moneda ARS y guardar sus IDs en `MERCADOPAGO_PLAN_INICIAL`, `MERCADOPAGO_PLAN_ESTUDIO` y `MERCADOPAGO_PLAN_EQUIPO`. Mantener token, public key y secreto únicamente en variables del servidor. Los valores pegados en el pedido no se copiaron al repositorio y el access token expuesto debe revocarse.

Registrar como URL de notificación: `https://<dominio>/api/billing/webhooks/mercadopago`. Usar la URL sandbox durante pruebas y credenciales de prueba del usuario productivo.

La contratación todavía requiere integrar el SDK de Mercado Pago para producir `card_token_id` en el navegador. Hasta completar ese paso, la pantalla informa estado y límites y no simula una contratación.