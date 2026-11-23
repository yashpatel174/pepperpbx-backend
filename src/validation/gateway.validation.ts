import {
  FieldRule,
  GatewayCopyPayload,
  GatewayPayload,
  GatewayTogglePayload,
  GatewayToggleStatusPayload,
} from "../types/gateway.types";
import { AppError } from "../utils/AppError";
import { UUID_REGEX } from "./uuid.validation";

const gatewaySchema: Record<keyof GatewayPayload, FieldRule> = {
  gateway: {
    type: "string",
    required: true,
    maxLength: 255,
  },
  username: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  password: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  from_user: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  domain_name: {
    type: "string",
    required: true,
    maxLength: 255,
  },
  sbcDomainIp: {
    type: "string",
    required: true,
    maxLength: 255,
  },
  proxy: {
    type: "string",
    required: true,
    maxLength: 255,
  },
  realm: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  expire_seconds: {
    type: "integer",
    required: true,
    min: 0,
    max: 4294967295,
  },
  retry_seconds: {
    type: "integer",
    required: true,
    min: 0,
    max: 4294967295,
  },
  context: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  profile: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  register: {
    type: "boolean",
  },
  enabled: {
    type: "boolean",
  },
  description: {
    type: "string",
    nullable: true,
    maxLength: 150,
  },
  auth_username: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  extension: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  register_transport: {
    type: "string",
    nullable: true,
    maxLength: 50,
  },
  register_proxy: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  outbound_proxy: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  sip_cid_type: {
    type: "string",
    nullable: true,
    maxLength: 50,
  },
  codec_prefs: {
    type: "string",
    nullable: true,
  },
  ping: {
    type: "integer",
    nullable: true,
    min: -2147483648,
    max: 2147483647,
  },
  ping_min: {
    type: "integer",
    nullable: true,
    min: -2147483648,
    max: 2147483647,
  },
  ping_max: {
    type: "integer",
    nullable: true,
    min: -2147483648,
    max: 2147483647,
  },
  channels: {
    type: "integer",
    nullable: true,
    min: 0,
    max: 4294967295,
  },
  hostname: {
    type: "string",
    nullable: true,
    maxLength: 255,
  },
  distinct_to: {
    type: "boolean",
  },
  caller_id_in_from: {
    type: "boolean",
  },
  supress_cng: {
    type: "boolean",
  },
  extension_in_contact: {
    type: "boolean",
  },
};

const hasOwn = (object: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

export const validateCreateGateway = (
  payload: Record<string, unknown>,
): GatewayPayload => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new AppError("Valid payload is required", 400);
  }

  const input = payload as Record<string, unknown>;

  const invalidFields: string[] = [];
  const validatedPayload: Record<string, unknown> = {};

  // Reject unsupported fields.
  for (const key of Object.keys(input)) {
    if (!hasOwn(gatewaySchema, key)) {
      invalidFields.push(key);
    }
  }

  // Validate all supported fields dynamically.
  for (const [field, rule] of Object.entries(gatewaySchema)) {
    if (!hasOwn(input, field)) {
      if (rule.required) {
        invalidFields.push(`${field} is required`);
      }

      continue;
    }

    const value = input[field];

    if (value === null) {
      if (rule.nullable) {
        validatedPayload[field] = null;
      } else {
        invalidFields.push(`${field} cannot be null`);
      }

      continue;
    }

    if (rule.type === "string") {
      if (typeof value !== "string") {
        invalidFields.push(`${field} must be a string`);
        continue;
      }

      if (rule.required && !value.trim()) {
        invalidFields.push(`${field} is required`);
        continue;
      }

      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        invalidFields.push(
          `${field} must not exceed ${rule.maxLength} characters`,
        );
        continue;
      }

      validatedPayload[field] = rule.required ? value.trim() : value;

      continue;
    }

    if (rule.type === "integer") {
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        invalidFields.push(`${field} must be a valid integer`);
        continue;
      }

      if (
        (rule.min !== undefined && value < rule.min) ||
        (rule.max !== undefined && value > rule.max)
      ) {
        invalidFields.push(
          `${field} must be between ${rule.min} and ${rule.max}`,
        );
        continue;
      }

      validatedPayload[field] = value;
      continue;
    }

    if (rule.type === "boolean") {
      if (typeof value !== "boolean") {
        invalidFields.push(`${field} must be a boolean`);
        continue;
      }

      validatedPayload[field] = value;
    }
  }

  // Registration-specific validation.
  const isRegistered = validatedPayload.register === true;

  if (isRegistered) {
    for (const field of ["username", "password"] as const) {
      const value = validatedPayload[field];

      if (typeof value !== "string" || !value.trim()) {
        invalidFields.push(`${field} is required when register is true`);
      }
    }
  }

  if (invalidFields.length > 0) {
    throw new AppError(
      `Invalid fields: ${[...new Set(invalidFields)].join(", ")}`,
      400,
    );
  }

  return validatedPayload as unknown as GatewayPayload;
};

