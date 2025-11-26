import pool from "./src/config/db.js";

const addIndex = async () => {
    try {
        const conn = await pool.getConnection();
        console.log("Adding UNIQUE index to domain column...");
        // Use IGNORE to avoid errors if duplicates already exist (it might drop duplicates or fail, usually fails)
        // Better to truncate table or handle duplicates first. 
        // For this task, I'll try to add it. If it fails due to duplicates, I'll clear the table first (dev environment assumption).

        try {
            await conn.query("ALTER TABLE domain_queue ADD UNIQUE INDEX idx_domain (domain)");
            console.log("✅ Index added.");
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                console.log("⚠️ Duplicates found. Clearing table to enforce uniqueness (Dev Mode action)...");
                await conn.query("TRUNCATE TABLE domain_queue");
                await conn.query("ALTER TABLE domain_queue ADD UNIQUE INDEX idx_domain (domain)");
                console.log("✅ Table cleared and Index added.");
            } else if (err.code === 'ER_DUP_KEYNAME') {
                console.log("ℹ️ Index already exists.");
            } else {
                throw err;
            }
        }

        conn.release();
        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to add index:", err.message);
        process.exit(1);
    }
};

addIndex();
