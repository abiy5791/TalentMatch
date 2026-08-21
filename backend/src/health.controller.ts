import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  /**
   * Two questions, not one.
   *
   * "Can I reach the database" and "has the schema been created" have different
   * answers on a fresh deployment, and `SELECT 1` only answers the first — it
   * succeeds happily against an empty database. Reporting that as a healthy
   * database is technically true and practically misleading: it is the moment
   * someone is trying to find out whether they still need to run the setup.
   */
  @Get()
  async check() {
    let database = 'down';
    let schema = 'unknown';

    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
    } catch {
      return { status: 'degraded', database, schema, timestamp: new Date().toISOString() };
    }

    try {
      // The users table is created first and never dropped, so its presence is
      // a fair proxy for "the schema exists".
      const [row] = await this.dataSource.query(
        `SELECT to_regclass('public.users') IS NOT NULL AS present`,
      );
      schema = row?.present ? 'ready' : 'missing';
    } catch {
      schema = 'unknown';
    }

    return {
      status: schema === 'ready' ? 'ok' : 'setup-required',
      database,
      schema,
      ...(schema === 'missing' && { hint: 'Run "npm run db:setup" against this database' }),
      timestamp: new Date().toISOString(),
    };
  }
}
