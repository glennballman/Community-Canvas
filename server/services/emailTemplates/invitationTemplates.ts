/**
 * Invitation Email Templates - STEP 11C Phase 2A
 * 
 * Templates for stakeholder invitation emails.
 * No forbidden terms: Uses "service provider" and "reservation" terminology.
 */

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';

function getClaimUrl(token: string): string {
  if (!PUBLIC_BASE_URL) {
    console.warn('[EmailTemplates] PUBLIC_BASE_URL not set - using relative URL');
    return `/i/${token}`;
  }
  return `${PUBLIC_BASE_URL}/i/${token}`;
}

interface InvitationCreatedParams {
  runName: string;
  inviterName: string;
  claimUrl: string;
  token?: string;
}

interface InvitationResentParams {
  runName: string;
  inviterName: string;
  claimUrl: string;
  token?: string;
}

interface InvitationRevokedParams {
  runName: string;
  inviterName: string;
}

interface InvitationClaimedParams {
  runName: string;
  inviteeMaskedEmail: string;
}

export function invitationCreated(params: InvitationCreatedParams): { subject: string; html: string; text: string } {
  const { runName, inviterName, claimUrl } = params;
  
  const subject = `You're invited to view "${runName}"`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>${inviterName}</strong> has invited you to view details about:
    </p>
    <p style="font-size: 18px; font-weight: 600; color: #1f2937; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
      ${runName}
    </p>
    <p style="margin-top: 25px;">
      Click the button below to view the details:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${claimUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Details
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${claimUrl}" style="color: #667eea; word-break: break-all;">${claimUrl}</a>
    </p>
  </div>
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>This invitation was sent by ${inviterName} via Community Canvas.</p>
    <p>If you weren't expecting this, you can safely ignore this message.</p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
You're Invited

${inviterName} has invited you to view details about:
${runName}

Click the link below to view the details:
${claimUrl}

This invitation was sent by ${inviterName} via Community Canvas.
If you weren't expecting this, you can safely ignore this message.
  `.trim();
  
  return { subject, html, text };
}

export function invitationResent(params: InvitationResentParams): { subject: string; html: string; text: string } {
  const { runName, inviterName, claimUrl } = params;
  
  const subject = `Reminder: You're invited to view "${runName}"`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Invitation Reminder</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>${inviterName}</strong> wanted to remind you about your invitation to view:
    </p>
    <p style="font-size: 18px; font-weight: 600; color: #1f2937; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
      ${runName}
    </p>
    <p style="margin-top: 25px;">
      Click the button below to view the details:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${claimUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Details
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${claimUrl}" style="color: #667eea; word-break: break-all;">${claimUrl}</a>
    </p>
  </div>
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>This reminder was sent by ${inviterName} via Community Canvas.</p>
    <p>If you weren't expecting this, you can safely ignore this message.</p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
Invitation Reminder

${inviterName} wanted to remind you about your invitation to view:
${runName}

Click the link below to view the details:
${claimUrl}

This reminder was sent by ${inviterName} via Community Canvas.
If you weren't expecting this, you can safely ignore this message.
  `.trim();
  
  return { subject, html, text };
}

export function invitationRevoked(params: InvitationRevokedParams): { subject: string; html: string; text: string } {
  const { runName, inviterName } = params;
  
  const subject = `Invitation cancelled for "${runName}"`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation Cancelled</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #6b7280; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Invitation Cancelled</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      The invitation from <strong>${inviterName}</strong> to view the following has been cancelled:
    </p>
    <p style="font-size: 18px; font-weight: 600; color: #6b7280; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #6b7280;">
      ${runName}
    </p>
    <p style="margin-top: 25px; color: #6b7280;">
      The invitation link you received is no longer valid.
    </p>
  </div>
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>This notification was sent via Community Canvas.</p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
Invitation Cancelled

The invitation from ${inviterName} to view the following has been cancelled:
${runName}

The invitation link you received is no longer valid.

This notification was sent via Community Canvas.
  `.trim();
  
  return { subject, html, text };
}

export function invitationClaimedToInviter(params: InvitationClaimedParams): { subject: string; html: string; text: string } {
  const { runName, inviteeMaskedEmail } = params;
  
  const subject = `Invitation claimed for "${runName}"`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation Claimed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Invitation Claimed!</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Great news! Your invitation has been claimed.
    </p>
    <p style="font-size: 18px; font-weight: 600; color: #1f2937; background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981;">
      ${runName}
    </p>
    <p style="margin-top: 20px;">
      <strong>${inviteeMaskedEmail}</strong> has accepted your invitation and now has access to view the details.
    </p>
  </div>
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>This notification was sent via Community Canvas.</p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
Invitation Claimed!

Great news! Your invitation has been claimed.

${runName}

${inviteeMaskedEmail} has accepted your invitation and now has access to view the details.

This notification was sent via Community Canvas.
  `.trim();
  
  return { subject, html, text };
}

export { getClaimUrl };
