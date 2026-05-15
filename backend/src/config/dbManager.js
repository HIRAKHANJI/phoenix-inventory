const { Pool } = require('pg');
const knex = require('knex');
const knexConfig = require('../../knexfile');

const normalizeCompany = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'phoenix' || v === 'phx') return 'phoenix';
  if (v === 'inpack' || v === 'inp') return 'inpack';
  return null;
};

const commonConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  password: process.env.DB_PASSWORD || 'root',
  port: Number(process.env.DB_PORT || 5432),
};

const getPoolConfig = (dbEnvName, defaultDbName, urlEnvName) => {
  if (process.env[urlEnvName]) {
    return {
      connectionString: process.env[urlEnvName],
      ssl: { rejectUnauthorized: false }
    };
  } else if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }
  return {
    ...commonConfig,
    database: process.env[dbEnvName] || defaultDbName
  };
};

const phoenixPool = new Pool(getPoolConfig('PHOENIX_DB', 'inventory_system', 'DATABASE_URL'));
const inpackPool = new Pool(getPoolConfig('INPACK_DB', 'inpack_db', 'DATABASE_URL_INPACK'));

phoenixPool.on('error', (err) => {
  console.error('--- PHOENIX DB POOL ERROR ---');
  console.error(err);
});

inpackPool.on('error', (err) => {
  console.error('--- INPACK DB POOL ERROR ---');
  console.error(err);
});

// Knex Instances helper
const createKnex = (config) => {
  const connection = config.connectionString ? { connectionString: config.connectionString, ssl: config.ssl } : config;
  return knex({
    client: 'pg',
    connection: connection,
    pool: { min: 2, max: 10 }
  });
};

const phoenixKnex = createKnex(getPoolConfig('PHOENIX_DB', 'inventory_system', 'DATABASE_URL'));
const inpackKnex = createKnex(getPoolConfig('INPACK_DB', 'inpack_db', 'DATABASE_URL_INPACK'));

const getDB = (companyRaw) => {
  const company = normalizeCompany(companyRaw) || 'phoenix';
  if (company === 'phoenix') return phoenixPool;
  if (company === 'inpack') return inpackPool;
  return phoenixPool;
};

const getKnex = (companyRaw) => {
  const company = normalizeCompany(companyRaw) || 'phoenix';
  if (company === 'phoenix') return phoenixKnex;
  if (company === 'inpack') return inpackKnex;
  return phoenixKnex;
};

module.exports = {
  getDB,
  getKnex,
  normalizeCompany,
  pools: { phoenixPool, inpackPool },
  knexs: { phoenixKnex, inpackKnex },
};

