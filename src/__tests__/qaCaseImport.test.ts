const ExcelJS = require("exceljs");
const { parseCaseFile } = require("../services/testCaseImportService");

const spreadsheet = async (rows: any[][]) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cases");
  rows.forEach(row => sheet.addRow(row));
  return { originalname: "cases.xlsx", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
};

describe("QA case import", () => {
  it("reports a malformed step row without discarding other rows", async () => {
    const file = await spreadsheet([
      ["Key", "Title", "Priority", "Type", "State", "Preconditions", "Steps"],
      ["", "Sign in succeeds", "high", "manual", "active", "Account exists", JSON.stringify([{ action: "Sign in", expectedResult: "Dashboard" }])],
      ["", "Sign in fails", "medium", "manual", "active", "", "not-json"],
    ]);
    const rows = await parseCaseFile(file);
    expect(rows).toHaveLength(2);
    expect(rows[0].errors).toHaveLength(0);
    expect(rows[1].errors).toContain("Steps must be a JSON array of action and expectedResult pairs");
  });

  it("rejects a spreadsheet with missing required columns", async () => {
    const file = await spreadsheet([["Title"], ["Sign in"]]);
    await expect(parseCaseFile(file)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("flags duplicate case titles in one file", async () => {
    const steps = JSON.stringify([{ action: "Open", expectedResult: "Visible" }]);
    const file = await spreadsheet([["Title", "Steps"], ["Sign in", steps], ["Sign in", steps]]);
    const rows = await parseCaseFile(file);
    expect(rows[1].errors).toContain("Duplicate key or title in this file");
  });

  it("accepts UTF-8 CSV with quoted step JSON", async () => {
    const steps = JSON.stringify([{ action: "खोल्नुहोस्", expectedResult: "Visible" }]);
    const quoted = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = `Title,Steps\nSign in,${quoted(steps)}\n`;
    const rows = await parseCaseFile({ originalname: "cases.csv", buffer: Buffer.from(csv, "utf8") });
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].draft.steps[0].action).toBe("खोल्नुहोस्");
  });
});
