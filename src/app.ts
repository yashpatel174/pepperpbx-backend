import cors from "cors";
import express from "express";
import commonRoutes from "./routes/common.route";
import { errorMiddleware } from "./middleware/error.middleware";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Express + TypeScript + MySQL API is running",
  });
});

app.use("/api", commonRoutes);

app.use(errorMiddleware);

export default app;
