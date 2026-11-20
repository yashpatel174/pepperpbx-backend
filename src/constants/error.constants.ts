export const ERROR_MODULES = {
  gateway: {
    entity: "Gateway",
  },
  extensions: {
    entity: "Extension",
  },
  destination: {
    entity: "Destination",
  },
  routes: {
    entity: "Route",
  },
  inbound: {
    entity: "Inbound",
  },
  outbound: {
    entity: "Outbound",
  },
  plans: {
    entity: "plan",
    prefix: "This",
  },
} as const;

export type ErrorModule = keyof typeof ERROR_MODULES;

export const getDuplicateMessage = (module: ErrorModule): string => {
  const config = ERROR_MODULES[module];

  if ("prefix" in config) {
    return `${config.prefix} ${config.entity} already exists under this user context`;
  }

  return `${config.entity} already exists under this user context`;
};
