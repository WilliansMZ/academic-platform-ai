import { ValidationPipe } from '@nestjs/common';

export function applyE2ESettings(app: any) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}
