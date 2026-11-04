import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sakanRouter from "./sakan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sakanRouter);

export default router;
