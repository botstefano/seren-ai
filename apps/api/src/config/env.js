import dotenv from "dotenv";

dotenv.config();

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missing = required.filter((key) => !process.env[key]);

if (process.env.NODE_ENV === "production" && missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  mediumMultiplier: Math.max(0.5, Number(process.env.CHURN_MEDIUM_MULTIPLIER ?? 1)),
  highMultiplier: Math.max(1, Number(process.env.CHURN_HIGH_MULTIPLIER ?? 1.5)),
  defaultOfferDiscount: Math.min(30, Math.max(0, Number(process.env.DEFAULT_OFFER_DISCOUNT ?? 10))),
};
