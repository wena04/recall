/**
 * This is a API server
 */

import "./load-env.js";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import messageRoutes from "./routes/message.js";
import knowledgeItemsRoutes from "./routes/knowledge_items.js";
import queryRoutes from "./routes/query.js";

const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/**
 * API Routes
 */
app.use("/api/auth", authRoutes);
app.use("/api", messageRoutes);
app.use("/api", knowledgeItemsRoutes);
app.use("/api", queryRoutes);

/**
 * health
 */
app.use(
  "/api/health",
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: "ok",
    });
  },
);

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: "Server internal error",
  });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "API not found",
  });
});

export default app;
