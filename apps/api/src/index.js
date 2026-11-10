import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import apiRouter from "./routes/api.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by Seren AI CORS policy."));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/", (_req, res) => {
  res.json({
    name: "Seren AI API",
    description: "Proactive customer retention for spas",
    health: "/api/health",
    version: "0.1.0",
  });
});

app.use("/api", apiRouter);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  const status = Number(error.status ?? 500);
  if (status >= 500) console.error("[Seren AI API]", error);
  res.status(status).json({
    message: status >= 500 ? "Ocurrio un error al procesar la solicitud." : error.message,
    detail: env.nodeEnv === "development" ? error.message : undefined,
  });
});

app.listen(env.port, () => {
  console.log(`[Seren AI API] listening on port ${env.port}`);
});
