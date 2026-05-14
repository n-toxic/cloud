import { Router } from "express";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import instancesRouter from "./instances.js";
import supportRouter from "./support.js";
import adminRouter from "./admin.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ status: "online", service: "Techofy Cloud API", timestamp: new Date().toISOString() }));

router.use(authRouter);
router.use(usersRouter);
router.use(instancesRouter);
router.use(supportRouter);
router.use(adminRouter);

export default router;
