const runs = require("../services/testRunService");
const Attachment = require("../models/Attachment");
const { uploadEvidence, listEvidence } = require("../services/qaEvidenceService");

describe("QA execution evidence", () => {
  afterEach(() => jest.restoreAllMocks());

  it("rejects evidence for a closed execution before uploading", async () => {
    jest.spyOn(runs, "getExecution").mockResolvedValue({ run: { status: "closed" } });
    await expect(uploadEvidence("workspace", "execution", "actor", { mimetype: "image/png", size: 100, buffer: Buffer.from("x") }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it("enforces the execution access check for the uploader", async () => {
    jest.spyOn(runs, "getExecution").mockRejectedValue(new Error("Not assigned"));
    await expect(uploadEvidence("workspace", "execution", "actor", { mimetype: "image/png", size: 100, buffer: Buffer.from("x") }))
      .rejects.toThrow("Not assigned");
  });

  it("returns only linked evidence for an accessible execution", async () => {
    jest.spyOn(runs, "getExecution").mockResolvedValue({
      evidenceIds: ["file-a"], stepResults: [{ evidenceIds: ["file-b", "file-a"] }],
    });
    const lean = jest.fn().mockResolvedValue([{ _id: "file-a", url: "https://example.com/a.png" }]);
    const find = jest.spyOn(Attachment, "find").mockReturnValue({ lean } as any);
    const files = await listEvidence("workspace", "execution", "actor");
    expect(find).toHaveBeenCalledWith({ _id: { $in: ["file-a", "file-b"] }, workspace: "workspace", execution: "execution", isDeleted: false });
    expect(files).toHaveLength(1);
  });
});
