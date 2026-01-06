require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set in environment variables');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = sql;
