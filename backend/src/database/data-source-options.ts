import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ENTITIES } from '../entities';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/** True inside a Vercel serverless function (build or runtime). */
export const IS_SERVERLESS = Boolean(process.env.VERCEL);

/**
 * Read a boolean env var, falling back when it is unset. Anything other than
 * "true"/"false" is a typo, and a typo should not silently mean `false` on a
 * flag like `synchronize`.
 */
function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be "true" or "false", got "${raw}"`);
}

/**
 * TLS for the connection.
 *
 * Every hosted Postgres worth using (Neon, Supabase, RDS) requires it, and most
 * of them present a certificate chain the Node default trust store does not
 * carry. `DB_SSL_REJECT_UNAUTHORIZED=true` is there for a provider that gives
 * you a real chain — it is the stricter setting and you should prefer it when
 * your provider supports it.
 */
function ssl() {
  const url = process.env.DATABASE_URL || '';
  // Providers hand out URLs with sslmode already in them; honour it.
  const impliedByUrl = /[?&]sslmode=(require|verify-ca|verify-full)/.test(url);
  if (!flag('DB_SSL', impliedByUrl || IS_SERVERLESS)) return false;
  return { rejectUnauthorized: flag('DB_SSL_REJECT_UNAUTHORIZED', false) };
}

/**
 * One description of the database, used by the API, by the serverless handler
 * and by `npm run seed` — so the CLI can never drift from what the app does.
 *
 * `DATABASE_URL` wins when present: that is the single string every hosted
 * provider gives you, and splitting it into five variables by hand is a
 * reliable way to get one of them wrong.
 */
export function databaseOptions(): TypeOrmModuleOptions {
  const url = process.env.DATABASE_URL;

  return {
    type: 'postgres',
    ...(url
      ? { url }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'recruitment',
        }),
    entities: ENTITIES,
    namingStrategy: new SnakeNamingStrategy(),
    ssl: ssl(),

    // Schema is owned by TypeORM in development; database/schema.sql documents
    // the equivalent DDL. Off by default anywhere it would run unattended —
    // a serverless cold start is not a safe moment to alter a live schema, and
    // concurrent instances would race each other doing it.
    synchronize: flag('DB_SYNCHRONIZE', !IS_SERVERLESS && process.env.NODE_ENV !== 'production'),
    logging: flag('DB_LOGGING', false),

    // A cold start that cannot reach the database should fail fast and return
    // an error, not sit through 30 seconds of retries and hit the function
    // timeout with nothing to show for it.
    retryAttempts: IS_SERVERLESS ? 1 : 10,
    retryDelay: IS_SERVERLESS ? 500 : 3000,

    // Survives across invocations on a warm instance instead of reconnecting.
    keepConnectionAlive: true,

    extra: {
      // Every concurrent function instance opens its own pool, so the ceiling
      // that matters is instances x max — keep the per-instance share at one
      // and point DATABASE_URL at your provider's pooled endpoint (pgbouncer,
      // Neon's -pooler host) to get real pooling.
      max: parseInt(process.env.DB_POOL_MAX || (IS_SERVERLESS ? '1' : '10'), 10),
      // Do not hold an idle connection open past the invocation that made it.
      idleTimeoutMillis: IS_SERVERLESS ? 10_000 : 30_000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '10000', 10),
    },
  };
}
