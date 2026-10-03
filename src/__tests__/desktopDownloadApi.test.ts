const express = require("express");
const request = require("supertest");
const { Readable } = require("node:stream");

jest.mock("../services/desktopReleaseDownloadService", () => ({
  getDesktopDownloadAvailability: jest.fn(),
  openDesktopDownload: jest.fn(),
}));

const { getDesktopDownloadAvailability, openDesktopDownload } = require("../services/desktopReleaseDownloadService");
const router = require("../routes/desktopDownloadRoutes");

let app: any;

beforeEach(() => {
  jest.clearAllMocks();
  app = express();
  app.use("/api/desktop-downloads", router);
});

describe("public desktop download API", () => {
  it("returns only platform availability, never GitHub release URLs", async () => {
    getDesktopDownloadAvailability.mockResolvedValue({ version: "0.2.3", windows: true, linux: true });

    const response = await request(app).get("/api/desktop-downloads");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { version: "0.2.3", assets: { windows: true, linux: true } } });
    expect(JSON.stringify(response.body)).not.toContain("github.com");
  });

  it("streams the selected installer with a safe attachment filename", async () => {
    openDesktopDownload.mockResolvedValue({
      stream: Readable.from(Buffer.from("installer")),
      contentLength: 9,
    });

    const response = await request(app).get("/api/desktop-downloads/windows");

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toBe('attachment; filename="TeamsEver-Setup.exe"');
    expect(response.headers["content-length"]).toBe("9");
    expect(response.body.toString("utf8")).toBe("installer");
  });

  it("rejects unknown platforms without contacting GitHub", async () => {
    const response = await request(app).get("/api/desktop-downloads/mac");

    expect(response.status).toBe(400);
    expect(openDesktopDownload).not.toHaveBeenCalled();
  });
});
