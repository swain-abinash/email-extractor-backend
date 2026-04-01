import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";
import pool from "../config/db.js";

// Login: Find user in DB and compare hashed password
export const login = async (req, res) => {
    let conn;
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        conn = await pool.getConnection();
        const users = await conn.query("SELECT * FROM users WHERE username = ?", [username]);

        if (users.length === 0) {
            logger.warn(`Failed login attempt: User ${username} not found`);
            return res.status(401).json({ error: "Username not found. Please register first." });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            logger.warn(`Failed login attempt: Incorrect password for ${username}`);
            return res.status(401).json({ error: "Wrong password. Please try again." });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        logger.info(`Successful login: ${username}`);
        res.json({
            token,
            user: { id: user.id, username: user.username, role: user.role },
            message: "Login successful"
        });
    } catch (err) {
        logger.error(`Login error: ${err.message}`);
        res.status(500).json({ error: "Login failed" });
    } finally {
        if (conn) conn.release();
    }
};

// Register: Hash password and store new user
export const register = async (req, res) => {
    let conn;
    try {
        const { username, password, role = "admin" } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        conn = await pool.getConnection();
        await conn.query(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            [username, hashedPassword, role]
        );

        logger.info(`New user registered: ${username}`);
        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Username already exists" });
        }
        logger.error(`Registration error: ${err.message}`);
        res.status(500).json({ error: "Registration failed" });
    } finally {
        if (conn) conn.release();
    }
};

export const verify = async (req, res) => {
    res.json({ valid: true, user: req.user });
};
