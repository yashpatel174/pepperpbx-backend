import { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export interface ExtensionListQuery {
  page: number;
  pageSize: number;
  search: string;
  showAll: boolean;
}

export interface ExtensionListResult {
  data: ExtensionRow[];
  page: number;
  pageSize: number;
  total_records: number;
  total_pages: number;
}

export interface ExtensionListResponse {
  data: any;
  page: number;
  pageSize: number;
  total_records: number;
  total_pages: number;
}

export interface CreatedExtension extends RowDataPacket {
  extension_uuid: string;
  extension: string;
}

export interface CreateExtensionResult {
  result: ResultSetHeader;
  extensions: CreatedExtension[];
}

export interface ExtensionPayload {
  absolute_codec_string?: string | null;
  accountcode: string;
  auth_acl?: string | null;
  call_group?: string | null;
  call_screen_enabled?: boolean | null;
  call_timeout?: string | null;
  cidr?: string | null;
  description?: string | null;
  dial_string?: string | null;
  directory_exten_visible?: boolean | null;
  directory_first_name?: string | null;
  directory_last_name?: string | null;
  directory_visible?: boolean | null;
  effective_caller_id_name?: string | null;
  effective_caller_id_number?: string | null;
  emergency_caller_id_name?: string | null;
  emergency_caller_id_number?: string | null;
  enabled?: boolean | null;
  extension: string;
  force_ping?: boolean | null;
  hold_music?: string | null;
  limit_destination?: string | null;
  limit_max?: string | null;
  max_registrations?: string | null;
  missed_call_app?: string | null;
  missed_call_data?: string | null;
  mwi_account?: string | null;
  outbound_caller_id_name?: string | null;
  outbound_caller_id_number?: string | null;
  range: number;
  sip_bypass_media?: string | null;
  sip_force_contact?: string | null;
  sip_force_expires?: string | null;
  toll_allow?: string | null;
  user_context: string;
  user_record?: string | null;
  voicemail_enabled?: boolean | null;
  voicemail_file?: string | null;
  voicemail_local_after_email?: boolean | null;
  voicemail_mail_to?: string | null;
  voicemail_password?: string | null;
  voicemail_transcription_enabled?: boolean | null;
}

export interface ExtensionRow extends RowDataPacket, ExtensionPayload {}
