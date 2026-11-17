import { Router } from "express";
import {
  createExtension,
  deleteExtension,
  getExtension,
  getExtensions,
  updateExtension,
  extensionStatusToggle
} from "../controllers/extension.controller.ts.js";

const router = Router();

router.post("/", createExtension);
router.get("/", getExtensions);
router.get("/:extension", getExtension);
router.patch("/:extension_uuid", updateExtension);
router.patch("/:extension_uuid/status", extensionStatusToggle);
router.delete("/delete", deleteExtension);

export default router;
