import { Router, type IRouter } from "express";
import healthRouter from "./health";
import syncRouter from "./sync";
import desktopRouter from "./desktop";
import photosRouter from "./photos";

const router: IRouter = Router();

router.use(healthRouter);
router.use(syncRouter);
router.use(desktopRouter);
router.use(photosRouter);

export default router;
