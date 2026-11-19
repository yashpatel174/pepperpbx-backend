import {
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import pool from "../config/db";
import {
  CreatedExtension,
  CreateExtensionResult,
  ExtensionListQuery,
  ExtensionListResult,
  ExtensionPayload,
  ExtensionRow,
  ToggleExtensionStatusPayload,
} from "../types/extension.types";
import { AppError } from "../utils/AppError";
import { EXTENSION_COLUMNS } from "../utils/columns";

const TABLE = "`extensions`";

export const createExtensionService = async (
  payload: ExtensionPayload,
): Promise<CreateExtensionResult> => {
  const [domain] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM domains WHERE domain = ?",
    [payload.user_context],
  );

  if (domain.length === 0) {
    throw new AppError("Domain not found");
  }

  const userContext = Number(domain?.[0]?.id);
  if (!userContext) {
    throw new AppError("User context is required");
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
    throw new AppError("Invalid extension or range");
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
    throw new AppError("Extension column is required");
  }

  if (!columns.includes("user_context")) {
    throw new AppError("User context column is required");
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
    throw new AppError("Valid accountcode is required");
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
      throw new AppError("Failed to retrieve created extension");
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

export const getCopyExtensionService = async (
  extension_uuid: string,
  new_extension: string,
) => {
  if (!extension_uuid?.trim()) {
    throw new AppError("Extension UUID is required", 400);
  }

  if (!new_extension?.trim()) {
    throw new AppError("New extension is required", 400);
  }

  const [result] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM extensions WHERE extension_uuid = ? LIMIT 1`,
    [extension_uuid],
  );

  if (!result.length) {
    throw new AppError("Original extension not found", 404);
  }

  // Check whether new extension already exists
  const [existingExtension] = await pool.execute<RowDataPacket[]>(
    `SELECT extension_uuid
   FROM extensions
   WHERE extension = ? AND user_context = ?
   LIMIT 1`,
    [new_extension, result[0].user_context],
  );

  if (existingExtension.length > 0) {
    throw new AppError(
      "This extension already exists for this user context",
      409,
    );
  }

  // Generate UUID for the new extension
  const new_extension_uuid = crypto.randomUUID();

  const selectColumns = EXTENSION_COLUMNS.map((column) => {
    if (column === "extension") {
      return "? AS extension";
    }
    return `\`${column}\``;
  });

  const query = `
    INSERT INTO extensions (
      extension_uuid,
      ${EXTENSION_COLUMNS.map((column) => `\`${column}\``).join(", ")}
    )
    SELECT
      ?,
      ${selectColumns.join(", ")}
    FROM extensions
    WHERE extension_uuid = ?
    LIMIT 1
  `;

  await pool.execute(query, [
    new_extension_uuid,
    new_extension,
    extension_uuid,
  ]);

  // Fetch newly created record
  const [new_record] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM extensions WHERE extension_uuid = ?`,
    [new_extension_uuid],
  );

  return new_record[0];
};

