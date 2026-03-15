import { logger } from "./shared/index.js";
import { createApp } from "./api/app.js";

const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Maestro backend demarre");
});
