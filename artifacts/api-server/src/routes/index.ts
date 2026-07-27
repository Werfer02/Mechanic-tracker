import { Router, type IRouter } from "express";
import healthRouter from "./health";
import syncRouter from "./sync";
import desktopRouter from "./desktop";

const router: IRouter = Router();

router.use(healthRouter);
router.use(syncRouter);
router.use(desktopRouter);

export default router;
