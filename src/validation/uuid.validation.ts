import { AppError } from "../utils/AppError";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validateGatewayUUID = (gateway_uuid: unknown): string => {
  if (typeof gateway_uuid !== "string" || !UUID_REGEX.test(gateway_uuid)) {
    throw new AppError("Valid Gateway UUID is required", 400);
  }

  return gateway_uuid;
};
