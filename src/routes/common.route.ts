import express from "express";
const app = express();
import extensionRoutes from "./extension.route";
import gatewayRoutes from "./gateway.route";
import destinationRoutes from "./destination.route";
import hiveUserRoutes from "./hiveuser.route";

app.use("/extensions", extensionRoutes);
app.use("/gateways", gatewayRoutes);
app.use("/destinations", destinationRoutes);
app.use("/hiveuser", hiveUserRoutes);

export default app;
