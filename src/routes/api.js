import express from "express";
import * as queueController from "../controllers/queueController.js";
import * as workerController from "../controllers/workerController.js";
import * as authController from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Public routes (no authentication required)
router.post("/auth/login", authController.login);
router.post("/auth/register", authController.register);
router.get("/health", (req, res) => res.json({ ok: true, workerRunning: workerController.isWorkerRunning() }));

// Protected routes (authentication required)
router.get("/auth/verify", authenticateToken, authController.verify);
router.post("/enqueue", authenticateToken, queueController.enqueueDomains);
router.get("/queue", authenticateToken, queueController.getQueue);
router.get("/download", authenticateToken, queueController.downloadEmails);

router.post("/start-worker", authenticateToken, workerController.startWorker);
router.post("/stop-worker", authenticateToken, workerController.stopWorker);

router.get("/status", authenticateToken, async (req, res) => {
    // Intercept to add worker status
    const originalJson = res.json;
    res.json = function (data) {
        data.workerRunning = workerController.isWorkerRunning();
        data.activeCrawls = workerController.getActiveCrawls();
        originalJson.call(this, data);
    };
    await queueController.getStatus(req, res);
});

export default router;
