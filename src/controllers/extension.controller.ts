import type { Request, Response } from "express";

import {
  createExtensionService,
  deleteExtensionService,
  getCopyExtensionService,
  getExtensionService,
  getExtensionsService,
  toggleBulkExtensionStatus,
  updateExtensionService,
  updateExtensionStatus,
} from "../services/extension.service";
import { ExtensionListQuery, ExtensionPayload } from "../types/extension.types";
import { EXTENSION_COLUMNS } from "../utils/columns";
import { handleError } from "../utils/AppError";

export const createExtension = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const payload = req.body as ExtensionPayload;

    const { result, extensions } = await createExtensionService(payload);

    return res.status(201).json({
      success: true,
      message: "Extensions created successfully",
      data: extensions,
      count: result.affectedRows,
      insertId: result.insertId,
    });
  } catch (error: unknown) {
    return handleError(res, error);
  }
};

export const copyExtension = async (req: Request, res: Response) => {
  const { extension_uuid, new_extension } = req.body;

  const result = await getCopyExtensionService(extension_uuid, new_extension);
  return res.status(201).json({
    success: true,
    message: "Extension copied successfully",
    data: result,
  });
};

export const getExtensions = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
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

    const query: ExtensionListQuery = {
      page,
      pageSize,
      search,
      showAll,
      domain,
    };

    const result = await getExtensionsService(query);

    return res.status(200).json({
      success: true,
      message: "Extensions fetched successfully",
      ...result,
    });
  } catch (error: unknown) {
    console.error("Get extensions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch extensions",
    });
  }
};

export const getExtension = async (
  req: Request<{ extension: string }>,
  res: Response,
): Promise<Response> => {
  try {
    const extension = await getExtensionService(req.params.extension);

    if (!extension) {
      return res.status(404).json({
        success: false,
        message: "Extension not found",
      });
    }

    const data = {
      ...extension,
      call_screen_enabled: Boolean(Number(extension.call_screen_enabled)),
      force_ping: Boolean(Number(extension.force_ping)),
      directory_visible: Boolean(Number(extension.directory_visible)),
      directory_exten_visible: Boolean(
        Number(extension.directory_exten_visible),
      ),
      voicemail_transcription_enabled: Boolean(
        Number(extension.voicemail_transcription_enabled),
      ),
      voicemail_local_after_email: Boolean(
        Number(extension.voicemail_local_after_email),
      ),
      voicemail_enabled: Boolean(Number(extension.voicemail_enabled)),
      enabled: Boolean(Number(extension.enabled)),
    };

    return res.status(200).json({
      success: true,
      message: "Extension fetched successfully",
      data: data,
    });
  } catch (error: unknown) {
    return handleError(res, error);
  }
};

export const updateExtension = async (
  req: Request<{ extension_uuid: string }>,
  res: Response,
): Promise<Response> => {
  try {
    const { extension_uuid, updated } = req.body as Partial<ExtensionPayload>;

    if (!extension_uuid?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Extension UUID is required",
      });
    }

    if (!updated || typeof updated !== "object" || Array.isArray(updated)) {
      return res.status(400).json({
        success: false,
        message: "A valid update payload is required",
      });
    }

    const normalizedPayload: any = {};

    for (const column of EXTENSION_COLUMNS) {
      if (
        column === "range" ||
        column === "user_context" ||
        !Object.prototype.hasOwnProperty.call(updated, column)
      ) {
        continue;
      }

      const value = updated[column];

      if (value === undefined) {
        continue;
      }

      // The extension is editable but cannot be blank.
      const extensionValue = String(value ?? "").trim();
      if (column === "extension") {
        if (typeof value !== "string" || !extensionValue) {
          return res.status(400).json({
            success: false,
            message: "Extension must be a non-empty string",
          });
        }

        normalizedPayload.extension = String(value ?? "").trim();
        continue;
      }

      // Preserve explicit null values.
      if (value === null) {
        normalizedPayload[column] = null;
        continue;
      }

      // Clear blank strings on nullable fields.
      if (typeof value === "string" && !extensionValue) {
        normalizedPayload[column] = null;
        continue;
      }

      normalizedPayload[column] = value;
    }

    await updateExtensionService(extension_uuid, normalizedPayload);

    // Always fetch using the immutable database key.
    const updatedExtension = await getExtensionService(extension_uuid);

    if (!updatedExtension) {
      return res.status(404).json({
        success: false,
        message: "Extension not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Extension updated successfully",
      data: updatedExtension,
    });
  } catch (error: unknown) {
    return handleError(res, error);
  }
};

export const enableExtension = async (req: Request, res: Response) => {
  try {
    const { extension_uuid } = req.params;
    const { enabled } = req.body;
    await updateExtensionStatus(String(extension_uuid), enabled);

    res.status(200).json({
      success: true,
      message: `Extension ${enabled ? "enabled" : "disabled"} successfully`,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const bulkExtensionStatus = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const result = await toggleBulkExtensionStatus(req.body);

  return res.status(200).json({
    success: true,
    message: "Extension statuses updated successfully",
    data: result,
  });
};

export const deleteExtension = async (
  req: Request<{ extension: string }>,
  res: Response,
): Promise<Response> => {
  try {
    const { extensionUuids } = req.body;

    if (!Array.isArray(extensionUuids) || extensionUuids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "extensionUuids must be a non-empty array",
      });
    }

    const result = await deleteExtensionService(extensionUuids);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Extension not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Extension deleted successfully",
    });
  } catch (error: unknown) {
    return handleError(res, error);
  }
};
