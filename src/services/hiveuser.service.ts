import pool from "../config/db";
import { DomainRow } from "../types/extension.types";
import { AppError } from "../utils/AppError";

export const getDomainsService = async (): Promise<DomainRow[]> => {
  try {
    const [domains] = await pool.execute<DomainRow[]>(
      `
        SELECT *
        FROM domains
        ORDER BY domain ASC
      `,
    );

    return domains;
  } catch (error: unknown) {
    console.error("Get domains service error:", error);

    throw new AppError("Failed to fetch domains. Please try again later.", 500);
  }
};
