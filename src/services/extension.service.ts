import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import pool from "../config/db";
import {
  CreatedExtension,
  CreateExtensionResult,
  ExtensionListQuery,
  ExtensionListResult,
  ExtensionPayload,
  ExtensionRow,
} from "../types/extension.types";
import { EXTENSION_COLUMNS } from "../utils/columns";

const TABLE = "`extensions`";

export const createExtensionService = async (
  payload: ExtensionPayload,
): Promise<CreateExtensionResult> => {
  // 1. Validate user_context.
  const userContext =
    typeof payload.user_context === "string" ? payload.user_context.trim() : "";

  if (!userContext) {
    throw new Error("User context is required");
  }

  if (userContext.length > 100) {
    throw new Error("User context cannot exceed 100 characters");
  }

  // 2. Validate extension and range.
  const extension =
    typeof payload.extension === "string" ? payload.extension.trim() : "";

  const startExtension = Number(extension);
  const range =
    payload.range === null ||
    payload.range === undefined ||
    payload.range === null
      ? 1
      : Number(payload.range);

  if (
    !/^\d+$/.test(extension) ||
    !Number.isSafeInteger(startExtension) ||
    !Number.isSafeInteger(range) ||
    range < 1
  ) {
    throw new Error("Invalid extension or range");
  }

  // 3. Select columns.
  // Always include extension, user_context and range.
  const columns = EXTENSION_COLUMNS.filter(
    (column) =>
      column === "extension" ||
      column === "user_context" ||
      column === "range" ||
      (Object.prototype.hasOwnProperty.call(payload, column) &&
        payload[column] !== undefined),
  );

  // 4. Validate required fields.
  if (!columns.includes("extension")) {
    throw new Error("Extension column is required");
  }

  if (!columns.includes("user_context")) {
    throw new Error("User context column is required");
  }

  const accountcode =
    typeof payload.accountcode === "string"
      ? payload.accountcode.trim()
      : payload.accountcode;

  if (
    accountcode === "" ||
    accountcode === null ||
    accountcode === undefined ||
    !/^\d+$/.test(String(accountcode)) ||
    !Number.isSafeInteger(Number(accountcode)) ||
    Number(accountcode) < 0
  ) {
    throw new Error("Valid accountcode is required");
  }

  const normalizedAccountcode = Number(accountcode);

  // 5. Generate only one extension.
  const generatedExtensions = [String(startExtension)];

  // 6. Acquire database connection.
  const connection: PoolConnection = await pool.getConnection();

  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    // 7. Generate one row.
    const rows = generatedExtensions.map((extensionNumber) =>
      columns.map((column) => {
        if (column === "extension") {
          return extensionNumber;
        }

        if (column === "user_context") {
          return userContext;
        }

        if (column === "range") {
          return range;
        }

        if (column === "accountcode") {
          return normalizedAccountcode;
        }

        return payload[column] ?? null;
      }),
    );

    // 8. Generate SQL column names.
    const columnNames = columns.map((column) => `\`${column}\``).join(", ");

    // 9. Generate placeholders.
    const rowPlaceholders = rows
      .map(() => `(UUID(), ${columns.map(() => "?").join(", ")})`)
      .join(", ");

    const sql = `
      INSERT INTO ${TABLE} (
        \`extension_uuid\`,
        ${columnNames}
      )
      VALUES ${rowPlaceholders}
    `;

    const values = rows.flatMap((row) => row);

    // 10. Insert one extension.
    const [result] = await connection.execute<ResultSetHeader>(sql, values);

    // 11. Retrieve the created extension.
    const [extensions] = await connection.execute<CreatedExtension[]>(
      `
        SELECT *
        FROM ${TABLE}
        WHERE \`user_context\` = ?
          AND \`extension\` = ?
      `,
      [userContext, String(startExtension)],
    );

    if (extensions.length !== 1) {
      throw new Error("Failed to retrieve created extension");
    }

    // 12. Commit transaction.
    await connection.commit();
    transactionStarted = false;

    return {
      result,
      extensions,
    };
  } catch (error: unknown) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError: unknown) {
        console.error("Extension transaction rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

export const getExtensionsService = async (
  query: ExtensionListQuery,
): Promise<ExtensionListResult> => {
  const { page, pageSize, search } = query;

  const offset = (page - 1) * pageSize;

  const searchableColumns = [
    "extension",
    "accountcode",
    "effective_caller_id_name",
    "effective_caller_id_number",
    "outbound_caller_id_name",
    "outbound_caller_id_number",
    "call_group",
    "description",
    "user_context",
    "missed_call_data",
    "voicemail_mail_to",
    "extension_uuid",
  ];

  const searchCondition = search
    ? `WHERE (${searchableColumns
        .map((column) => `\`${column}\` LIKE ?`)
        .join(" OR ")})`
    : "";

  const searchValues = search ? searchableColumns.map(() => `%${search}%`) : [];

  const [countRows] = await pool.execute<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM ${TABLE} ${searchCondition}`,
    searchValues,
  );

  const total_records = Number(countRows[0]?.total ?? 0);
  const total_pages = Math.ceil(total_records / pageSize);

  const [rows] = await pool.execute<ExtensionRow[]>(
    `
    SELECT *
    FROM ${TABLE}
    ${searchCondition}
    ORDER BY extension ASC
    LIMIT ? OFFSET ?
  `,
    [...searchValues, pageSize, offset],
  );

  const data: ExtensionRow[] = rows.map((row) => ({
    ...row,
    extension_uuid: row.extension_uuid,
    domain_name: row.user_context,
    limit_max:
      row.limit_max == null || row.limit_max === ""
        ? "0"
        : String(row.limit_max),
    call_timeout:
      row.call_timeout == null || row.call_timeout === ""
        ? null
        : String(row.call_timeout),
    sip_force_expires:
      row.sip_force_expires == null || row.sip_force_expires === ""
        ? null
        : String(row.sip_force_expires),
    default: "false",
  }));

  return {
    data,
    page,
    pageSize,
    total_records,
    total_pages,
  };
};

