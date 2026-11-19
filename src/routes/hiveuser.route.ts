import { Router } from "express";
import { getDomains } from "../controllers/hiveuser.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/details", asyncHandler(getDomains));

export default router;
