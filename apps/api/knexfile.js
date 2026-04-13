require('dotenv').config();

const baseConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.PGHOST || '127.0.0.1',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'invoicing_app',
      },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations',
  },
  pool: { min: 0, max: 10 },
};

module.exports = {
  development: baseConfig,
  production: baseConfig,
};
