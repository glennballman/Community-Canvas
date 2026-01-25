/**
 * Email Service - STEP 11C Phase 2A
 * Minimal SMTP mailer using nodemailer.
 * 
 * Environment Variables:
 * - EMAIL_ENABLED: 'true' to send emails, otherwise no-op
 * - EMAIL_FROM: Sender address (e.g., "Community Canvas <noreply@example.com>")
 * - SMTP_HOST: SMTP server hostname
 * - SMTP_PORT: SMTP server port (usually 587 for TLS)
 * - SMTP_USER: SMTP username
 * - SMTP_PASS: SMTP password
 */

import nodemailer from 'nodemailer';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

interface SendEmailResult {
  sent?: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  
  const enabled = process.env.EMAIL_ENABLED === 'true';
  if (!enabled) return null;
  
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!host || !user || !pass) {
    console.warn('[EmailService] Missing SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASS)');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
  
  return transporter;
}

/**
 * Send an email via SMTP.
 * If EMAIL_ENABLED !== 'true' or SMTP is not configured, logs and returns { skipped: true }.
 * Does not throw - returns error information for caller to handle.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, html, text, metadata } = params;
  
  const enabled = process.env.EMAIL_ENABLED === 'true';
  if (!enabled) {
    console.warn('[EmailService] Email disabled', { to, subject, metadata });
    return { skipped: true };
  }
  
  const transport = getTransporter();
  if (!transport) {
    console.warn('[EmailService] SMTP not configured', { to, subject, metadata });
    return { skipped: true };
  }
  
  const from = process.env.EMAIL_FROM || 'Community Canvas <noreply@community-canvas.app>';
  
  try {
    const result = await transport.sendMail({
      from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    
    console.log('[EmailService] Email sent', {
      messageId: result.messageId,
      to,
      subject,
    });
    
    return { sent: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('[EmailService] Failed to send email', {
      to,
      subject,
      error: error.message,
      metadata,
    });
    return { sent: false, error: error.message };
  }
}

/**
 * Check if email service is enabled and configured.
 */
export function isEmailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === 'true' && !!getTransporter();
}
