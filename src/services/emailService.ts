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

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;
  private verificationPromise: Promise<void> | null = null;

  constructor() {
    // Only initialize if SMTP credentials are provided
    if (process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)) {
      try {
        // Create transporter with Gmail or custom SMTP
        const smtpPort = parseInt(process.env.SMTP_PORT || '587');
        const transportOptions: any = {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: smtpPort,
          secure: smtpPort === 465, // true for 465, false for 587
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false
          },
          // CRITICAL: Force IPv4 and increase timeouts to avoid timeouts on hosts like Render
          family: 4,
          pool: true, // Reuse connections
          connectionTimeout: 20000, // 20s
          greetingTimeout: 20000, // 20s
          socketTimeout: 30000, // 30s
        };
        this.transporter = nodemailer.createTransport(transportOptions);

        console.log('🔧 Email service initializing via SMTP...');
        console.log(`   Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
        console.log(`   Port: ${smtpPort}`);
        console.log(`   User: ${process.env.SMTP_USER}`);

        // Verify connection configuration on startup (async)
        this.verificationPromise = new Promise((resolve) => {
          this.transporter!.verify((error) => {
            if (error) {
              console.error('❌ Email service connection failed:', error.message);
              this.isConfigured = false;
            } else {
              console.log('✅ Email service is ready to send messages');
              this.isConfigured = true;
            }
            resolve();
          });
        });
      } catch (error) {
        console.error('❌ Failed to initialize email service:', error);
        this.isConfigured = false;
      }
    } else {
      console.log('ℹ️  Email service not configured (SMTP credentials missing).');
      this.isConfigured = false;
    }
  }

  /**
   * Wait for verification to complete
   */
  async waitForVerification(): Promise<void> {
    if (this.verificationPromise) {
      await this.verificationPromise;
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    // Wait for verification to complete (but don't block forever)
    await Promise.race([
      this.waitForVerification(),
      new Promise(resolve => setTimeout(resolve, 5000)) // 5s max wait
    ]);

    if (!this.transporter) {
      console.log('ℹ️  Email transporter not initialized. Skipping email to:', options.to);
      return;
    }

    // Even if verification failed at startup, still attempt to send
    // (verification timeout on Render should not block email delivery)
    if (!this.isConfigured) {
      console.warn('⚠️  Email service verification failed at startup, attempting send anyway...');
    }

    try {
      // Fetch dynamic system name
      let systemName = process.env.APP_NAME || 'Workspace App';
      try {
        const settings = await SystemSettings.findOne();
        if (settings && settings.systemName) {
          systemName = settings.systemName;
        }
      } catch (e) {
        // Silently fallback if db error
      }

      const mailOptions = {
        from: `"${systemName}" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully!');
      console.log('   Message ID:', info.messageId);
      console.log('   To:', options.to);
    } catch (error: any) {
      console.error('❌ Failed to send email:', error.message);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send space invitation email
   */
  async sendSpaceInvitation(data: InvitationEmailData): Promise<void> {
    // Fetch dynamic system name
    let systemName = process.env.APP_NAME || 'Workspace App';
    try {
      const settings = await SystemSettings.findOne();
      if (settings && settings.systemName) {
        systemName = settings.systemName;
      }
    } catch (e) {}

    const subject = `${data.inviterName} invited you to join ${data.spaceName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Space Invitation</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              color: #3b82f6;
              margin-bottom: 10px;
            }
            .content {
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #3b82f6;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              text-align: center;
            }
            .button:hover {
              background-color: #2563eb;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 14px;
              color: #6b7280;
            }
            .info-box {
              background-color: #f3f4f6;
              border-left: 4px solid #3b82f6;
              padding: 15px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">${systemName}</div>
            </div>
            
            <div class="content">
              <h2>You've been invited! 🎉</h2>
              <p>Hi${data.recipientName ? ` ${data.recipientName}` : ''},</p>
              <p>
                <strong>${data.inviterName}</strong> has invited you to join the 
                <strong>${data.spaceName}</strong> space in the <strong>${data.workspaceName}</strong> workspace.
              </p>
              
              <div class="info-box">
                <p style="margin: 0;"><strong>Workspace:</strong> ${data.workspaceName}</p>
                <p style="margin: 5px 0 0 0;"><strong>Space:</strong> ${data.spaceName}</p>
              </div>
              
              <p>Click the button below to accept the invitation and start collaborating:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.invitationLink}" class="button">Accept Invitation</a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${data.invitationLink}" style="color: #3b82f6; word-break: break-all;">${data.invitationLink}</a>
              </p>
            </div>
            
            <div class="footer">
              <p>This invitation was sent by ${data.inviterName}.</p>
              <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      You've been invited!
      
      ${data.inviterName} has invited you to join the ${data.spaceName} space in the ${data.workspaceName} workspace.
      
      Click the link below to accept the invitation:
      ${data.invitationLink}
      
      If you weren't expecting this invitation, you can safely ignore this email.
    `;

    await this.sendEmail({
      to: data.recipientEmail,
      subject,
      html,
      text,
    });
  }

  /**
   * Send workspace member invitation email
   */
  async sendWorkspaceInvitation(data: {
      recipientEmail: string;
      recipientName: string;
      inviterName: string;
      workspaceName: string;
      role: string;
      workspaceLink: string;
    }): Promise<void> {
      // Fetch dynamic system name
      let systemName = process.env.APP_NAME || 'Teamsever';
      try {
        const settings = await SystemSettings.findOne();
        if (settings && settings.systemName) {
          systemName = settings.systemName;
        }
      } catch (e) {}

      const subject = `${data.inviterName} invited you to join ${data.workspaceName}`;

      const roleDisplay = data.role === 'admin' ? 'Admin' : data.role === 'guest' ? 'Guest' : 'Member';

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #135bec 0%, #0d47a1 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="font-size: 20px; font-weight: bold; color: white; margin-bottom: 8px;">${systemName}</div>
                    <div style="color: #A0AEC0; font-size: 14px;">Better team collaboration</div>
                    <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">You're Invited!</h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Join your team workspace</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <!-- Workspace Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #135bec;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px;">Workspace</td>
                      </tr>
                      <tr>
                        <td style="font-size: 18px; color: #1e293b; font-weight: bold;">${data.workspaceName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Inviter Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background-color: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px;">Invited by</td>
                      </tr>
                      <tr>
                        <td style="font-size: 18px; color: #1e293b; font-weight: bold;">${data.inviterName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Role Info -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 4px;">Your Role</td>
                      </tr>
                      <tr>
                        <td style="font-size: 18px; color: #10b981; font-weight: bold; text-transform: capitalize;">${roleDisplay}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${data.workspaceLink}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #135bec 0%, #0d47a1 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(19, 91, 236, 0.3);">
                      Join Workspace
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 20px; background-color: #f8fafc; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">Or copy and paste this link:</p>
                    <p style="margin: 0; font-size: 12px; color: #135bec; word-break: break-all;">${data.workspaceLink}</p>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
                <strong>Note:</strong> This invitation will expire in 7 days.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} ${systemName}. All rights reserved.
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

      const text = `
You're Invited!

${data.inviterName} has invited you to join the ${data.workspaceName} workspace as a ${roleDisplay}.

Click the link below to join the workspace:
${data.workspaceLink}

This invitation will expire in 7 days.
If you weren't expecting this invitation, you can safely ignore this email.
      `;

      await this.sendEmail({
        to: data.recipientEmail,
        subject,
        html,
        text,
      });
    }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    // Password reset should never be "silently skipped" — surface config issues.
    await this.waitForVerification();
    if (!this.isConfigured || !this.transporter) {
      throw new Error("Email service not configured");
    }
    // Fetch dynamic system name
    let systemName = process.env.APP_NAME || 'Teamsever';
    try {
      const settings = await SystemSettings.findOne();
      if (settings && settings.systemName) {
        systemName = settings.systemName;
      }
    } catch (e) {}

    const subject = `Reset your password - ${systemName}`;

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
  </head>
  <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f5f5f5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;">
            <tr>
              <td style="padding:28px 28px 8px;text-align:center;">
                <div style="font-size:22px;font-weight:800;color:#135bec;">${systemName}</div>
                <div style="font-size:28px;margin:12px 0;">🔐</div>
                <h1 style="margin:0;color:#0f172a;font-size:20px;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px;">
                <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">
                  Hi${data.recipientName ? ` ${data.recipientName}` : ''},
                </p>
                <p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.6;">
                  We received a request to reset your password. Click the button below to set a new password.
                </p>
                <div style="text-align:center;margin:22px 0;">
                  <a href="${data.resetLink}" style="display:inline-block;padding:12px 22px;background:#135bec;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">
                    Reset Password
                  </a>
                </div>
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.6;">
                  If the button doesn’t work, copy and paste this link:
                </p>
                <p style="margin:0;color:#135bec;font-size:12px;word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:8px;">
                  ${data.resetLink}
                </p>
                <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
                  If you didn’t request a password reset, you can ignore this email.
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

    const text = `
Reset your password

Hi${data.recipientName ? ` ${data.recipientName}` : ''},

We received a request to reset your password. Open this link to set a new password:
${data.resetLink}

If you didn’t request a password reset, you can ignore this email.
    `.trim();

    await this.sendEmail({
      to: data.recipientEmail,
      subject,
      html,
      text,
    });
  }
}

// Export singleton instance for CommonJS
module.exports = new EmailService();

export {};
