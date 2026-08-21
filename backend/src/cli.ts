import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * One-off database chores, run against whatever DATABASE_URL points at.
 *
 *   npm run db:schema   create or update tables to match the entities
 *   npm run db:seed     load the demo dataset, if the database is empty
 *   npm run db:setup    both, in that order
 *
 * These exist because a serverless deployment does neither on boot: schema
 * changes must not happen concurrently across cold-starting instances, and
 * seeding is a thing you decide to do once, not something a request triggers.
 * Run them from your machine against the production database, deliberately.
 */
async function main() {
  const command = (process.argv[2] || 'setup').replace(/^--/, '');
  if (!['schema', 'seed', 'setup'].includes(command)) {
    console.error(`Unknown command "${command}". Expected: schema | seed | setup`);
    process.exit(1);
  }

  // The CLI drives seeding itself; the boot hook must not also fire.
  process.env.SEED_ON_BOOT = 'false';
  // Nothing here should alter the schema as a side effect of connecting —
  // `schema` does it explicitly below so the log says what happened.
  process.env.DB_SYNCHRONIZE = 'false';

  const logger = new Logger('db');
  // Imported after the env above is set: both are read at module load.
  const { AppModule } = await import('./app.module');
  const { SeedService } = await import('./seed/seed.service');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    if (command === 'schema' || command === 'setup') {
      const dataSource = app.get(DataSource);
      logger.log(`Synchronising schema on ${dataSource.options.database || 'the configured database'}...`);
      await dataSource.synchronize();
      logger.log('Schema is up to date.');
    }
    if (command === 'seed' || command === 'setup') {
      await app.get(SeedService).seedIfEmpty();
    }
  } finally {
    await app.close();
  }
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});
