import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger/swagger.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo para toda la API (queda /api/v1/...)
  app.setGlobalPrefix('api/v1');

  // Swagger solo en desarrollo (o si lo habilitas explícitamente)
  const enableSwagger =
    process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true';

  if (enableSwagger) {
    setupSwagger(app);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
