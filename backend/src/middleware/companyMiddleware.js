const { getDB, getKnex, normalizeCompany } = require('../config/dbManager');

const companyMiddleware = (req, res, next) => {
  const headerCompany = req.header('x-company');
  const normalized = normalizeCompany(headerCompany);

  // Backward-compatible default: Phoenix when header is missing/invalid.
  const company = normalized || 'phoenix';

  try {
    req.company = company;
    req.db = getDB(company);
    req.knex = getKnex(company);
    req.companyHeader = headerCompany;
    next();
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ message: err.message || 'Tenant database configuration error.' });
  }
};

module.exports = companyMiddleware;

