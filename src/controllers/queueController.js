import * as queueService from "../services/queueService.js";
import ExcelJS from "exceljs";
import pool from "../config/db.js";
import logger from "../utils/logger.js";
import { toSerializable } from "../utils/helpers.js";

export const enqueueDomains = async (req, res) => {
    try {
        const { domains } = req.body;
        if (!Array.isArray(domains) || domains.length === 0) {
            return res.status(400).json({ error: "No domains provided" });
        }

        await queueService.addToQueue(domains);
        res.json({ queued: domains.length });
    } catch (err) {
        logger.error(`Enqueue error: ${err.message}`);
        res.status(500).json({ error: "enqueue failed" });
    }
};

export const getStatus = async (req, res) => {
    try {
        const statusData = await queueService.getQueueStatus();
        // We need to inject worker status here, or handle it in a unified way. 
        // For now, we will pass it from the worker controller or global state if possible.
        // But since controllers are stateless, we might need a shared state manager.
        // For simplicity, we'll let the route handler merge the worker status.
        res.json(toSerializable(statusData));
    } catch (err) {
        logger.error(`Status error: ${err.message}`);
        res.status(500).json({ error: "status error" });
    }
};

export const getQueue = async (req, res) => {
    try {
        const rows = await queueService.getQueueList();

        const cleaned = rows.map(row => {
            let emails = row.emails || "";
            if (emails.startsWith("[") && emails.endsWith("]")) {
                try {
                    const arr = JSON.parse(emails);
                    emails = arr.join(", ");
                } catch { }
            }
            return {
                id: Number(row.id),
                domain: row.domain,
                status: row.status,
                updated_at: row.updated_at,
                emails: emails
            };
        });

        res.json(cleaned);
    } catch (err) {
        logger.error(`Queue list error: ${err.message}`);
        res.status(500).json({ error: "Failed to load queue" });
    }
};

export const downloadEmails = async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();

        // Get only NEW (undownloaded) emails
        const rows = await conn.query(`
            SELECT domain, email, id
            FROM emails
            WHERE downloaded = 0
            ORDER BY domain ASC, email ASC
        `);

        // If no new emails, return error
        if (rows.length === 0) {
            logger.info("No new emails to download");
            return res.status(404).json({
                error: "No new emails to download"
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Extracted Emails");

        worksheet.columns = [
            { header: "Domain", key: "domain", width: 30 },
            { header: "Email", key: "email", width: 50 },
        ];

        // Collect IDs to mark as downloaded
        const emailIds = [];

        rows.forEach((row) => {
            worksheet.addRow({
                domain: row.domain,
                email: row.email,
            });
            emailIds.push(row.id);
        });

        worksheet.getRow(1).font = { bold: true };
        worksheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: 2 },
        };

        // Mark emails as downloaded BEFORE sending the file
        if (emailIds.length > 0) {
            await conn.query(`
                UPDATE emails 
                SET downloaded = 1 
                WHERE id IN (${emailIds.join(',')})
            `);
            logger.info(`Marked ${emailIds.length} emails as downloaded`);
        }

        const timestamp = new Date().toISOString().split('T')[0];
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=emails_${timestamp}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        logger.error(`Excel export failed: ${err.message}`);
        res.status(500).json({ error: "Failed to export Excel" });
    } finally {
        if (conn) conn.release();
    }
};
