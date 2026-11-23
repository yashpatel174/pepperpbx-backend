import {
  ExecuteValues,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import pool from "../config/db";
import {
  CreatedGateway,
  CreateGatewayResult,
  GatewayAction,
  GatewayDeleteResponse,
  GatewayDetails,
  GatewayDetailsResponse,
  GatewayEnabledToggleResponse,
  GatewayIdRow,
  GatewayListQuery,
  GatewayListResult,
  GatewayPayload,
  GatewayRow,
  GatewayStatusRow,
  GatewayToggleResponse,
  GatewayUuidRow,
  UPDATE_COLUMNS,
  UpdatedGatewayResponse,
  UpdatedGatewayRow,
} from "../types/gateway.types";
import { AppError } from "../utils/AppError";

const TABLE = "`gateways`";

const ALLOWED_COLUMNS = new Set<keyof GatewayPayload>([
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
]);

export const createGatewayService = async (
  payload: GatewayPayload,
): Promise<CreateGatewayResult> => {
  const [domain] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM domains WHERE domain = ?",
    [payload.domain_name],
  );

  if (domain.length === 0) {
    throw new AppError("Domain not found");
  }

  const domain_name = Number(domain?.[0]?.id);
  if (!domain_name) {
    throw new AppError("Domain name is required");
  }

  const columns = Object.keys(payload).filter((column) =>
    ALLOWED_COLUMNS.has(column as keyof GatewayPayload),
  );

  if (columns.length === 0) {
    throw new Error("Valid gateway payload is required");
  }

  // Preserve false, zero, empty strings and null.
  const values = columns.map((column) => {
    if (column === "domain_name") {
      return domain_name;
    }
    return payload[column as keyof GatewayPayload];
  });

  const columnNames = columns.map((column) => `\`${column}\``).join(", ");

  const placeholders = columns.map(() => "?").join(", ");

  const sql = `
    INSERT INTO ${TABLE} (${columnNames})
    VALUES (${placeholders})
  `;

  const queryValues: ExecuteValues[] = values.map((value) =>
    value === undefined ? null : value,
  );

  const [result] = await pool.execute<ResultSetHeader>(sql, queryValues);

  if (result.affectedRows !== 1 || !result.insertId) {
    throw new Error("Gateway creation failed");
  }

  // Fetch only safe response fields.
  const [rows] = await pool.execute<CreatedGateway[]>(
    `
      SELECT
        id,
        gateway_uuid,
        gateway,
        domain_name,
        sbcDomainIp,
        proxy,
        expire_seconds,
        retry_seconds,
        register,
        enabled,
        created_at,
        updated_at
      FROM ${TABLE}
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId],
  );

  const createdGateway = rows[0];

  if (!createdGateway) {
    throw new Error("Gateway creation could not be verified");
  }

  return {
    ...createdGateway,
    register: Boolean(createdGateway.register),
    enabled: Boolean(createdGateway.enabled),
  };
};

const SEARCH_COLUMNS = [
  "gateway",
  "gateway_uuid",
  "domain_name",
  "sbcDomainIp",
  "proxy",
  "username",
  "extension",
  "hostname",
  "description",
] as const;

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, "\\$&");

export const getGatewaysService = async (
  filters: GatewayListQuery,
  showAll: boolean,
  domain: string,
): Promise<GatewayListResult> => {
  const { page, pageSize, search } = filters;

  const offset = (page - 1) * pageSize;

  if (!Number.isSafeInteger(offset)) {
    throw new AppError("Invalid pagination offset", 400);
  }

  const whereConditions: string[] = [];
  const whereValues: (string | number)[] = [];

  // Resolve domain ID and filter gateways only when showAll is false.
  if (!showAll) {
    if (!domain) {
      throw new AppError("Domain is required", 400);
    }

    const [domainRows] = await pool.execute<(RowDataPacket & { id: number })[]>(
      `
        SELECT id
        FROM domains
        WHERE domain = ?
        LIMIT 1
      `,
      [domain],
    );

    if (!domainRows.length) {
      return {
        gateways: [],
        pagination: {
          currentPage: page,
          pageSize,
          totalRecords: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    // gateways.domain_name stores domains.id.
    whereConditions.push("domain_name = ?");
    whereValues.push(domainRows[0].id);
  }

  if (search) {
    const searchPattern = `${escapeLike(search)}%`;

    const searchConditions = SEARCH_COLUMNS.map(
      (column) => `\`${column}\` LIKE ? ESCAPE '\\\\'`,
    );

    whereConditions.push(`(${searchConditions.join(" OR ")})`);

    whereValues.push(...SEARCH_COLUMNS.map(() => searchPattern));
  }

  const whereClause = whereConditions.length
    ? `WHERE ${whereConditions.join(" AND ")}`
    : "";

  const connection: PoolConnection = await pool.getConnection();

  try {
    // Both SELECT queries share a consistent snapshot.
    await connection.beginTransaction();

    const [countRows] = await connection.execute<
      (RowDataPacket & { totalRecords: number })[]
    >(
      `
        SELECT COUNT(*) AS totalRecords
        FROM ${TABLE}
        ${whereClause}
      `,
      whereValues,
    );

    const totalRecords = Number(countRows[0]?.totalRecords ?? 0);
    const totalPages = Math.ceil(totalRecords / pageSize);

    const [rows] = await connection.execute<GatewayRow[]>(
      `
        SELECT
          g.id,
          g.gateway_uuid,
          g.username,
          g.gateway,
          d.domain AS domain_name,
          g.from_user,
          g.proxy,
          g.sbcDomainIp,
          g.expire_seconds,
          g.realm,
          g.context,
          g.retry_seconds,
          g.register,
          g.profile,
          g.status,
          g.enabled,
          g.description,
          g.extension,
          g.auth_username,
          g.register_proxy,
          g.register_transport,
          g.sip_cid_type,
          g.outbound_proxy,
          g.ping,
          g.codec_prefs,
          g.ping_max,
          g.ping_min,
          g.hostname,
          g.channels,
          g.caller_id_in_from,
          g.distinct_to,
          g.extension_in_contact,
          g.supress_cng,
          g.created_at,
          g.updated_at
        FROM ${TABLE} g
        LEFT JOIN domains d
          ON g.domain_name = d.id
        ${whereClause}
        ORDER BY g.id DESC
        LIMIT ? OFFSET ?
      `,
      [...whereValues, pageSize, offset],
    );

    await connection.commit();

    const gateways = rows.map((gateway) => ({
      ...gateway,
      register: Boolean(gateway.register),
      enabled: Boolean(gateway.enabled),
      distinct_to: Boolean(gateway.distinct_to),
      caller_id_in_from: Boolean(gateway.caller_id_in_from),
      supress_cng: Boolean(gateway.supress_cng),
      extension_in_contact: Boolean(gateway.extension_in_contact),
      gatewayaction: gateway.status === 1 ? "Started" : "Stopped",
      status: gateway.status === 1 ? "Started" : "Stopped",
    }));

    return {
      gateways,
      pagination: {
        currentPage: page,
        pageSize,
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getGatewayDetailsService = async (
  gateway_uuid: string,
): Promise<GatewayDetailsResponse> => {
  const [rows] = await pool.execute<GatewayDetails[]>(
    `SELECT 
      gateways.*,
      domains.domain
   FROM ${TABLE} AS gateways
   LEFT JOIN domains 
      ON gateways.domain_name = domains.id
   WHERE gateways.gateway_uuid = ?
   LIMIT 1`,
    [gateway_uuid],
  );

  const data = { ...rows[0], domain_name: rows[0].domain };

  return {
    ...data,
    domainname: data.domain_name,
    register: Boolean(data.register),
    enabled: Boolean(data.enabled),
    distinct_to: Boolean(data.distinct_to),
    caller_id_in_from: Boolean(data.caller_id_in_from),
    supress_cng: Boolean(data.supress_cng),
    extension_in_contact: Boolean(data.extension_in_contact),
  };
};

export const updateGatewayService = async (
  gateway_uuid: string,
  payload: GatewayPayload,
): Promise<UpdatedGatewayResponse> => {
  const connection: PoolConnection = await pool.getConnection();

  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [existingRows] = await connection.execute<GatewayIdRow[]>(
      `SELECT id, username, password
       FROM gateways
       WHERE gateway_uuid = ?
       LIMIT 1
       FOR UPDATE`,
      [gateway_uuid],
    );

    if (existingRows.length === 0) {
      throw new AppError("Gateway not found", 404);
    }

    const existingGateway = existingRows[0];

    const finalUsername = payload.username;

    if (payload.register === true) {
      if (typeof finalUsername !== "string" || !finalUsername.trim()) {
        throw new AppError(
          "Username is required when registration is enabled",
          400,
        );
      }
    }

    const hasNewPassword =
      typeof payload.password === "string" && payload.password.length > 0;

    // const columns = UPDATE_COLUMNS.filter(
    //   (column) => column !== "password" || hasNewPassword,
    // );

    const columns = UPDATE_COLUMNS.filter((column) => {
      if (column === "domain_name") return false;
      if (column === "password" && !hasNewPassword) return false;

      return true;
    });

    const setClause = columns.map((column) => `\`${column}\` = ?`).join(", ");

    // const values = columns.map((column) => payload[column]);
    const values: ExecuteValues[] = columns.map((column) => {
      const value = payload[column];
      if (value === undefined) {
        throw new AppError(`Invalid undefined value for ${column}`, 400);
      }
      return value;
    });

    const queryValues: ExecuteValues[] = [...values, gateway_uuid];

    await connection.execute<ResultSetHeader>(
      `UPDATE gateways
   SET ${setClause}
   WHERE gateway_uuid = ?`,
      queryValues,
    );

    const [updatedRows] = await connection.execute<UpdatedGatewayRow[]>(
      `SELECT
      id,
      gateway_uuid,
          gateway,
          username,
          from_user,
          domain_name,
          sbcDomainIp,
          proxy,
          realm,
          expire_seconds,
          retry_seconds,
          context,
          profile,
          register,
          enabled,
          description,
          auth_username,
          extension,
          register_transport,
          register_proxy,
          outbound_proxy,
          sip_cid_type,
          codec_prefs,
          ping,
          ping_min,
          ping_max,
          channels,
          status,
          hostname,
          distinct_to,
          caller_id_in_from,
          supress_cng,
          extension_in_contact,
          created_at,
          updated_at
        FROM gateways
        WHERE gateway_uuid = ?
        LIMIT 1`,
      [gateway_uuid],
    );

    if (updatedRows.length === 0) {
      throw new AppError("Gateway not found", 404);
    }

    await connection.commit();
    transactionStarted = false;

    const gateway = updatedRows[0];

    return {
      ...gateway,
      register: Boolean(gateway.register),
      enabled: Boolean(gateway.enabled),
      distinct_to: Boolean(gateway.distinct_to),
      caller_id_in_from: Boolean(gateway.caller_id_in_from),
      supress_cng: Boolean(gateway.supress_cng),
      extension_in_contact: Boolean(gateway.extension_in_contact),
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Gateway update rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

export const toggleGatewayEnableService = async (
  gatewayUuids: string[],
): Promise<GatewayEnabledToggleResponse> => {
  const connection = await pool.getConnection();

  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const placeholders = gatewayUuids.map(() => "?").join(", ");

    // Verify all requested gateways exist.
    const [existingRows] = await connection.execute<GatewayStatusRow[]>(
      `SELECT gateway_uuid
       FROM gateways
       WHERE gateway_uuid IN (${placeholders})
       FOR UPDATE`,
      gatewayUuids,
    );

    if (existingRows.length !== gatewayUuids.length) {
      throw new AppError("One or more gateways were not found", 404);
    }

    // Toggle enabled using MySQL boolean logic.
    const [updateResult] = await connection.execute<ResultSetHeader>(
      `UPDATE gateways
   SET enabled = IF(enabled = 1, 0, 1)
   WHERE gateway_uuid IN (${placeholders})`,
      gatewayUuids,
    );

    if (updateResult.affectedRows !== gatewayUuids.length) {
      throw new AppError("Unable to toggle all gateway statuses", 500);
    }

    // Retrieve updated statuses.
    const [updatedRows] = await connection.execute<GatewayStatusRow[]>(
      `SELECT gateway_uuid, enabled
       FROM gateways
       WHERE gateway_uuid IN (${placeholders})`,
      gatewayUuids,
    );

    await connection.commit();
    transactionStarted = false;

    return {
      totalUpdated: updatedRows.length,
      gateways: updatedRows.map((gateway) => ({
        gateway_uuid: gateway.gateway_uuid,
        enabled: Boolean(gateway.enabled),
      })),
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Gateway toggle rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

export const deleteGatewayService = async (
  gatewayUuids: string[],
): Promise<GatewayDeleteResponse> => {
  const connection: PoolConnection = await pool.getConnection();

  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const placeholders = gatewayUuids.map(() => "?").join(", ");

    // Lock and verify all requested gateways.
    const [existingRows] = await connection.execute<GatewayUuidRow[]>(
      `SELECT gateway_uuid
         FROM gateways
         WHERE gateway_uuid IN (${placeholders})
         ORDER BY gateway_uuid
         FOR UPDATE`,
      gatewayUuids,
    );

    const existingUuids = new Set(
      existingRows.map((row) => row.gateway_uuid.toLowerCase()),
    );

    const missingUuids = gatewayUuids.filter(
      (uuid) => !existingUuids.has(uuid),
    );

    // All-or-nothing: do not partially delete.
    if (missingUuids.length > 0) {
      throw new AppError(
        `Gateway(s) not found: ${missingUuids.join(", ")}`,
        404,
      );
    }

    // Delete all matching gateway records in one statement.
    const [deleteResult] = await connection.execute<ResultSetHeader>(
      `DELETE FROM gateways
         WHERE gateway_uuid IN (${placeholders})`,
      gatewayUuids,
    );

    if (deleteResult.affectedRows !== gatewayUuids.length) {
      throw new AppError("Unable to delete all requested gateways", 500);
    }

    await connection.commit();
    transactionStarted = false;

    return {
      totalRequested: gatewayUuids.length,
      totalDeleted: deleteResult.affectedRows,
      deletedGatewayUuids: existingRows.map((row) => row.gateway_uuid),
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Gateway deletion rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

export const toggleGatewayStatusService = async (
  gatewayUuids: string[],
  action: GatewayAction,
): Promise<GatewayToggleResponse> => {
  const connection: PoolConnection = await pool.getConnection();

  let transactionStarted = false;

  const enabledValue = action === "start" ? 1 : 0;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const placeholders = gatewayUuids.map(() => "?").join(", ");

    // Lock all requested gateway records.
    const [existingRows] = await connection.execute<GatewayStatusRow[]>(
      `SELECT gateway_uuid, register, status
         FROM gateways
         WHERE gateway_uuid IN (${placeholders})
         ORDER BY gateway_uuid
         FOR UPDATE`,
      gatewayUuids,
    );

    // 1. Check whether all requested gateways exist.
    const existingUuids = new Set(
      existingRows.map((row) => row.gateway_uuid.toLowerCase()),
    );

    const missingUuids = gatewayUuids.filter(
      (uuid) => !existingUuids.has(uuid),
    );

    if (missingUuids.length > 0) {
      throw new AppError(
        `Gateway(s) not found: ${missingUuids.join(", ")}`,
        404,
      );
    }

    // 2. Check whether all gateways are registered.
    const unregisteredGateways = existingRows
      .filter((gateway) => Number(gateway.register) !== 1)
      .map((gateway) => gateway.gateway_uuid);

    if (unregisteredGateways.length > 0) {
      throw new AppError(
        `The gateway must be registered before it can be ${action === "start" ? "started" : "stopped"}. Unregistered gateway(s): ${unregisteredGateways.join(", ")}`,
        409,
      );
    }

    // 3. Update all gateways only after every validation passes.
    // start = 1, stop = 0.
    await connection.execute(
      `UPDATE gateways
       SET status = ?
       WHERE gateway_uuid IN (${placeholders})`,
      [enabledValue, ...gatewayUuids],
    );

    // 4. Retrieve the final statuses.
    const [updatedRows] = await connection.execute<GatewayStatusRow[]>(
      `SELECT gateway_uuid, register, status
         FROM gateways
         WHERE gateway_uuid IN (${placeholders})
         ORDER BY gateway_uuid`,
      gatewayUuids,
    );

    if (updatedRows.length !== gatewayUuids.length) {
      throw new AppError(
        "Unable to retrieve all updated gateway statuses",
        500,
      );
    }

    await connection.commit();
    transactionStarted = false;

    return {
      action,
      enabled: enabledValue === 1,
      totalRequested: gatewayUuids.length,
      totalUpdated: updatedRows.length,
      gateways: updatedRows.map((gateway) => ({
        gateway_uuid: gateway.gateway_uuid,
        status: Number(gateway.status) === 1 ? "Started" : "Stopped",
      })),
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Gateway status update rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};

export const copyGatewayService = async (
  gatewayUuid: string,
  copyGateway: string,
): Promise<CreateGatewayResult> => {
  const connection: PoolConnection = await pool.getConnection();

  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    // 1. Find and lock the original gateway.
    const [originalRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, domain_name
         FROM gateways
         WHERE gateway_uuid = ?
         LIMIT 1
         FOR UPDATE`,
      [gatewayUuid],
    );

    if (originalRows.length === 0) {
      throw new AppError("Original gateway not found", 404);
    }

    const originalGateway = originalRows[0];

    // 2. Check whether the new gateway name already exists
    // under the original gateway's domain.
    const [duplicateRows] = await connection.execute<RowDataPacket[]>(
      `SELECT id
         FROM gateways
         WHERE domain_name = ?
           AND gateway = ?
         LIMIT 1`,
      [originalGateway.domain_name, copyGateway],
    );

    if (duplicateRows.length > 0) {
      throw new AppError(
        "A gateway with this name already exists under the same domain",
        409,
      );
    }

    // 3. Copy all original configuration fields directly in MySQL.
    // Only gateway_uuid and gateway receive new values.
    // id, created_at and updated_at are generated automatically.
    const [insertResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO gateways (
          gateway,
          username,
          password,
          from_user,
          domain_name,
          sbcDomainIp,
          proxy,
          realm,
          expire_seconds,
          retry_seconds,
          context,
          profile,
          register,
          enabled,
          description,
          auth_username,
          extension,
          register_transport,
          register_proxy,
          outbound_proxy,
          sip_cid_type,
          codec_prefs,
          ping,
          ping_min,
          ping_max,
          channels,
          hostname,
          distinct_to,
          caller_id_in_from,
          supress_cng,
          extension_in_contact
        )
        SELECT
          ?,
          username,
          password,
          from_user,
          domain_name,
          sbcDomainIp,
          proxy,
          realm,
          expire_seconds,
          retry_seconds,
          context,
          profile,
          register,
          enabled,
          description,
          auth_username,
          extension,
          register_transport,
          register_proxy,
          outbound_proxy,
          sip_cid_type,
          codec_prefs,
          ping,
          ping_min,
          ping_max,
          channels,
          hostname,
          distinct_to,
          caller_id_in_from,
          supress_cng,
          extension_in_contact
        FROM gateways
        WHERE gateway_uuid = ?`,
      [copyGateway, gatewayUuid],
    );

    if (insertResult.affectedRows !== 1) {
      throw new AppError("Unable to copy gateway", 500);
    }

    // 4. Retrieve the new gateway without selecting its password.
    const [createdRows] = await connection.execute<CreatedGateway[]>(
      `SELECT
          id,
        gateway_uuid,
        gateway,
        domain_name,
        sbcDomainIp,
        proxy,
        expire_seconds,
        retry_seconds,
        register,
        enabled,
        created_at,
        updated_at
        FROM gateways
        WHERE gateway = ?
        LIMIT 1`,
      [copyGateway],
    );

    if (createdRows.length === 0) {
      throw new AppError(
        "Gateway copied but the new record could not be retrieved",
        500,
      );
    }

    const createdGateway = createdRows[0];

    await connection.commit();
    transactionStarted = false;

    return {
      ...createdGateway,
      register: Boolean(createdGateway.register),
      enabled: Boolean(createdGateway.enabled),
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Gateway copy rollback failed:", rollbackError);
      }
    }

    throw error;
  } finally {
    connection.release();
  }
};