const OPTIONAL_FIELDS: (keyof GatewayPayload)[] = [
  "username",
  "from_user",
  "realm",
  "context",
  "profile",
  "description",
  "auth_username",
  "extension",
  "register_transport",
  "register_proxy",
  "outbound_proxy",
  "sip_cid_type",
  "codec_prefs",
  "ping",
  "ping_min",
  "ping_max",
  "channels",
  "hostname",
];

const BOOLEAN_DEFAULTS: Partial<Record<keyof GatewayPayload, boolean>> = {
  register: false,
  enabled: true,
  distinct_to: false,
  caller_id_in_from: false,
  supress_cng: false,
  extension_in_contact: false,
};

const REQUIRED_FIELDS: (keyof GatewayPayload)[] = [
  "gateway",
  "domain_name",
  "sbcDomainIp",
  "proxy",
  "expire_seconds",
  "retry_seconds",
];

export const validateUpdateGateway = (
  payload: Record<string, unknown>,
): GatewayPayload => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new AppError("Valid gateway payload is required", 400);
  }

  const input = payload as Record<string, unknown>;

  const missingFields = REQUIRED_FIELDS.filter(
    (field) =>
      field !== "password" &&
      !Object.prototype.hasOwnProperty.call(input, field),
  );

  if (missingFields.length > 0) {
    throw new AppError(
      `Required fields are missing: ${missingFields.join(", ")}`,
      400,
    );
  }

  // Validate register independently.
  if (
    Object.prototype.hasOwnProperty.call(input, "register") &&
    typeof input.register !== "boolean"
  ) {
    throw new AppError("Invalid register value", 400);
  }

  const validationInput: Record<string, unknown> = {
    ...input,

    // Bypass create-time password requirement.
    register: false,
  };

  // Empty password means no password change.
  if (!input.password) {
    delete validationInput.password;
  }

  // Validate all remaining fields using existing create validation.
  const validated = validateCreateGateway(validationInput);

  const result: Record<string, unknown> = {
    ...validated,
  };

  // Restore the actual registration value.
  if (Object.prototype.hasOwnProperty.call(input, "register")) {
    result.register = input.register;
  }

  // Clear omitted optional fields, except password.
  for (const field of OPTIONAL_FIELDS) {
    if (
      field !== "password" &&
      !Object.prototype.hasOwnProperty.call(input, field)
    ) {
      result[field] = null;
    }
  }

  // Apply defaults to omitted boolean fields.
  for (const [field, defaultValue] of Object.entries(BOOLEAN_DEFAULTS)) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      result[field] = defaultValue;
    }
  }

  // Never update password when it is empty or omitted.
  if (!input.password) {
    delete result.password;
  }

  return result as unknown as GatewayPayload;
};

const MAX_GATEWAYS_PER_REQUEST = 500;

export const validateGatewayToggle = (
  payload: unknown,
): GatewayTogglePayload => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new AppError("Valid request payload is required", 400);
  }

  const input = payload as Record<string, unknown>;

  if (Object.keys(input).some((key) => key !== "gatewayUuids")) {
    throw new AppError("Unknown request field", 400);
  }

  if (!Array.isArray(input.gatewayUuids)) {
    throw new AppError("gatewayUuids must be an array", 400);
  }

  const gatewayUuids = input.gatewayUuids;

  if (gatewayUuids.length === 0) {
    throw new AppError("At least one gateway UUID is required", 400);
  }

  if (gatewayUuids.length > MAX_GATEWAYS_PER_REQUEST) {
    throw new AppError(
      `Maximum ${MAX_GATEWAYS_PER_REQUEST} gateways can be toggled at once`,
      400,
    );
  }

  if (
    !gatewayUuids.every(
      (uuid): uuid is string =>
        typeof uuid === "string" && UUID_REGEX.test(uuid),
    )
  ) {
    throw new AppError("One or more gateway UUIDs are invalid", 400);
  }

  // Normalize UUIDs and reject duplicates.
  const normalizedUuids = gatewayUuids.map((uuid) => uuid.toLowerCase());

  if (new Set(normalizedUuids).size !== normalizedUuids.length) {
    throw new AppError("Duplicate gateway UUIDs are not allowed", 400);
  }

  return {
    gatewayUuids: normalizedUuids,
  };
};

