import { DefaultNamingStrategy, NamingStrategyInterface, Table } from 'typeorm';

function snake(input: string): string {
  return input
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Maps camelCase entity properties to snake_case columns so the generated
 * schema matches database/schema.sql and the raw SQL used in the analytics module.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  tableName(className: string, customName?: string): string {
    return customName || snake(className);
  }

  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    return snake(embeddedPrefixes.concat(customName || propertyName).join('_'));
  }

  relationName(propertyName: string): string {
    return snake(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snake(`${relationName}_${referencedColumnName}`);
  }

  joinTableName(firstTableName: string, secondTableName: string, firstPropertyName: string): string {
    return snake(`${firstTableName}_${firstPropertyName.replace(/\./gi, '_')}_${secondTableName}`);
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snake(`${tableName}_${columnName || propertyName}`);
  }

  classTableInheritanceParentColumnName(parentTableName: any, parentTableIdPropertyName: any): string {
    return snake(`${parentTableName}_${parentTableIdPropertyName}`);
  }

  eagerJoinRelationAlias(alias: string, propertyPath: string): string {
    return `${alias}__${propertyPath.replace('.', '_')}`;
  }

  indexName(tableOrName: Table | string, columns: string[]): string {
    const table = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
    return `idx_${table}_${columns.map(snake).join('_')}`;
  }
}

/**
 * Postgres returns DECIMAL/NUMERIC as a string to preserve precision.
 * The API contract exposes scores and fees as numbers, so convert on read.
 */
export const numericTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null || value === undefined ? null : parseFloat(value)),
};
