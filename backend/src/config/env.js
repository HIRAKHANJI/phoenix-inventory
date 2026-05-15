const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { cleanEnv, str, port } = require('envalid');

const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 5000 }),
  // Legacy single-DB settings (Phoenix default)
  DB_HOST: str({ default: 'localhost' }),
  DB_USER: str({ default: 'postgres' }),
  DB_PASSWORD: str({ default: 'root' }),
  DB_NAME: str({ default: 'inventory_system' }),
  DB_PORT: port({ default: 5432 }),

  // Multi-tenant DB URLs (preferred)
  PHOENIX_DB_URL: str({ default: '' }),
  INPACK_DB_URL: str({ default: '' }),
  JWT_SECRET: str({ default: process.env.NODE_ENV === 'development' ? 'dev_access_secret' : undefined }),
  JWT_REFRESH_SECRET: str({ default: process.env.NODE_ENV === 'development' ? 'dev_refresh_secret' : undefined }),
  ACCESS_TOKEN_EXPIRY: str({ default: '15m' }),
  REFRESH_TOKEN_EXPIRY: str({ default: '7d' }),
});

module.exports = env;
