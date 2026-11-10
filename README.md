# Seren AI

**Agente inteligente de retencion proactiva para spas.**

Seren AI ayuda a Origen Spa a anticipar el abandono de clientes recurrentes. Analiza el intervalo de compra individual, detecta señales de churn, explica el riesgo y propone una accion de reactivacion personalizada basada en las preferencias de consumo.

## Estado

- [x] OLTP de Origen Spa implementado en Supabase.
- [x] DataMart Customers (7 dimensiones + 2 hechos) cargado.
- [x] Conciliacion inicial del ETL: 10,870 compras recurrentes y 21,736 detalles sin faltantes ni sobrantes.
- [x] Base de aplicacion React + TypeScript + Vite.
- [x] API Express con lectura de Supabase y motor de riesgo explicable.
- [x] Pantallas de dashboard, Customers, churn, agente, reactivaciones, BI y configuracion.
- [ ] Ejecutar la migracion operativa database/seren_ai_operations.sql.
- [ ] Configurar credenciales seguras y usuario Supabase Auth.
- [ ] Desplegar y validar ambos servicios en Render.
- [ ] Integrar proveedor de mensajeria con consentimiento y aprobacion.
- [ ] Validar KPIs con el equipo de Origen Spa.

## Arquitectura

| Capa | Tecnologia |
| --- | --- |
| Web | React, TypeScript, Vite |
| UI | Tailwind CSS, Recharts, Lucide |
| API | Node.js, Express |
| Auth | Supabase Auth |
| Persistencia | Supabase PostgreSQL |
| Analitica | OLTP + DataMart estrella |
| Riesgo | Motor estadistico explicable |
| IA generativa opcional | Groq API (GPT-OSS 120B) |
| Despliegue | Render Blueprint |

~~~text
apps/
  api/        Express API, auth middleware, churn engine, endpoints
  web/        React application and dashboards
database/
  seren_ai_operations.sql
docs/
  supabase-setup.md
  product-scope.md
render.yaml
~~~

## Quick start

Requirements: Node.js 20+.

1. Copy .env.example to .env.
2. Set the Supabase URL, anon key, service-role key and local origins as described in docs/supabase-setup.md.
3. In Supabase, run database/seren_ai_operations.sql and expose the three application schemas to the Data API.
4. Install and run:

~~~bash
npm install
npm run dev
~~~

Web app: http://localhost:5173  
API: http://localhost:4000  
Health: http://localhost:4000/api/health

## Churn methodology

The engine compares calendar days since the last purchase with the median of the customer's positive historical purchase intervals:

- LOW: below 1.0x the usual interval.
- MEDIUM: from 1.0x up to 1.5x.
- HIGH: 1.5x or more.
- INSUFFICIENT_DATA: no valid interval.

This is an explainable statistical rules engine, not a trained predictive ML model.

## Human approval and messaging

The agent creates an offer and a personalized message draft. Staff must approve it and then record contact/outcome. The current release does not send WhatsApp, SMS or email automatically. Provider integration requires credentials, customer consent and delivery-status handling.

## Validation

~~~bash
npm test
npm run build
~~~

See docs/supabase-setup.md for Supabase setup and render.yaml for the Render Blueprint.

## Security

Never commit .env, the Supabase service-role key, passwords or provider tokens. The service-role key and GROQ_API_KEY are used only by the Express API and must never be prefixed with VITE_. Groq only personalizes the drafts; statistical churn rules remain authoritative, staff approval is required, and prompts use pseudonymous references instead of names or contact details.
