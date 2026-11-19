import cors from "cors";
import express from "express";
import extensionRoutes from "./routes/extension.route";
import gatewayRoutes from "./routes/gateway.route";
import hiveUserRoutes from "./routes/hiveuser.route";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Express + TypeScript + MySQL API is running",
  });
});

app.use("/api/extensions", extensionRoutes);
app.use("/api/gateways", gatewayRoutes);
app.use("/api/hiveuser", hiveUserRoutes);

app.use(errorMiddleware);

export default app;
