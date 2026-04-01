import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import logger from "./logger.js";
import dotenv from "dotenv";

dotenv.config();

const setupAuth = async () => {
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Create Users Table
        logger.info("Creating users table...");
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Check if admin already exists
        const users = await conn.query("SELECT * FROM users WHERE username = 'admin'");
        
        if (users.length === 0) {
            logger.info("Creating initial admin user...");
            const defaultPassword = process.env.APP_PASSWORD || "admin123";
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(defaultPassword, salt);

            await conn.query(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                ["admin", hashedPassword, "admin"]
            );
            logger.info("✅ Admin user created successfully (username: 'admin')");
        } else {
            logger.info("ℹ️ Admin user already exists.");
        }

        logger.info("✨ Authentication setup complete!");
    } catch (err) {
        logger.error(`❌ Setup failed: ${err.message}`);
    } finally {
        if (conn) conn.release();
        process.exit();
    }
};

setupAuth();
