import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import pool from "./config/db";

const PORT = Number(process.env.PORT || 3000);

async function startServer(): Promise<void> {
  try {
    // Verify that MySQL is reachable before starting.
    await pool.query("SELECT 1");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log("MySQL connected successfully");
    });
  } catch (error) {
    console.error("Failed to start the application:", error);
    process.exit(1);
  }
}

void startServer();
