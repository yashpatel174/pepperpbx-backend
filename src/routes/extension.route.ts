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
import { setErrorModule } from "../middleware/errorContext.middleware.js";

const router = Router();

router.use(setErrorModule("extensions"));

router.post("/create", asyncHandler(createExtension));
router.post("/copy", asyncHandler(copyExtension));
router.get("/", asyncHandler(getExtensions));
router.patch("/toggle", asyncHandler(bulkExtensionStatus));
router.get("/:extension", asyncHandler(getExtension));
router.patch("/update", asyncHandler(updateExtension));
router.patch("/update/:extension_uuid", asyncHandler(enableExtension));
router.delete("/delete", asyncHandler(deleteExtension));

export default router;
