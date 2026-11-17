import cors from "cors";
import express from "express";
import extensionRoutes from "./routes/extension.route";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Express + TypeScript + MySQL API is running",
  });
});

app.use("/api/extensions", extensionRoutes);

export default app;
