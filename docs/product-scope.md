# Seren AI product scope

## Product goal

Seren AI is a proactive customer-retention agent for Origen Spa, focused on the Customers stage of the IMPULSE methodology. A Customer is a payer with two or more purchases. Payers with exactly one purchase are excluded from the analytical Customer DataMart.

The application is not a generic CRM. Its central workflow is:

1. Understand each recurring customer's purchase cadence.
2. Detect when the elapsed time since their last purchase exceeds their own historical interval.
3. Explain the detected risk.
4. Recommend a personalized recovery offer based on the customer's most-consumed service/product.
5. Let spa staff approve and record outreach.
6. Track whether the customer returned.

## Current risk engine

The first version is deliberately explainable, not a trained machine-learning model.

- Expected interval: median of positive dias_desde_compra_anterior values for that Customer.
- Elapsed time: calendar days since Dim_Usuario_Customer.fecha_ultima_compra.
- LOW: elapsed time / expected interval is below 1.0.
- MEDIUM: ratio is at least 1.0 and below 1.5.
- HIGH: ratio is at least 1.5.
- INSUFFICIENT_DATA: there are no valid positive historical intervals.

The medium and high multipliers are configurable. Risk is evaluated per Customer rather than with a single fixed inactivity threshold.

## Personalization

Favorite product/service is derived from the quantity consumed across recurring purchase-detail rows. When there is no clear favorite, the message uses a generic wellness invitation instead of inventing a preference.

## Human-in-the-loop

This release creates message drafts and offer recommendations. It does not send email, SMS, or WhatsApp messages. Staff approve the proposal and then record the contact and outcome. A messaging provider, its credentials, customer consent and delivery webhooks must be configured before automated sending is enabled.

## BI indicators

- Purchase frequency: average reconstructed number of purchases per Customer (recurrent fact rows + the excluded first purchase).
- Repurchase rate: customers with two or more purchases divided by all unique buyers in OLTP.
- Recurrent ticket: gross amount divided by recurrent purchases.
- Churn rate: Customers currently classified MEDIUM or HIGH divided by Customers with an evaluable risk result.
- Reactivation rate: reactivated actions divided by actions with a contact/outcome registered.

The report layer only uses the Customers phase facts where appropriate. First purchases remain excluded from the two fact tables by design.
