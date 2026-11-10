# Supabase setup

Seren AI uses the existing Origen Spa OLTP and DataMart schemas. It does not recreate or modify their validated tables.

## 1. Run the operational migration

In Supabase SQL Editor, execute:

    database/seren_ai_operations.sql

This creates the separate seren_ai schema with:
- agent_runs: execution history for the risk engine.
- churn_assessments: customer-level risk scores and explanations.
- reactivation_actions: human approval, contact and reactivation tracking.

The migration grants the backend service_role the required server-side access. It does not grant the service-role key to the browser.

## 2. Expose the schemas to the Data API

In the Supabase project settings, find the Data API / exposed schemas configuration and include:

- oltp_origen_spa
- datamart_origen_spa
- seren_ai

Keep the service-role key on the backend only. Do not expose it as a VITE_ variable, commit it, or paste it into the repository.

## 3. Create the first application user

In Supabase Authentication, create an email/password user for the spa administrator. The web application uses Supabase Auth to sign in, and the API validates the access token on protected endpoints.

## 4. Environment variables

Backend (Render web service seren-ai-api):
- SUPABASE_URL: project URL.
- SUPABASE_SERVICE_ROLE_KEY: secret service-role key.
- CLIENT_ORIGIN: deployed web app origin.
- NODE_ENV=production.
- Optional churn thresholds: CHURN_MEDIUM_MULTIPLIER=1, CHURN_HIGH_MULTIPLIER=1.5.

Frontend (Render static site seren-ai-web):
- VITE_API_URL: public API base URL, e.g. https://seren-ai-api.onrender.com.
- VITE_SUPABASE_URL: project URL.
- VITE_SUPABASE_ANON_KEY: publishable/anon key only.

## 5. Security notes

- Never put SUPABASE_SERVICE_ROLE_KEY in the frontend.
- Keep RLS enabled for any future user-facing tables and define policies before allowing browser-side database access.
- Current business data is read through the Express API. The browser only uses Supabase Auth.
- Do not use real customer contact information in the synthetic demo data.
