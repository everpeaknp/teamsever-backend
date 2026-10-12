import { Readable } from "stream";

const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const TestCase = require("../models/TestCase");
const Workspace = require("../models/Workspace");
const Batch = require("../models/QaCaseImportBatch");
const caseService = require("./testCaseService");
const AppError = require("../utils/AppError");
const qaProjectService = require("./qaProjectService");

const HEADERS = ["Key", "Title", "Priority", "Type", "State", "Preconditions", "Steps", "Custom fields"];
const required = ["Title", "Steps"];

const requireEnabled = async (workspaceId: string) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false, qualityEnabled: true });
  if (!workspace) throw new AppError("Quality is unavailable in this workspace", 403);
};

const cellText = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return String(value.text ?? value.result ?? "").trim();
  return String(value).trim();
};

export const parseCaseFile = async (file: { originalname: string; buffer: Buffer }, settings = qaProjectService.DEFAULTS) => {
  if (!file?.buffer?.length || file.buffer.length > 2 * 1024 * 1024) throw new AppError("Upload a CSV or XLSX file smaller than 2 MB", 400);
  const name = file.originalname.toLowerCase();
  const workbook = new ExcelJS.Workbook();
  try {
    if (name.endsWith(".xlsx")) await workbook.xlsx.load(file.buffer);
    else if (name.endsWith(".csv")) await workbook.csv.read(Readable.from([file.buffer]));
    else throw new AppError("Only CSV and XLSX files are supported", 400);
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw new AppError("Could not read the spreadsheet", 400);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError("Spreadsheet has no rows", 400);
  const headers = sheet.getRow(1).values.slice(1).map(cellText);
  if (required.some(header => !headers.includes(header))) throw new AppError("Spreadsheet needs Title and Steps columns", 400);
  if (sheet.rowCount > 501) throw new AppError("Import at most 500 cases at a time", 400);
  const seenKeys = new Set<string>();
  const seenTitles = new Set<string>();
  const rows: any[] = [];
  for (let line = 2; line <= sheet.rowCount; line++) {
    const row = sheet.getRow(line);
    const source: Record<string, string> = {};
    headers.forEach((header: string, index: number) => { source[header] = cellText(row.getCell(index + 1).value); });
    if (!Object.values(source).some(Boolean)) continue;
    const errors: string[] = [];
    if (!source.Title || source.Title.length > 240) errors.push("Title must be 1–240 characters");
    let steps: any[] = [];
    try {
      steps = JSON.parse(source.Steps || "[]");
      if (!Array.isArray(steps) || !steps.length || steps.length > 100 || steps.some(step => !step?.action?.trim?.() || !step?.expectedResult?.trim?.())) throw new Error();
    } catch { errors.push("Steps must be a JSON array of action and expectedResult pairs"); }
    for (const [field, allowed] of [["Priority", ["low", "medium", "high", "urgent"]], ["Type", settings.caseTypes.filter((item: any) => item.enabled).map((item: any) => item.key)], ["State", settings.caseStatuses.map((item: any) => item.key)]] as const) {
      if (source[field] && !allowed.includes(source[field] as never)) errors.push(`${field} is invalid`);
    }
    let customFields: any = {};
    if (source["Custom fields"]) {
      try { customFields = JSON.parse(source["Custom fields"]); if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) throw new Error(); }
      catch { errors.push("Custom fields must be a JSON object"); }
    }
    const key = (source.Key || "").toLowerCase();
    const title = (source.Title || "").toLowerCase();
    if ((key && seenKeys.has(key)) || (title && seenTitles.has(title))) errors.push("Duplicate key or title in this file");
    if (key) seenKeys.add(key);
    if (title) seenTitles.add(title);
    const draft = { title: source.Title, priority: source.Priority || "medium", type: source.Type || settings.caseTypes.find((item: any) => item.enabled)?.key || "manual", state: source.State || settings.caseStatuses[0]?.key || "draft", preconditions: source.Preconditions || undefined, steps, customFields };
    if (!errors.length) {
      try { caseService.validateCaseDraft(draft, settings); }
      catch (error: any) { errors.push(error.message || "Invalid case data"); }
    }
    rows.push({ line, key: source.Key || undefined, draft, errors });
  }
  if (!rows.length) throw new AppError("Spreadsheet has no cases", 400);
  return rows;
};

