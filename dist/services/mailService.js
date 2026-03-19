"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { Resend } = require("resend");
class MailService {
    constructor() {
        if (!process.env.RESEND_API_KEY) {
            console.warn("RESEND_API_KEY is not set. Email functionality will be disabled.");
            this.resend = null;
        }
        else {
            this.resend = new Resend(process.env.RESEND_API_KEY);
        }
        // Use your verified domain or Resend's test domain
        this.fromEmail = "onboarding@resend.dev";
    }
    /**
     * Generate ClickUp-style HTML email template
     */
    generateInvitationTemplate(workspaceName, inviterName, inviteUrl) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${workspaceName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                You're Invited! 🎉
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 24px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                <strong style="color: #667eea;">${inviterName}</strong> has invited you to join the workspace <strong style="color: #667eea;">${workspaceName}</strong>.
              </p>

              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.5;">
                  💡 <strong>What's next?</strong><br>
                  Click the button below to accept the invitation and start collaborating with your team.
                </p>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" 
                       style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
                      Join Workspace
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; color: #667eea; font-size: 13px; word-break: break-all; background-color: #f8f9fa; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace;">
                ${inviteUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e9ecef; margin: 32px 0;">

              <p style="margin: 0; color: #6c757d; font-size: 13px; line-height: 1.5;">
                <strong>Note:</strong> This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px; color: #6c757d; font-size: 12px;">
                Sent by <strong>TaskFlow</strong> - Your Team Collaboration Platform
              </p>
              <p style="margin: 0; color: #adb5bd; font-size: 11px;">
                © ${new Date().getFullYear()} TaskFlow. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
    }
    /**
     * Generate welcome email template
     */
    generateWelcomeTemplate(userName) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TaskFlow</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
          
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Welcome to TaskFlow! 🚀
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              
              <p style="margin: 0 0 24px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                Thanks for joining TaskFlow! We're excited to have you on board.
              </p>

              <p style="margin: 0 0 24px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                You can now create workspaces, invite team members, and start managing your projects efficiently.
              </p>

              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 24px 0;">
                <p style="margin: 0 0 12px; color: #1a1a1a; font-size: 15px; font-weight: 600;">
                  🎯 Quick Start Guide:
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #495057; font-size: 14px; line-height: 1.8;">
                  <li>Create your first workspace</li>
                  <li>Invite team members</li>
                  <li>Set up your first project</li>
                  <li>Start creating tasks</li>
                </ul>
              </div>

              <p style="margin: 24px 0 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                If you have any questions, feel free to reach out to our support team.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #6c757d; font-size: 12px;">
                © ${new Date().getFullYear()} TaskFlow. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
    }
    /**
     * Send invitation email
     */
    async sendInvitationEmail(params) {
        if (!this.resend) {
            console.warn("Email service not configured. Skipping invitation email.");
            return false;
        }
        try {
            const { toEmail, workspaceName, inviterName, inviteToken } = params;
            // Construct invitation URL
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            const inviteUrl = `${frontendUrl}/join?token=${inviteToken}`;
            // Generate HTML template
            const htmlContent = this.generateInvitationTemplate(workspaceName, inviterName, inviteUrl);
            // Send email
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: toEmail,
                subject: `${inviterName} invited you to join ${workspaceName}`,
                html: htmlContent
            });
            if (error) {
                console.error("Failed to send invitation email:", error);
                return false;
            }
            console.log("Invitation email sent successfully:", data?.id);
            return true;
        }
        catch (error) {
            console.error("Error sending invitation email:", error);
            return false;
        }
    }
    /**
     * Send welcome email to new users
     */
    async sendWelcomeEmail(params) {
        if (!this.resend) {
            console.warn("Email service not configured. Skipping welcome email.");
            return false;
        }
        try {
            const { toEmail, userName } = params;
            const htmlContent = this.generateWelcomeTemplate(userName);
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: toEmail,
                subject: "Welcome to TaskFlow! 🚀",
                html: htmlContent
            });
            if (error) {
                console.error("Failed to send welcome email:", error);
                return false;
            }
            console.log("Welcome email sent successfully:", data?.id);
            return true;
        }
        catch (error) {
            console.error("Error sending welcome email:", error);
            return false;
        }
    }
    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(params) {
        if (!this.resend) {
            console.warn("Email service not configured. Skipping password reset email.");
            return false;
        }
        try {
            const { toEmail, userName, resetToken } = params;
            const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
            const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
          
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Reset Your Password 🔐
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              
              <p style="margin: 0 0 24px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" 
                       style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; color: #667eea; font-size: 13px; word-break: break-all; background-color: #f8f9fa; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace;">
                ${resetUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #e9ecef; margin: 32px 0;">

              <p style="margin: 0; color: #dc3545; font-size: 13px; line-height: 1.5;">
                <strong>Security Note:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #6c757d; font-size: 12px;">
                © ${new Date().getFullYear()} TaskFlow. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: toEmail,
                subject: "Reset Your Password - TaskFlow",
                html: htmlContent
            });
            if (error) {
                console.error("Failed to send password reset email:", error);
                return false;
            }
            console.log("Password reset email sent successfully:", data?.id);
            return true;
        }
        catch (error) {
            console.error("Error sending password reset email:", error);
            return false;
        }
    }
    /**
     * Send space invitation email
     */
    async sendSpaceInvitation(params) {
        if (!this.resend) {
            console.warn("Email service not configured. Skipping space invitation email.");
            return false;
        }
        try {
            const { email, spaceName, workspaceName, inviterName, role } = params;
            const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?email=${encodeURIComponent(email)}`;
            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join ${spaceName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f7;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
          
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                You're Invited to a Space! 🚀
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                Hi there,
              </p>
              
              <p style="margin: 0 0 24px; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                <strong style="color: #667eea;">${inviterName}</strong> has invited you to join the space <strong style="color: #667eea;">${spaceName}</strong> in the workspace <strong>${workspaceName}</strong> as a <strong>${role}</strong>.
              </p>

              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #495057; font-size: 14px; line-height: 1.5;">
                  💡 <strong>What's next?</strong><br>
                  Click the button below to create your account and start collaborating with your team.
                </p>
              </div>

              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${inviteUrl}" 
                       style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Join Space
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" style="color: #667eea; text-decoration: none; word-break: break-all;">
                  ${inviteUrl}
                </a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #6c757d; font-size: 12px;">
                © ${new Date().getFullYear()} TaskFlow. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();
            const { data, error } = await this.resend.emails.send({
                from: this.fromEmail,
                to: email,
                subject: `You've been invited to ${spaceName} - TaskFlow`,
                html: htmlContent
            });
            if (error) {
                console.error("Failed to send space invitation email:", error);
                return false;
            }
            console.log("Space invitation email sent successfully:", data?.id);
            return true;
        }
        catch (error) {
            console.error("Error sending space invitation email:", error);
            return false;
        }
    }
}
// Export singleton instance
module.exports = new MailService();
