import { Router } from "express";
import {
  createExtension,
  copyExtension,
  deleteExtension,
  getExtension,
  getExtensions,
  updateExtension,
  enableExtension,
  bulkExtensionStatus,
} from "../controllers/extension.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.post("/create", asyncHandler(createExtension));
router.post("/copy", asyncHandler(copyExtension));
router.get("/", asyncHandler(getExtensions));
router.patch("/toggle", asyncHandler(bulkExtensionStatus));
router.get("/:extension", asyncHandler(getExtension));
router.patch("/update", asyncHandler(updateExtension));
router.patch("/update/:extension_uuid", asyncHandler(enableExtension));
router.delete("/delete", asyncHandler(deleteExtension));

export default router;
