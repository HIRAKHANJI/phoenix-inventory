const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('--- PHOENIX SYSTEMS OPERATIONAL ---');
  console.log(`Port: ${PORT}`);
  console.log(`Node: ${process.env.NODE_ENV || 'production'}`);
  console.log('---------------------------------');
});

// Global Resilience Protocol
process.on('unhandledRejection', (reason, promise) => {
    console.error('--- CRITICAL UNHANDLED REJECTION ---');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    console.error('------------------------------------');
});

process.on('uncaughtException', (err) => {
    console.error('--- CRITICAL UNCAUGHT EXCEPTION ---');
    console.error('Error:', err);
    console.error('----------------------------------');
    
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is currently unavailable. Ensure no other instances are running.`);
        process.exit(1);
    }
});