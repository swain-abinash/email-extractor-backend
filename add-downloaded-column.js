import pool from "./src/config/db.js";

const addDownloadedColumn = async () => {
    try {
        const conn = await pool.getConnection();

        // Check if column already exists
        const columns = await conn.query("DESCRIBE emails");
        const hasDownloaded = columns.some(col => col.Field === 'downloaded');

        if (hasDownloaded) {
            console.log("✅ Column 'downloaded' already exists");
            conn.release();
            process.exit(0);
            return;
        }

        // Add downloaded column with default FALSE (0)
        await conn.query(`
      ALTER TABLE emails 
      ADD COLUMN downloaded TINYINT(1) DEFAULT 0
    `);

        console.log("✅ Successfully added 'downloaded' column to emails table");
        console.log("   - Type: TINYINT(1)");
        console.log("   - Default: 0 (not downloaded)");

        conn.release();
        process.exit(0);
    } catch (err) {
        console.error("❌ Error adding downloaded column:", err.message);
        process.exit(1);
    }
};

addDownloadedColumn();
