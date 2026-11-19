import { Router } from "express";
import {
  createGateway,
  getGatewayDetails,
  getGateways,
  toggleGatewayEnableStatus,
  toggleGatewayStatus,
  updateGateway,
} from "../controllers/gateway.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.post("/", asyncHandler(createGateway));
router.get("/", asyncHandler(getGateways));
router.patch("/toggle-status", asyncHandler(toggleGatewayStatus));
router.patch("/toggle-enabled-status", asyncHandler(toggleGatewayEnableStatus));
router.get("/:gateway_uuid", asyncHandler(getGatewayDetails));
router.patch("/:gateway_uuid", asyncHandler(updateGateway));

export default router;
