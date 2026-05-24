import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
  }

  async sendInviteEmail(
    toEmail: string,
    orgName: string,
    inviterName: string,
    token: string,
  ) {
    const frontendUrl = this.config.get('FRONTEND_URL');
    const inviteUrl = `${frontendUrl}/accept-invite?token=${token}`;

    const { data, error } = await this.resend.emails.send({
      from: 'onboarding@resend.dev',
      to: toEmail,
      subject: `You are invited to join ${orgName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
          <h2>You have been invited!</h2>
          <p>
            <strong>${inviterName}</strong> has invited you to join
            <strong>${orgName}</strong>.
          </p>
          <p>Click the button below to accept the invitation:</p>
          <a href="${inviteUrl}" style="
            background:#534AB7;
            color:white;
            padding:12px 24px;
            border-radius:6px;
            text-decoration:none;
            display:inline-block;
            margin:16px 0;
            font-weight:bold;
          ">
            Accept Invitation
          </a>
          <p style="color:#666;font-size:14px">
            This link expires in 7 days.
          </p>
          <p style="color:#666;font-size:14px">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }
  }
}
