import { Router } from "express";
import { setErrorModule } from "../middleware/errorContext.middleware.js";

const router = Router();

router.use(setErrorModule("destination"));

export default router;
