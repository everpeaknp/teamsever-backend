import nodemailer from 'nodemailer';
const SystemSettings = require('../models/SystemSettings');

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface InvitationEmailData {
  recipientEmail: string;
  recipientName?: string;
  inviterName: string;
  spaceName: string;
  workspaceName: string;
  invitationLink: string;
}

interface PasswordResetEmailData {
  recipientEmail: string;
  recipientName?: string;
  resetLink: string;
}

interface WorkspaceInvitationData {
  recipientEmail: string;
  recipientName: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  workspaceLink: string;
}

/**
 * EmailService
 * Handles all email communications using Nodemailer (SMTP)
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;
  private verificationPromise: Promise<void> | null = null;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.SMTP_USER || "noreply@teamsever.com";

    // Initialize Nodemailer (SMTP)
    if (process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)) {
      try {
        const smtpPort = parseInt(process.env.SMTP_PORT || '587');
        const dns = require('dns');
        const transportOptions: any = {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2',
            servername: process.env.SMTP_HOST || 'smtp.gmail.com'
          },
          lookup: (hostname: string, options: any, callback: any) => {
            dns.lookup(hostname, { family: 4 }, callback);
          },
          family: 4,
          pool: true,
          connectionTimeout: 30000,
          greetingTimeout: 30000,
          socketTimeout: 45000
        };
        this.transporter = nodemailer.createTransport(transportOptions);

        this.verificationPromise = new Promise((resolve) => {
          this.transporter!.verify((error) => {
            if (error) {
              console.error('❌ Email service (SMTP) connection failed:', error.message);
            } else {
              console.log('✅ Email service (SMTP) is ready');
              this.isConfigured = true;
            }
            resolve();
          });
        });
      } catch (error) {
        console.error('❌ Failed to initialize SMTP email service:', error);
      }
    }

    if (!this.isConfigured) {
      console.log('ℹ️ Email service not configured (SMTP credentials missing).');
    }
  }

  async waitForVerification(): Promise<void> {
    if (this.verificationPromise) {
      await this.verificationPromise;
    }
  }

  private async getSystemName(): Promise<string> {
    try {
      const settings = await SystemSettings.findOne();
      return settings?.systemName || process.env.APP_NAME || 'Teamsever';
    } catch (e) {
      return process.env.APP_NAME || 'Teamsever';
    }
  }

  /**
   * Core send method
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.isConfigured || !this.transporter) {
       console.log(`ℹ️ Email delivery skipped for ${options.to} (Provider not configured)`);
       return;
    }

    const systemName = await this.getSystemName();
    const from = `"${systemName}" <${this.fromEmail}>`;

    try {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      console.log(`✅ Email sent via SMTP to: ${options.to}`);
    } catch (error: any) {
      console.error(`❌ SMTP send failed: ${error.message}`);
      throw new Error('Failed to send email via SMTP');
    }
  }

  /**
   * Template: Space Invitation
   */
  async sendSpaceInvitation(data: InvitationEmailData): Promise<void> {
    const systemName = await this.getSystemName();
    const subject = `${data.inviterName} invited you to join ${data.spaceName}`;
    
    // Using the rich template from emailService.ts
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Space Invitation</title>
          <style>
            body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 32px; font-weight: bold; color: #3b82f6; margin-bottom: 10px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 14px; color: #6b7280; }
            .info-box { background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><div class="logo">${systemName}</div></div>
            <div class="content">
              <h2>You've been invited! 🎉</h2>
              <p>Hi${data.recipientName ? ` ${data.recipientName}` : ''},</p>
              <p><strong>${data.inviterName}</strong> has invited you to join the <strong>${data.spaceName}</strong> space in <strong>${data.workspaceName}</strong>.</p>
              <div class="info-box">
                <p style="margin: 0;"><strong>Workspace:</strong> ${data.workspaceName}</p>
                <p style="margin: 5px 0 0 0;"><strong>Space:</strong> ${data.spaceName}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.invitationLink}" class="button">Accept Invitation</a>
              </div>
            </div>
            <div class="footer"><p>This invitation was sent by ${data.inviterName}.</p></div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({ to: data.recipientEmail, subject, html });
  }

  /**
   * Template: Workspace Invitation
   */
  async sendWorkspaceInvitation(data: WorkspaceInvitationData): Promise<void> {
    const systemName = await this.getSystemName();
    const subject = `${data.inviterName} invited you to join ${data.workspaceName}`;
    const roleDisplay = data.role.charAt(0).toUpperCase() + data.role.slice(1);

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f5f5f5;">
          <table width="100%" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr><td align="center">
              <table width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <tr><td style="background: linear-gradient(135deg, #135bec 0%, #0d47a1 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <div style="font-size: 20px; font-weight: bold; color: white;">${systemName}</div>
                  <h1 style="color: white; font-size: 28px;">You're Invited!</h1>
                </td></tr>
                <tr><td style="padding: 40px 30px;">
                  <p><strong>${data.workspaceName}</strong></p>
                  <p>Invited by: ${data.inviterName}</p>
                  <p>Role: ${roleDisplay}</p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.workspaceLink}" style="padding: 16px 48px; background: #135bec; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Join Workspace</a>
                  </div>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `;

    await this.sendEmail({ to: data.recipientEmail, subject, html });
  }

  /**
   * Template: Password Reset
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    const systemName = await this.getSystemName();
    const subject = `Reset your password - ${systemName}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #135bec;">${systemName}</h2>
        <p>Hi${data.recipientName ? ` ${data.recipientName}` : ''},</p>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetLink}" style="padding: 12px 24px; background: #135bec; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
        </div>
      </div>
    `;

    await this.sendEmail({ to: data.recipientEmail, subject, html });
  }

  /**
   * Template: Welcome Email
   */
  async sendWelcomeEmail(data: { toEmail: string; userName: string }): Promise<void> {
    const systemName = await this.getSystemName();
    const subject = `Welcome to ${systemName}! 🚀`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>Welcome, ${data.userName}!</h1>
        <p>We're excited to have you join ${systemName}. Start collaborating with your team today!</p>
      </div>
    `;

    await this.sendEmail({ to: data.toEmail, subject, html });
  }
}

module.exports = new EmailService();
export {};
