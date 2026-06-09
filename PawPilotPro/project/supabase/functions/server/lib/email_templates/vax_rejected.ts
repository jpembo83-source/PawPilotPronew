export function vaxRejectedEmail(args: {
  ownerName: string;
  tenantName: string;
  petName: string;
  reason: string;
  portalUrl: string;
}) {
  const subject = `${args.tenantName} — we need a different certificate`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">${args.tenantName}</p>
      <h1 style="font-size:22px;color:#111;margin:0 0 12px;">Hi ${args.ownerName},</h1>
      <p style="color:#444;line-height:1.5;">We couldn't add the certificate you uploaded for <strong>${args.petName}</strong> to your record.</p>
      <div style="background:#FAF0E6;border-left:3px solid #C03030;padding:12px 16px;margin:16px 0;border-radius:6px;color:#444;">
        <strong>Reason:</strong><br/>${args.reason}
      </div>
      <p style="color:#444;">You can upload a new one from your portal.</p>
      <p style="margin:20px 0;"><a href="${args.portalUrl}" style="background:#177C5E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block;">Upload again</a></p>
    </div>`;
  return { subject, html, text: `Vaccination not accepted for ${args.petName}: ${args.reason}. ${args.portalUrl}` };
}
