import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { swaggerConfig } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.PORT || '3001', 10);

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(compression());
  app.enableCors({ origin: process.env.CORS_ORIGIN || true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.setGlobalPrefix('api/v1');

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig()));

  await app.listen(port, '0.0.0.0');
  Logger.log(`Recruitment Platform API running on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`API docs available at http://localhost:${port}/api/docs`, 'Bootstrap');
}
bootstrap();
