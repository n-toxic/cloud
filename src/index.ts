import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./db/index.js";
import { logger } from "./lib/logger.js";

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`🚀 Techofy Cloud API running on port ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

start();
