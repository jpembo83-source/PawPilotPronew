export function inviteEmail(args: {
  ownerName: string;
  tenantName: string;
  acceptUrl: string;
  expiresInHours: number;
}) {
  const subject = `${args.tenantName} — set up your portal account`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-size:14px;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">${args.tenantName}</p>
      <h1 style="font-size:24px;color:#111;margin:0 0 16px;">Hi ${args.ownerName}, your portal's ready.</h1>
      <p style="font-size:15px;line-height:1.5;color:#444;">
        We've set up a self-service portal for your pet's bookings, vaccinations, and account. Click below to set your password — the link expires in ${args.expiresInHours} hours.
      </p>
      <p style="margin:24px 0;">
        <a href="${args.acceptUrl}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;display:inline-block;">Set up my account</a>
      </p>
      <p style="font-size:12px;color:#888;">If the button doesn't work, paste this link into your browser:<br/>${args.acceptUrl}</p>
    </div>
  `;
  const text = `${args.tenantName}\n\nHi ${args.ownerName}, your portal's ready. Set your password (link expires in ${args.expiresInHours}h):\n\n${args.acceptUrl}`;
  return { subject, html, text };
}
