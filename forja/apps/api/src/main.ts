import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { env } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");
  app.enableCors({
    origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
    credentials: false,
  });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  // eslint-disable-next-line no-console
  console.log(`FORJA API escuchando en :${env.PORT} (prefijo /v1)`);
}
void bootstrap();
