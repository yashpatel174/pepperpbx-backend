import { Router } from "express";
import {
  createGateway,
  deleteGateway,
  getGatewayDetails,
  getGateways,
  toggleGatewayEnableStatus,
  toggleGatewayStatus,
  updateGateway,
} from "../controllers/gateway.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { setErrorModule } from "../middleware/errorContext.middleware";

const router = Router();

router.use(setErrorModule("gateway"));

router.post("/create", asyncHandler(createGateway));
router.get("/list", asyncHandler(getGateways));
router.patch("/startStop", asyncHandler(toggleGatewayStatus));
router.patch("/toggle", asyncHandler(toggleGatewayEnableStatus));
router.get("/details/:gateway_uuid", asyncHandler(getGatewayDetails));
router.patch("/update/:gateway_uuid", asyncHandler(updateGateway));
router.delete("/delete", asyncHandler(deleteGateway));

export default router;