export const getExtensionsService = async (
  query: ExtensionListQuery,
): Promise<ExtensionListResult> => {
  const { page, pageSize, search, showAll, domain } = query;

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
    ? `(${searchableColumns
        .map((column) => `e.\`${column}\` LIKE ?`)
        .join(" OR ")})`
    : "";

  const searchValues = search ? searchableColumns.map(() => `%${search}%`) : [];

  let domainCondition = "";
  let domainValues: (string | number)[] = [];

  // Validate domain only when showAll is false.
  if (!showAll) {
    if (!domain) {
      throw new AppError("Domain is required", 400);
    }

    const [domainRows] = await pool.execute<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM domains WHERE domain = ? LIMIT 1`,
      [domain],
    );

    if (!domainRows.length) {
      return {
        data: [],
        page,
        pageSize,
        total_records: 0,
        total_pages: 0,
      };
    }

    domainCondition = "e.user_context = ?";
    domainValues = [domainRows[0].id];
  }

  const conditions = [
    ...(domainCondition ? [domainCondition] : []),
    ...(searchCondition ? [searchCondition] : []),
  ];

  const whereCondition = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const values = [...domainValues, ...searchValues];

  // Count query
  const [countRows] = await pool.execute<(RowDataPacket & { total: number })[]>(
    `
      SELECT COUNT(*) AS total
      FROM ${TABLE} e
      ${whereCondition}
    `,
    values,
  );

  const total_records = Number(countRows[0]?.total ?? 0);
  const total_pages = Math.ceil(total_records / pageSize);

  // Fetch extensions
  const [rows] = await pool.execute<ExtensionRow[]>(
    `
      SELECT
        e.*,
        d.domain AS domain_name
      FROM ${TABLE} e
      LEFT JOIN domains d
        ON e.user_context = d.id
      ${whereCondition}
      ORDER BY e.extension ASC
      LIMIT ? OFFSET ?
    `,
    [...values, pageSize, offset],
  );

  const data: ExtensionRow[] = rows.map((row) => ({
    ...row,
    extension_uuid: row.extension_uuid,
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
    status: row.status === "active" ? "enabled" : "disabled",
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
    `SELECT 
      extensions.*,
      domains.domain
   FROM ${TABLE} AS extensions
   LEFT JOIN domains 
      ON extensions.user_context = domains.id
   WHERE extensions.extension_uuid = ?
   LIMIT 1`,
    [extension],
  );

  const data = { ...rows[0], user_context: rows[0].domain };
  return data ?? null;
};

export const updateExtensionService = async (
  extension_uuid: string,
  payload: Partial<ExtensionPayload>,
): Promise<ResultSetHeader> => {
  if (!extension_uuid?.trim()) {
    throw new AppError("Extension UUID is required");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AppError("Valid payload is required");
  }

  // 1. Validate required fields.
  if (typeof payload.extension !== "string" || !payload.extension.trim()) {
    throw new AppError("Extension is required");
  }

  if (payload.accountcode === undefined || payload.accountcode === null) {
    throw new AppError("Account code is required");
  }

  // 2. Reject unexpected fields.
  const allowedColumns = new Set<string>(EXTENSION_COLUMNS);

  const invalidFields = Object.keys(payload).filter(
    (key) => !allowedColumns.has(key),
  );

  if (invalidFields.length > 0) {
    throw new AppError(`Invalid fields: ${invalidFields.join(", ")}`);
  }

  // 3. Normalize unique fields.
  const extension = payload.extension.trim();

  // 4. Check whether the extension already exists
  //    under the same user_context, excluding the current record.
  const [existingExtensions] = await pool.execute<RowDataPacket[]>(
    `
      SELECT extension_uuid
      FROM ${TABLE}
      WHERE extension = ?
        AND extension_uuid <> ?
      LIMIT 1
    `,
    [extension, extension_uuid],
  );

  if (existingExtensions.length > 0) {
    throw new AppError("Extension already exists under this user context");
  }

  // 5. Preserve existing update behavior:
  //    Missing/undefined fields become NULL.
  //    Explicit false, 0, and null are preserved.
  const updateColumns = EXTENSION_COLUMNS.filter(
    (column) => column !== "user_context",
  );

  const values = updateColumns.map((column) => {
    if (column === "extension") {
      return extension;
    }

    const value = payload[column];

    return value === undefined ? null : value;
  });

  // 6. Generate UPDATE query.
  const setClause = updateColumns
    .map((column) => `\`${column}\` = ?`)
    .join(", ");

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
      throw new AppError("Extension not found");
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
      throw new AppError("Extension already exists under this user context");
    }

    throw error;
  }
};

export const deleteExtensionService = async (
  extensions: string[],
): Promise<ResultSetHeader> => {
  if (extensions.length === 0) {
    throw new AppError("At least one extension UUID is required");
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
): Promise<void> => {
  if (!extensionUuid?.trim()) {
    throw new AppError("Extension UUID is required");
  }

  if (typeof enabled !== "boolean") {
    throw new AppError("Enabled must be a boolean");
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
      throw new AppError("Extension not found");
    }
  }

  return;
};

export const toggleBulkExtensionStatus = async (
  payload: ToggleExtensionStatusPayload,
) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new AppError("Extension UUID is required", 400);
  }

  if (payload.some((uuid) => typeof uuid !== "string" || uuid.trim() === "")) {
    throw new AppError("Valid payload is required", 400);
  }

  const uniqueUuids = [...new Set(payload)];

  const connection: PoolConnection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const placeholders = uniqueUuids.map(() => "?").join(", ");

    // Lock matching records before updating.
    const [existingExtensions] = await connection.query(
      `
      SELECT extension_uuid, enabled
      FROM extensions
      WHERE extension_uuid IN (${placeholders})
      FOR UPDATE
      `,
      uniqueUuids,
    );

    const extensions = existingExtensions as {
      extension_uuid: string;
      enabled: string;
    }[];

    if (extensions.length !== uniqueUuids.length) {
      throw new AppError("Extension not found", 404);
    }

    await connection.query<ResultSetHeader>(
      `
  UPDATE extensions
  SET enabled = CASE
    WHEN enabled = 1 THEN 0
    WHEN enabled = 0 THEN 1
    ELSE enabled
  END
  WHERE extension_uuid IN (${placeholders})
  `,
      uniqueUuids,
    );

    // Fetch updated records.
    const [updatedExtensions] = await connection.query(
      `
      SELECT extension_uuid, enabled
      FROM extensions
      WHERE extension_uuid IN (${placeholders})
      `,
      uniqueUuids,
    );

    await connection.commit();

    return updatedExtensions;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
