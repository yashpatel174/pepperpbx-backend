import { RequestHandler } from "express";

import type { ErrorModule } from "../constants/error.constants";

export const setErrorModule = (module: ErrorModule): RequestHandler => {
  return (_req, res, next): void => {
    res.locals.errorModule = module;
    next();
  };
};
