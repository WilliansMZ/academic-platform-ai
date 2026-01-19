import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // (opcional) prefijo global
  // app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Academic Platform Core API')
    .setDescription('Core backend (institutions, users, academic, tutoring, risk)')
    .setVersion('1.0')
    .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
    },
    'access-token', // 👈 nombre del security scheme
  )
  .build();

  const document = SwaggerModule.createDocument(app, config);

  // Si usas global prefix, define si Swagger vive dentro o fuera:
  // Opción 1: dentro del prefix -> /api/v1/docs
  SwaggerModule.setup('docs', app, document);

  // Opción 2 (si quieres SIEMPRE /docs aunque exista prefix):
  // SwaggerModule.setup('docs', app, document, { useGlobalPrefix: false });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
