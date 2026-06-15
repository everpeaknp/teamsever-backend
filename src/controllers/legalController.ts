const asyncHandler = require("../utils/asyncHandler");

const legalPages = {
  privacy: {
    slug: "privacy-policy",
    title: "Privacy Policy",
    lastUpdated: "2026-06-12",
    content: [
      "This Privacy Policy explains how Teamsever collects, uses, stores, and shares information when you use our website, mobile app, and related services.",
      "Information we collect may include account information, authentication data, workspace content, device and usage data, and notification tokens.",
      "We use this information to create and manage accounts, authenticate users, provide core collaboration features, improve the service, and send service-related emails and notifications.",
      "We do not sell personal information. We may share data with service providers that help us operate the platform, and we may disclose information when required by law or to protect users and the service.",
      "If you delete your account, we soft delete it in our system and may retain limited records for security, fraud prevention, or legal compliance.",
      "Teamsever is not intended for children under 13.",
      "If you have questions about this policy, contact Teamsever support."
    ].join(" ")
  },
  terms: {
    slug: "terms-and-conditions",
    title: "Terms and Conditions",
    lastUpdated: "2026-06-12",
    content: [
      "These Terms and Conditions govern your access to and use of Teamsever.",
      "You are responsible for maintaining the confidentiality of your account credentials and for activity that occurs under your account.",
      "You may request account deletion from within the app. Deletion is soft deletion on our backend, and some records may be retained for legal, security, or operational reasons.",
      "You agree not to misuse the service, upload harmful content, attempt unauthorized access, or use the service for abuse or harassment.",
      "If you purchase a paid plan, billing terms, renewal terms, and pricing are shown at the point of purchase and may be updated from time to time.",
      "The service may integrate with third-party providers such as Firebase, Google, GitHub, Apple, cloud storage, and email providers.",
      "The service is provided on an as-is and as-available basis, and we may suspend or terminate access for violations of these terms or for security reasons.",
      "If you have questions about these terms, contact Teamsever support."
    ].join(" ")
  }
};

export const getPrivacyPolicy = asyncHandler(async (_req: any, res: any) => {
  res.json({ success: true, data: legalPages.privacy });
});

export const getTermsAndConditions = asyncHandler(async (_req: any, res: any) => {
  res.json({ success: true, data: legalPages.terms });
});

module.exports = { getPrivacyPolicy, getTermsAndConditions };
