import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from './swagger.config';

export function setupSwagger(app: INestApplication) {
  const config = buildSwaggerConfig();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // no se borra el token al recargar
    },
  });
}