export const previewCaseImport = async (workspaceId: string, actorId: string, file: { originalname: string; buffer: Buffer }, projectId = "workspace") => {
  await requireEnabled(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  const settings = await qaProjectService.getEffectiveSettings(workspaceId, scope.project._id.toString(), actorId);
  const rows = await parseCaseFile(file, settings);
  const keys = rows.map(row => row.key).filter(Boolean);
  const existing = keys.length ? await TestCase.find({ workspace: workspaceId, ...scope.filter, key: { $in: keys } }).select("key currentRevision").lean() : [];
  const byKey = new Map<string, any>(existing.map((item: any) => [item.key, item]));
  for (const row of rows) {
    if (row.key && !byKey.has(row.key)) row.errors.push("Key does not exist in this QA project");
    row.existingRevision = row.key ? byKey.get(row.key)?.currentRevision : undefined;
  }
  const batch = await Batch.create({ workspace: workspaceId, project: scope.project._id, actor: actorId, rows, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  return { previewToken: batch._id.toString(), rows, valid: rows.filter(row => !row.errors.length).length, invalid: rows.filter(row => row.errors.length).length };
};

export const commitCaseImport = async (workspaceId: string, actorId: string, previewToken: string, mode: string, projectId = "workspace") => {
  await requireEnabled(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId, actorId);
  if (!mongoose.isValidObjectId(previewToken)) throw new AppError("Invalid import preview token", 400);
  if (!["create", "update", "skip"].includes(mode)) throw new AppError("Choose create, update, or skip", 400);
  const batch = await Batch.findOne({ _id: previewToken, workspace: workspaceId, project: scope.project._id, actor: actorId, expiresAt: { $gt: new Date() } });
  if (!batch) throw new AppError("Import preview expired or unavailable", 404);
  if (batch.status === "complete") return batch.outcome;
  if (batch.status === "committing") throw new AppError("Import is already running", 409);
  const claimed = await Batch.findOneAndUpdate({ _id: batch._id, status: "preview" }, { $set: { status: "committing" } }, { new: true });
  if (!claimed) throw new AppError("Import is already running", 409);
  const outcome = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ line: number; message: string }> };
  for (const row of batch.rows) {
    if (row.errors.length) { outcome.errors.push({ line: row.line, message: row.errors.join("; ") }); continue; }
    try {
      if (row.key) {
        if (mode === "skip" || mode === "create") { outcome.skipped++; continue; }
        const current = await TestCase.findOne({ workspace: workspaceId, ...scope.filter, key: row.key });
        if (!current) throw new AppError("Case no longer exists", 409);
        await caseService.updateCase(workspaceId, current._id.toString(), actorId, row.existingRevision, row.draft, scope.project._id.toString());
        outcome.updated++;
      } else {
        if (mode === "update") { outcome.skipped++; continue; }
        await caseService.createCase(workspaceId, actorId, { ...row.draft, projectId: scope.project._id.toString() });
        outcome.created++;
      }
    } catch (error: any) { outcome.errors.push({ line: row.line, message: error.message || "Could not import case" }); }
  }
  await Batch.updateOne({ _id: batch._id }, { $set: { status: "complete", outcome } });
  return outcome;
};

export const exportCases = async (workspaceId: string, projectId = "workspace") => {
  await requireEnabled(workspaceId);
  const scope = await qaProjectService.getProjectScope(workspaceId, projectId);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cases");
  sheet.addRow(HEADERS);
  const cursor = TestCase.find({ workspace: workspaceId, ...scope.filter }).sort({ key: 1 }).cursor();
  for await (const item of cursor) {
    sheet.addRow([item.key, item.title, item.priority, item.type, item.state, item.preconditions || "", JSON.stringify(item.steps), JSON.stringify(item.customFields || {})]);
  }
  return workbook.xlsx.writeBuffer();
};
