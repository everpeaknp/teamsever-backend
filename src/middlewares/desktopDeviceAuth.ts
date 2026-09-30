import { Request, Response, NextFunction } from "express";
import { hashDesktopCredential } from "../services/desktopDeviceToken";

const TrustedAttendanceDevice = require("../models/TrustedAttendanceDevice");
const User = require("../models/User");

export async function desktopDeviceAuth(req: Request, res: Response, next: NextFunction) {
  const value = req.headers["x-teamsever-device"];
  const token = typeof value === "string" ? value : "";
  if (!/^td_[A-Za-z0-9_-]{40,100}$/.test(token)) return res.status(401).json({ success: false, message: "Desktop device authorization required" });
  try {
    const tokenHash = hashDesktopCredential(token);
    const device = await TrustedAttendanceDevice.findOne({ tokenHash, revokedAt: null }).select("+tokenHash");
    if (!device) return res.status(401).json({ success: false, message: "Desktop device is revoked or unknown" });
    const user = await User.findById(device.user).select("deletedAt");
    if (!user || user.deletedAt) return res.status(401).json({ success: false, message: "Desktop device account is unavailable" });
    device.lastSeenAt = new Date();
    await device.save();
    (req as any).user = { id: String(device.user), _id: device.user };
    (req as any).desktopDevice = device;
    next();
  } catch (error) { next(error); }
}
