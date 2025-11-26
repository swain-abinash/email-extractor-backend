import mariadb from "mariadb";

const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "root",
  database: "email_extractor",
  connectionLimit: 10,
};

const pool = mariadb.createPool(DB_CONFIG);

export default pool;
