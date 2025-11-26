import pool from "../config/db.js";
import logger from "../utils/logger.js";

export const claimQueuedDomains = async (limitCount) => {
    const conn = await pool.getConnection();
    try {
        await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
        await conn.beginTransaction();
        const rows = await conn.query(
            `SELECT id, domain, url, retry_count FROM domain_queue WHERE status='queued' ORDER BY id ASC LIMIT ? FOR UPDATE`,
            [limitCount]
        );
        if (!rows || rows.length === 0) {
            await conn.commit();
            return [];
        }
        const ids = rows.map((r) => r.id);
        await conn.query(`UPDATE domain_queue SET status='processing', updated_at=NOW() WHERE id IN (?)`, [ids]);
        await conn.commit();
        return rows;
    } catch (err) {
        try { await conn.rollback(); } catch { }
        logger.error(`Error claiming domains: ${err.message}`);
        return [];
    } finally {
        conn.release();
    }
};

export const saveEmailsToDB = async (emails, sourceUrl, domain) => {
    if (!emails || emails.length === 0) return;
    const conn = await pool.getConnection();
    try {
        for (const e of emails) {
            try {
                await conn.query(
                    `INSERT IGNORE INTO emails (email, source_url, domain, crawled_at) VALUES (?, ?, ?, NOW())`,
                    [e, sourceUrl, domain]
                );
            } catch { /* ignore individual insert error */ }
        }
    } finally {
        conn.release();
    }
};

export const updateDomainStatus = async (id, status, emails = [], error = null, retryCount = 0) => {
    const conn = await pool.getConnection();
    try {
        if (status === 'done') {
            await conn.query(
                `UPDATE domain_queue 
                 SET status='done', 
                     emails=?, 
                     updated_at=NOW() 
                 WHERE id=?`,
                [JSON.stringify(emails), id]
            );
        } else {
            await conn.query(
                `UPDATE domain_queue 
                 SET retry_count=?, last_error=?, status=?, updated_at=NOW() 
                 WHERE id=?`,
                [retryCount, error, status, id]
            );
        }
    } finally {
        conn.release();
    }
};

export const addToQueue = async (domains) => {
    if (!domains || domains.length === 0) return;
    const conn = await pool.getConnection();
    try {
        const values = [];
        for (let d of domains) {
            const domain = (d || "").trim();
            if (!domain) continue;
            const url = domain.startsWith("http") ? domain : `https://${domain}`;
            values.push([domain, url, 'queued']);
        }

        if (values.length === 0) return;

        // Batch insert
        await conn.batch(
            `INSERT INTO domain_queue (domain, url, status, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE domain=domain`,
            values
        );
    } finally {
        conn.release();
    }
};

export const getQueueStatus = async () => {
    const conn = await pool.getConnection();
    try {
        const totals = await conn.query(
            `SELECT status, COUNT(*) as cnt FROM domain_queue GROUP BY status`
        );
        const processingRow = await conn.query(
            `SELECT COUNT(*) as cnt FROM domain_queue WHERE status='processing'`
        );
        const emailsCountRow = await conn.query(`SELECT COUNT(*) as cnt FROM emails`);

        return {
            totals,
            processing: processingRow[0]?.cnt || 0,
            emails: emailsCountRow[0]?.cnt || 0,
        };
    } finally {
        conn.release();
    }
};

export const getQueueList = async () => {
    const conn = await pool.getConnection();
    try {
        return await conn.query(`
            SELECT 
              dq.id,
              dq.domain,
              dq.status,
              dq.updated_at,
              COALESCE(
                CASE 
                  WHEN dq.emails IS NOT NULL AND dq.emails != '' THEN dq.emails
                  ELSE (
                    SELECT GROUP_CONCAT(e.email SEPARATOR ', ')
                    FROM emails e
                    WHERE e.domain = dq.domain
                  )
                END,
              '') AS emails
            FROM domain_queue dq
            ORDER BY dq.id DESC
            LIMIT 100
          `);
    } finally {
        conn.release();
    }
};
