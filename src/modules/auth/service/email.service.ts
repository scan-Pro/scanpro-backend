import nodemailer from 'nodemailer';
import { env } from '../../../config/env.js';
import { OtpPurpose } from '../dto/auth.dto.js';

export interface OtpEmailSender {
  sendOtp(email: string, otp: string, purpose: OtpPurpose): Promise<void>;
}

export class SmtpEmailService implements OtpEmailSender {
  private readonly transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  async sendOtp(email: string, otp: string, purpose: OtpPurpose): Promise<void> {
    const action = purpose === 'signup' ? 'verify your email' : 'reset your password';
    await this.transporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: purpose === 'signup' ? 'ScanPro email verification code' : 'ScanPro password reset code',
      text: `Use this code to ${action}: ${otp}\n\nThis code expires in 10 minutes. If you did not request it, you can ignore this email.`,
    });
  }
}
