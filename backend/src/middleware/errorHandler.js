const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  
  if (!isProduction) {
    console.error(`[Error] ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
  
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: isProduction ? null : err.stack,
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };
