# Seren AI API

API privada de Seren AI. Lee el OLTP y el DataMart de Supabase, calcula señales de churn y registra las recomendaciones del agente.

## Endpoints

- `GET /api/health` - estado de la API.
- `GET /api/me` - identidad autenticada.
- `GET /api/overview` - KPIs y distribución de riesgo.
- `GET /api/customers` - listado y filtros.
- `GET /api/customers/:customerCode` - perfil y compras recurrentes.
- `GET /api/churn` - Customers con riesgo medio o alto.
- `GET /api/agent/recommendations` - recomendaciones y acciones registradas.
- `POST /api/agent/analyze` - ejecutar análisis y guardar evaluaciones.
- `PATCH /api/agent/actions/:actionId/status` - registrar aprobación, contacto o reactivación.
- `GET /api/reports/monthly` - datos agregados para reportes.

Todas las rutas salvo health requieren un JWT válido de Supabase Auth.

## Variables

Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno del servidor. Nunca uses la service role key en Vite ni en el navegador.

## Riesgo explicable

Se usa la mediana de los intervalos entre compras recurrentes por cliente. Se compara con los días transcurridos desde su última compra:

- LOW: aún no supera su intervalo habitual.
- MEDIUM: alcanzó o superó el intervalo habitual.
- HIGH: supera 1.5 veces su intervalo habitual.
- INSUFFICIENT_DATA: no hay intervalos positivos utilizables.

Los umbrales son configurables mediante `CHURN_MEDIUM_MULTIPLIER` y `CHURN_HIGH_MULTIPLIER`. El modelo es estadístico y explicable; no se presenta como ML entrenado.

## Mensajería

El agente genera un mensaje y una oferta sugerida. No envía WhatsApp, SMS ni email en esta versión; el personal debe aprobar y registrar el contacto. La integración con un proveedor de mensajería se añadirá cuando se configuren credenciales y consentimiento.

## Personalizacion con IA (opcional)

El proveedor de inferencia es GroqCloud. En el plan Free se aplican limites de solicitudes y tokens; consulta los limites vigentes en la consola. Configura solo en el servidor:

- `GROQ_API_KEY`: clave de API de GroqCloud.
- `GROQ_MODEL`: por defecto `openai/gpt-oss-120b`.
- `GROQ_MAX_AI_RECOMMENDATIONS`: maximo de propuestas que se envian al proveedor por analisis (por defecto 20).

El motor estadistico conserva la autoridad sobre el nivel de riesgo. Groq solo genera explicaciones y borradores personalizados. Si no hay clave o el proveedor falla, se conservan las plantillas seguras. No envies nombres completos, correos, telefonos ni otros datos de contacto al proveedor.
