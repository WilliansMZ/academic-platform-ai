import { DocumentBuilder } from '@nestjs/swagger';

export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Academic Platform API')
    .setDescription('Documentación y pruebas de endpoints del sistema académico')
    .setVersion('1.0.0')
    // JWT Bearer para endpoints protegidos
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();
}
