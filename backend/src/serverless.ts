import 'reflect-metadata';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import express, { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { swaggerConfig } from './swagger';

/**
 * The API as a request handler rather than a listening server.
 *
 * Vercel hands a function raw Node request/response objects, which is exactly
 * what an Express app is — so the adapter's Express instance is the handler and
 * no API-Gateway event shim is needed in between.
 *
 * The instance is cached at module scope on purpose. A warm invocation reuses
 * this app and, with it, the database pool; rebuilding the Nest container per
 * request would put a full dependency graph and a fresh connection in front of
 * every call. The cached value is the *promise*, so concurrent invocations
 * during a cold start wait on one bootstrap instead of racing into several.
 */
let cached: Promise<Express> | null = null;

async function bootstrap(): Promise<Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    // Vercel captures stdout; Nest's default logger is the right amount here.
    logger: ['error', 'warn', 'log'],
  });

  // crossOriginResourcePolicy off: the console and the API can be served from
  // different origins, and a CV download must not be blocked by it.
  // No `compression()`: the platform compresses responses at the edge, and
  // doing it twice only costs function time.
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Vercel terminates TLS and proxies, so the socket peer is always Vercel's.
  // Trusting exactly one hop lets `req.ip` be the real caller — which is what
  // the rate limiter counts — without trusting a header a client wrote itself.
  server.set('trust proxy', 1);

  app.enableCors({ origin: corsOrigin(), credentials: true });
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

  // init(), not listen(): the app wires itself up but never binds a port.
  await app.init();
  Logger.log('Serverless API initialised', 'Bootstrap');
  return server;
}

/**
 * Which origins may call this API.
 *
 * A comma-separated CORS_ORIGIN is the deployed setting — the console's domain,
 * plus any preview domain you actually use. Unset means "reflect whatever asked",
 * which is fine while you are wiring things up and is not what you want later;
 * the deployment guide sets it.
 */
function corsOrigin(): string[] | boolean {
  const configured = process.env.CORS_ORIGIN;
  if (!configured) return true;
  const origins = configured.split(',').map(o => o.trim()).filter(Boolean);
  return origins.length ? origins : true;
}

export function serverlessApp(): Promise<Express> {
  if (!cached) {
    cached = bootstrap().catch(error => {
      // A failed bootstrap must not be cached, or one bad cold start poisons
      // the instance for its whole life and every request 500s identically.
      cached = null;
      throw error;
    });
  }
  return cached;
}

/** The Vercel function entry: `(req, res)` straight into Express. */
export default async function handler(req: any, res: any) {
  const server = await serverlessApp();
  server(req, res);
}
