const sql = require("mssql");
require("dotenv").config();

const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

async function connectDB() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("✅ Connected to Azure SQL Database");
    return pool;
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    throw error;
  }
}

module.exports = {
  sql,
  connectDB,
};