export function bookingDeclinedEmail(args: {
  ownerName: string;
  tenantName: string;
  service: string;
  startAt: string;
  reason: string;
  bookingUrl: string;
}) {
  const start = new Date(args.startAt).toLocaleString();
  const subject = `${args.tenantName} — could not confirm your booking`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">${args.tenantName}</p>
      <h1 style="font-size:22px;color:#111;margin:0 0 12px;">Hi ${args.ownerName},</h1>
      <p style="color:#444;line-height:1.5;">We couldn't confirm your <strong>${args.service}</strong> request for <strong>${start}</strong>.</p>
      <div style="background:#FAF0E6;border-left:3px solid #C03030;padding:12px 16px;margin:16px 0;border-radius:6px;color:#444;">
        <strong>Reason:</strong><br/>${args.reason}
      </div>
      <p style="color:#444;">Try submitting a new request from your portal, or reach out and we'll help.</p>
      <p style="margin:20px 0;"><a href="${args.bookingUrl}" style="background:#177C5E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block;">View details</a></p>
    </div>`;
  return { subject, html, text: `Declined: ${args.service} on ${start}. Reason: ${args.reason}. ${args.bookingUrl}` };
}
