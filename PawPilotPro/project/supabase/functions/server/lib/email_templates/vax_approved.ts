export function vaxApprovedEmail(args: {
  ownerName: string;
  tenantName: string;
  petName: string;
  vaxType: string;
  expiresAt: string | null;
  portalUrl: string;
}) {
  const expiry = args.expiresAt ? `Next due: ${new Date(args.expiresAt).toLocaleDateString()}.` : "";
  const subject = `${args.petName}'s ${args.vaxType} vaccination is on file`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">${args.tenantName}</p>
      <h1 style="font-size:22px;color:#111;margin:0 0 12px;">All set, ${args.ownerName}</h1>
      <p style="color:#444;line-height:1.5;">We've added the <strong>${args.vaxType}</strong> certificate to <strong>${args.petName}</strong>'s record. ${expiry}</p>
      <p style="margin:20px 0;"><a href="${args.portalUrl}" style="background:#177C5E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block;">View ${args.petName}</a></p>
    </div>`;
  return { subject, html, text: `${args.petName}'s ${args.vaxType} vaccination is on file. ${expiry} ${args.portalUrl}` };
}
