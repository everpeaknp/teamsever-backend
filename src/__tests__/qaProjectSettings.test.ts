const { validateSettings } = require("../services/qaProjectService");

describe("QA project case field settings", () => {
  it("keeps built-in Priority choices fixed while allowing other fields to change", () => {
    const settings = validateSettings({
      caseFields: [
        { key: "priority", label: "Priority", type: "multiselect", required: true, enabled: true, options: ["P0"] },
        { key: "platform", label: "Platform", type: "multiselect", required: false, enabled: true, options: ["Web", "Mobile"] },
      ],
    });

    expect(settings.caseFields).toEqual([
      { key: "priority", label: "Priority", type: "select", required: false, enabled: true, options: ["low", "medium", "high", "urgent"] },
      { key: "platform", label: "Platform", type: "multiselect", required: false, enabled: true, options: ["Web", "Mobile"] },
    ]);
  });
});
