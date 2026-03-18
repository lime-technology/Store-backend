import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import dashboardRouter from "./dashboard.js";
import scanRouter from "./scan.js";
import storeRouter from "./store.js";

const router: IRouter = Router();

// Log every incoming request
router.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} /api${req.path}`);
  next();
});

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(scanRouter);
router.use(storeRouter);

export default router;
