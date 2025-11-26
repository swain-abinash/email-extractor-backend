import pool from "./src/config/db.js";

const inspectSchema = async () => {
    try {
        const conn = await pool.getConnection();
        const rows = await conn.query("DESCRIBE emails");
        console.log(rows);
        conn.release();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

inspectSchema();