export const getExtensionService = async (
  extension: string,
): Promise<ExtensionRow | null> => {
  const [rows] = await pool.execute<ExtensionRow[]>(
    `SELECT * FROM ${TABLE} WHERE extension_uuid = ? LIMIT 1`,
    [extension],
  );

  return rows[0] ?? null;
};

export const updateExtensionService = async (
  extension_uuid: string,
  payload: Partial<ExtensionPayload>,
): Promise<ResultSetHeader> => {
  if (!extension_uuid?.trim()) {
    throw new Error("Extension UUID is required");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Valid payload is required");
  }

  // 1. Validate required fields.
  if (typeof payload.extension !== "string" || !payload.extension.trim()) {
    throw new Error("Extension is required");
  }

  if (
    typeof payload.user_context !== "string" ||
    !payload.user_context.trim()
  ) {
    throw new Error("User context is required");
  }

  if (payload.accountcode === undefined || payload.accountcode === null) {
    throw new Error("Account code is required");
  }

  // 2. Reject unexpected fields.
  const allowedColumns = new Set<string>(EXTENSION_COLUMNS);

  const invalidFields = Object.keys(payload).filter(
    (key) => !allowedColumns.has(key),
  );

  if (invalidFields.length > 0) {
    throw new Error(`Invalid fields: ${invalidFields.join(", ")}`);
  }

  // 3. Normalize unique fields.
  const extension = payload.extension.trim();
  const userContext = payload.user_context.trim();

  // 4. Check whether the extension already exists
  //    under the same user_context, excluding the current record.
  const [existingExtensions] = await pool.execute<RowDataPacket[]>(
    `
      SELECT extension_uuid
      FROM ${TABLE}
      WHERE user_context = ?
        AND extension = ?
        AND extension_uuid <> ?
      LIMIT 1
    `,
    [userContext, extension, extension_uuid],
  );

  if (existingExtensions.length > 0) {
    throw new Error("Extension already exists under this user context");
  }

  // 5. Preserve existing update behavior:
  //    Missing/undefined fields become NULL.
  //    Explicit false, 0, and null are preserved.
  const values = EXTENSION_COLUMNS.map((column) => {
    if (column === "extension") {
      return extension;
    }

    if (column === "user_context") {
      return userContext;
    }

    const value = payload[column];

    return value === undefined ? null : value;
  });

  // 6. Generate UPDATE query.
  const setClause = EXTENSION_COLUMNS.map((column) => `\`${column}\` = ?`).join(
    ", ",
  );

  const sql = `
    UPDATE ${TABLE}
    SET ${setClause}
    WHERE extension_uuid = ?
    LIMIT 1
  `;

  try {
    // 7. Update the existing extension.
    const [result] = await pool.execute<ResultSetHeader>(sql, [
      ...values,
      extension_uuid,
    ]);

    if (result.affectedRows === 0) {
      throw new Error("Extension not found");
    }

    return result;
  } catch (error: unknown) {
    // 8. Handle concurrent duplicate updates.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new Error("Extension already exists under this user context");
    }

    throw error;
  }
};

export const deleteExtensionService = async (
  extensions: string[],
): Promise<ResultSetHeader> => {
  if (extensions.length === 0) {
    throw new Error("At least one extension UUID is required");
  }

  const placeholders = extensions.map(() => "?").join(", ");

  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM ${TABLE} WHERE extension_uuid IN (${placeholders})`,
    extensions,
  );

  return result;
};

export const updateExtensionStatus = async (
  extensionUuid: string,
  enabled: boolean,
): Promise<ResultSetHeader> => {
  if (!extensionUuid?.trim()) {
    throw new Error("Extension UUID is required");
  }

  if (typeof enabled !== "boolean") {
    throw new Error("Enabled must be a boolean");
  }

  const sql = `
    UPDATE extensions
    SET enabled = ?
    WHERE extension_uuid = ?
    LIMIT 1
  `;

  const [result] = await pool.execute<ResultSetHeader>(sql, [
    enabled ? 1 : 0,
    extensionUuid,
  ]);

  if (result.affectedRows === 0) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT extension_uuid
      FROM extensions
      WHERE extension_uuid = ?
      LIMIT 1
      FOR UPDATE`,
      [extensionUuid],
    );

    if (rows.length === 0) {
      throw new Error("Extension not found");
    }
  }

  return result;
};
