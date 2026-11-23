import { Request, Response } from "express";
import {
  copyGatewayService,
  createGatewayService,
  deleteGatewayService,
  getGatewayDetailsService,
  getGatewaysService,
  toggleGatewayEnableService,
  toggleGatewayStatusService,
  updateGatewayService,
} from "../services/gateway.service";
import {
  validateCreateGateway,
  validateGatewayCopy,
  validateGatewayDelete,
  validateGatewayStatusToggle,
  validateGatewayToggle,
  validateUpdateGateway,
} from "../validation/gateway.validation";
import { validateGatewayUUID } from "../validation/uuid.validation";

export const createGateway = async (
  req: Request,
  res: Response,
): Promise<void> => {
  // Validate request body.
  const payload = validateCreateGateway(req.body);

  // Create gateway.
  const gateway = await createGatewayService(payload);

  res.status(201).json({
    success: true,
    message: "Gateway created successfully",
    data: gateway,
  });
};

export const getGateways = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const requestedPage = Number(req.query.page ?? 1);
  const requestedPageSize = Number(req.query.pageSize ?? 10);

  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const pageSize =
    Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
      ? Math.min(requestedPageSize, 100)
      : 10;

  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";

  const showAll = req.query.showAll === "true";

  const domain =
    typeof req.query.domain === "string" ? req.query.domain.trim() : "";

  const filters = { page, pageSize, search };

  const result = await getGatewaysService(filters, showAll, domain);

  res.status(200).json({
    success: true,
    message: result.gateways.length
      ? "Gateways retrieved successfully"
      : "No gateways found",
    data: result.gateways,
    ...result.pagination,
  });
};

export const getGatewayDetails = async (
  req: Request<{ gateway_uuid: string }>,
  res: Response,
): Promise<void> => {
  // Validate UUID from route parameters.
  const gateway_uuid = validateGatewayUUID(req.params.gateway_uuid);

  // Fetch gateway details.
  const gateway = await getGatewayDetailsService(gateway_uuid);

  res.status(200).json({
    success: true,
    message: "Gateway details retrieved successfully",
    data: gateway,
  });
};

export const updateGateway = async (
  req: Request<{ gateway_uuid: string }>,
  res: Response,
): Promise<void> => {
  const gateway_uuid = validateGatewayUUID(req.params.gateway_uuid);

  const payload = validateUpdateGateway(req.body);

  const gateway = await updateGatewayService(gateway_uuid, payload);

  res.status(200).json({
    success: true,
    message: "Gateway updated successfully",
    data: gateway,
  });
};

export const toggleGatewayStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { gatewayUuids, action } = validateGatewayStatusToggle(req.body);

  const result = await toggleGatewayStatusService(gatewayUuids, action);

  res.status(200).json({
    success: true,
    message:
      action === "start"
        ? "Gateways started successfully"
        : "Gateways stopped successfully",
    data: result,
  });
};

export const toggleGatewayEnableStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { gatewayUuids } = validateGatewayToggle(req.body);

  const result = await toggleGatewayEnableService(gatewayUuids);

  res.status(200).json({
    success: true,
    message: "Gateway statuses toggled successfully",
    data: result,
  });
};

export const deleteGateway = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { gatewayUuids } = validateGatewayDelete(req.body);

  const result = await deleteGatewayService(gatewayUuids);

  res.status(200).json({
    success: true,
    message: "Gateways deleted successfully",
    data: result,
  });
};

export const copyGateway = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { gatewayUuid, copy_gateway } = validateGatewayCopy(req.body);

  const gateway = await copyGatewayService(gatewayUuid, copy_gateway);

  res.status(201).json({
    success: true,
    message: "Gateway copied successfully",
    data: gateway,
  });
};
