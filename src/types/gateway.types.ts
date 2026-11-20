import { RowDataPacket } from "mysql2/promise";

export interface GatewayPayload {
  gateway: string;
  username?: string | null;
  password?: string | null;
  from_user?: string | null;
  domain_name: string;
  sbcDomainIp: string;
  proxy: string;
  realm?: string | null;
  expire_seconds: number;
  retry_seconds: number;
  context?: string | null;
  profile?: string | null;
  register?: boolean;
  enabled?: boolean;
  description?: string | null;
  auth_username?: string | null;
  extension?: string | null;
  register_transport?: string | null;
  register_proxy?: string | null;
  outbound_proxy?: string | null;
  sip_cid_type?: string | null;
  codec_prefs?: string | null;
  ping?: number | null;
  ping_min?: number | null;
  ping_max?: number | null;
  channels?: number | null;
  hostname?: string | null;
  distinct_to?: boolean;
  caller_id_in_from?: boolean;
  supress_cng?: boolean;
  extension_in_contact?: boolean;
}

export type FieldRule = {
  type: "string" | "integer" | "boolean";
  required?: boolean;
  nullable?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
};

export interface GatewayListQuery {
  page: number;
  pageSize: number;
  search: string;
}

export interface GatewayRow extends RowDataPacket {
  id: number;
  gateway_uuid: string;
  gateway: string;
  username: string | null;
  from_user: string | null;
  domain_name: string;
  sbcDomainIp: string;
  proxy: string;
  realm: string | null;
  expire_seconds: number;
  retry_seconds: number;
  context: string | null;
  profile: string | null;
  register: number;
  enabled: number;
  description: string | null;
  auth_username: string | null;
  extension: string | null;
  register_transport: string | null;
  register_proxy: string | null;
  outbound_proxy: string | null;
  sip_cid_type: string | null;
  codec_prefs: string | null;
  ping: number | null;
  ping_min: number | null;
  ping_max: number | null;
  channels: number | null;
  hostname: string | null;
  distinct_to: number;
  caller_id_in_from: number;
  supress_cng: number;
  extension_in_contact: number;
  created_at: Date;
  updated_at: Date;
}

