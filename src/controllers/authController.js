import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";

// In a production environment, you'd hash the password and store it in a database
// For simplicity, we're using a plain password from environment variables
const APP_PASSWORD = process.env.APP_PASSWORD || "admin123";

export const login = async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: "Password is required" });
        }

        // Simple password comparison
        if (password !== APP_PASSWORD) {
            logger.warn(`Failed login attempt`);
            return res.status(401).json({ error: "Invalid password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { authenticated: true, timestamp: Date.now() },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        logger.info("Successful login");
        res.json({
            token,
            message: "Login successful",
            expiresIn: "24h"
        });
    } catch (err) {
        logger.error(`Login error: ${err.message}`);
        res.status(500).json({ error: "Login failed" });
    }
};

export const verify = async (req, res) => {
    // If the middleware passed, the token is valid
    res.json({ valid: true, user: req.user });
};
