import { Request, Response } from "express";
import { getDomainsService } from "../services/hiveuser.service";

export const getDomains = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const domains = await getDomainsService();

  res.status(200).json({
    success: true,
    message: "Domains fetched successfully",
    domainOptions: domains,
  });
};
