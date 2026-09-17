// Express application composition for the SupportAI API.
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { allowedOrigins, env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { requestContext } from "./middleware/request-context";
import { requireAuth } from "./middleware/auth";
import { asyncRoute } from "./utils/async-route";
import { NotFoundError } from "./errors/app-error";
import { analyticsRouter } from "./routes/analytics-routes";
import { chatRouter } from "./routes/chat-routes";
import { documentRouter } from "./routes/document-routes";
import { faqRouter } from "./routes/faq-routes";
import { profileRouter } from "./routes/profile-routes";
import { publicRouter } from "./routes/public-routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);

  app.use(requestContext);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):(3000|3001|3002)$/.test(origin ?? "");
        if (!origin || allowedOrigins.includes(origin) || (env.NODE_ENV !== "production" && localOrigin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin is not allowed by API CORS policy."));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Please wait a moment and retry.", requestId: req.context.requestId } })
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok", service: "supportai-api" } });
  });

  const publicApi = express.Router();
  publicApi.use(publicRouter);
  app.use("/api/v1/public", publicApi);

  const api = express.Router();
  api.use(asyncRoute(requireAuth));
  api.use(profileRouter);
  api.use(documentRouter);
  api.use(faqRouter);
  api.use(chatRouter);
  api.use(analyticsRouter);

  app.use("/api/v1", api);
  app.use((_req, _res, next) => next(new NotFoundError()));
  app.use(errorHandler);

  return app;
}