export interface GatewayListResult {
  gateways: Omit<
    GatewayRow,
    | "password"
    | "register"
    | "enabled"
    | "distinct_to"
    | "caller_id_in_from"
    | "supress_cng"
    | "extension_in_contact"
  > &
    {
      register: boolean;
      enabled: boolean;
      distinct_to: boolean;
      caller_id_in_from: boolean;
      supress_cng: boolean;
      extension_in_contact: boolean;
    }[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface GatewayDetails extends RowDataPacket {
  id: number;
  gateway_uuid: string;
  gateway: string;
  username: string | null;
  from_user: string | null;
  domain_name: string;
  sbcDomainIp: string;
  proxy: string;
  realm: string | null;
  expire_seconds: number;
  retry_seconds: number;
  context: string | null;
  profile: string | null;
  register: number;
  enabled: number;
  description: string | null;
  auth_username: string | null;
  extension: string | null;
  register_transport: string | null;
  register_proxy: string | null;
  outbound_proxy: string | null;
  sip_cid_type: string | null;
  codec_prefs: string | null;
  ping: number | null;
  ping_min: number | null;
  ping_max: number | null;
  channels: number | null;
  hostname: string | null;
  distinct_to: number;
  caller_id_in_from: number;
  supress_cng: number;
  extension_in_contact: number;
  created_at: Date;
  updated_at: Date;
}

export type GatewayDetailsResponse = Omit<
  GatewayDetails,
  | "register"
  | "enabled"
  | "distinct_to"
  | "caller_id_in_from"
  | "supress_cng"
  | "extension_in_contact"
> & {
  register: boolean;
  enabled: boolean;
  distinct_to: boolean;
  caller_id_in_from: boolean;
  supress_cng: boolean;
  extension_in_contact: boolean;
};

export interface UpdatedGateway extends RowDataPacket {
  id: number;
  gateway_uuid: string;
  gateway: string;
  username: string | null;
  from_user: string | null;
  domain_name: string;
  sbcDomainIp: string;
  proxy: string;
  realm: string | null;
  expire_seconds: number;
  retry_seconds: number;
  context: string | null;
  profile: string | null;
  register: number;
  enabled: number;
  description: string | null;
  auth_username: string | null;
  extension: string | null;
  register_transport: string | null;
  register_proxy: string | null;
  outbound_proxy: string | null;
  sip_cid_type: string | null;
  codec_prefs: string | null;
  ping: number | null;
  ping_min: number | null;
  ping_max: number | null;
  channels: number | null;
  hostname: string | null;
  distinct_to: number;
  caller_id_in_from: number;
  supress_cng: number;
  extension_in_contact: number;
  created_at: Date;
  updated_at: Date;
}

export interface UpdatedGatewayRow extends RowDataPacket {
  id: number;
  gateway_uuid: string;
  gateway: string;
  domain_name: string;
  sbcDomainIp: string;
  proxy: string;
  expire_seconds: number;
  retry_seconds: number;
  register: number | boolean;
  enabled: number | boolean;
  distinct_to: number | boolean;
  caller_id_in_from: number | boolean;
  supress_cng: number | boolean;
  extension_in_contact: number | boolean;
}

export type UpdatedGatewayResponse = Omit<
  UpdatedGatewayRow,
  | "register"
  | "enabled"
  | "distinct_to"
  | "caller_id_in_from"
  | "supress_cng"
  | "extension_in_contact"
> & {
  register: boolean;
  enabled: boolean;
  distinct_to: boolean;
  caller_id_in_from: boolean;
  supress_cng: boolean;
  extension_in_contact: boolean;
};

export const UPDATE_COLUMNS: (keyof GatewayPayload)[] = [
  "gateway",
  "username",
  "password",
  "from_user",
  "domain_name",
  "sbcDomainIp",
  "proxy",
  "realm",
  "expire_seconds",
  "retry_seconds",
  "context",
  "profile",
  "register",
  "enabled",
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
  "distinct_to",
  "caller_id_in_from",
  "supress_cng",
  "extension_in_contact",
];

export const BOOLEAN_COLUMNS = [
  "register",
  "enabled",
  "distinct_to",
  "caller_id_in_from",
  "supress_cng",
  "extension_in_contact",
] as const;

export interface GatewayIdRow extends RowDataPacket {
  id: number;
  username: string | null;
  password: string | null;
}

export interface GatewayTogglePayload {
  gatewayUuids: string[];
}

export interface GatewayToggleStatusPayload {
  gatewayUuids: string[];
  action: GatewayAction;
}

export interface GatewayStatusRow extends RowDataPacket {
  gateway_uuid: string;
  enabled: number | boolean;
}

export interface GatewayToggleResult {
  gateway_uuid: string;
  enabled: boolean;
}

export interface GatewayToggleResponse {
  action: GatewayAction;
  enabled: boolean;
  totalRequested: number;
  totalUpdated: number;
  gateways: {
    gateway_uuid: string;
    status: "Started" | "Stopped";
  }[];
}

export interface GatewayEnabledToggleResponse {
  totalUpdated: number;
  gateways: {
    gateway_uuid: string;
    enabled: boolean;
  }[];
}

export type GatewayAction = "start" | "stop";

export interface CreatedGateway extends RowDataPacket {
  id: number;
  gateway_uuid: string;
  gateway: string;
  domain_name: string;
  sbcDomainIp: string;
  proxy: string;
  expire_seconds: number;
  retry_seconds: number;
  register: number;
  enabled: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateGatewayResult {
  id: number;
  gateway_uuid: string;
  gateway: string;
  domain_name: string;
  sbcDomainIp: string;
  proxy: string;
  expire_seconds: number;
  retry_seconds: number;
  register: boolean;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface GatewayUuidRow extends RowDataPacket {
  gateway_uuid: string;
}

export interface GatewayDeleteResponse {
  totalRequested: number;
  totalDeleted: number;
  deletedGatewayUuids: string[];
}