export const validateGatewayDelete = (
  payload: unknown,
): GatewayTogglePayload => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new AppError("Valid request payload is required", 400);
  }

  const input = payload as Record<string, unknown>;

  if (Object.keys(input).some((key) => key !== "gatewayUuids")) {
    throw new AppError("Unknown request field", 400);
  }

  if (!Array.isArray(input.gatewayUuids)) {
    throw new AppError("gatewayUuids must be an array", 400);
  }

  const gatewayUuids = input.gatewayUuids;

  if (
    gatewayUuids.length === 0 ||
    gatewayUuids.length > MAX_GATEWAYS_PER_REQUEST
  ) {
    throw new AppError(
      `gatewayUuids must contain between 1 and ${MAX_GATEWAYS_PER_REQUEST} UUIDs`,
      400,
    );
  }

  if (
    !gatewayUuids.every(
      (uuid): uuid is string =>
        typeof uuid === "string" && UUID_REGEX.test(uuid),
    )
  ) {
    throw new AppError("One or more gateway UUIDs are invalid", 400);
  }

  const normalizedUuids = gatewayUuids.map((uuid) => uuid.toLowerCase());

  if (new Set(normalizedUuids).size !== normalizedUuids.length) {
    throw new AppError("Duplicate gateway UUIDs are not allowed", 400);
  }

  return {
    gatewayUuids: normalizedUuids,
  };
};

export const validateGatewayStatusToggle = (
  payload: unknown,
): GatewayToggleStatusPayload => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new AppError("Valid request payload is required", 400);
  }

  const input = payload as Record<string, unknown>;

  const allowedFields = ["gatewayUuids", "action"];

  if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
    throw new AppError("Unknown request field", 400);
  }

  if (!Array.isArray(input.gatewayUuids)) {
    throw new AppError("gatewayUuids must be an array", 400);
  }

  if (
    input.gatewayUuids.length === 0 ||
    input.gatewayUuids.length > MAX_GATEWAYS_PER_REQUEST
  ) {
    throw new AppError(
      `gatewayUuids must contain between 1 and ${MAX_GATEWAYS_PER_REQUEST} UUIDs`,
      400,
    );
  }

  if (
    !input.gatewayUuids.every(
      (uuid): uuid is string =>
        typeof uuid === "string" && UUID_REGEX.test(uuid),
    )
  ) {
    throw new AppError("One or more gateway UUIDs are invalid", 400);
  }

  if (input.action !== "start" && input.action !== "stop") {
    throw new AppError('action must be either "start" or "stop"', 400);
  }

  const gatewayUuids = input.gatewayUuids.map((uuid) => uuid.toLowerCase());

  if (new Set(gatewayUuids).size !== gatewayUuids.length) {
    throw new AppError("Duplicate gateway UUIDs are not allowed", 400);
  }

  return {
    gatewayUuids,
    action: input.action,
  };
};

export const validateGatewayCopy = (payload: unknown): GatewayCopyPayload => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new AppError("Valid request payload is required", 400);
  }

  const input = payload as Record<string, unknown>;

  const allowedFields = ["gatewayUuid", "new_gateway"];

  if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
    throw new AppError("Unknown request field", 400);
  }

  if (
    typeof input.gatewayUuid !== "string" ||
    !UUID_REGEX.test(input.gatewayUuid)
  ) {
    throw new AppError("Valid gatewayUuid is required", 400);
  }

  if (typeof input.new_gateway !== "string" || !input.new_gateway.trim()) {
    throw new AppError("copy_gateway is required", 400);
  }

  const copyGateway = input.new_gateway.trim();

  if (copyGateway.length > 255) {
    throw new AppError("copy_gateway cannot exceed 255 characters", 400);
  }

  return {
    gatewayUuid: input.gatewayUuid.toLowerCase(),
    copy_gateway: copyGateway,
  };
};
