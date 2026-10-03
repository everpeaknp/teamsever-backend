const express = require("express");
export {};
const asyncHandler = require("../utils/asyncHandler");
const {
  getDesktopDownloadAvailability,
  openDesktopDownload,
} = require("../services/desktopReleaseDownloadService");

const router = express.Router();
const filenameByPlatform: Record<string, string> = {
  windows: "TeamsEver-Setup.exe",
  linux: "TeamsEver.AppImage",
};

router.get("/", asyncHandler(async (_req: any, res: any) => {
  try {
    const availability = await getDesktopDownloadAvailability();
    return res.json({
      success: true,
      data: {
        version: availability.version,
        assets: { windows: availability.windows, linux: availability.linux },
      },
    });
  } catch {
    return res.status(502).json({ success: false, message: "Desktop downloads are temporarily unavailable" });
  }
}));

router.get("/:platform", asyncHandler(async (req: any, res: any) => {
  const filename = filenameByPlatform[req.params.platform];
  if (!filename) return res.status(400).json({ success: false, message: "Choose Windows or Linux" });

  let download: { stream: NodeJS.ReadableStream; contentLength: number | null };
  try {
    download = await openDesktopDownload(req.params.platform);
  } catch (error) {
    const isMissingAsset = error instanceof Error && error.message.includes("installer is not published");
    return res.status(isMissingAsset ? 404 : 502).json({
      success: false,
      message: isMissingAsset ? "The selected installer is not published yet" : "Desktop download is temporarily unavailable",
    });
  }

  res.status(200);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (download.contentLength !== null) res.setHeader("Content-Length", String(download.contentLength));
  download.stream.on("error", (error: Error) => {
    if (res.headersSent) res.destroy(error);
    else res.status(502).end();
  });
  download.stream.pipe(res);
}));

module.exports = router;
