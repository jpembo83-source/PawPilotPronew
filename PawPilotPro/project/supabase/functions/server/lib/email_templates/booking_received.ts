export function bookingReceivedEmail(args: {
  ownerName: string;
  tenantName: string;
  service: string;
  startAt: string;
  bookingUrl: string;
}) {
  const start = new Date(args.startAt).toLocaleString();
  const subject = `${args.tenantName} — request received`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;color:#888;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px;">${args.tenantName}</p>
      <h1 style="font-size:22px;color:#111;margin:0 0 12px;">We got your request, ${args.ownerName}</h1>
      <p style="color:#444;line-height:1.5;">Your <strong>${args.service}</strong> request for <strong>${start}</strong> is now in our queue. Staff will confirm shortly.</p>
      <p style="margin:20px 0;"><a href="${args.bookingUrl}" style="background:#177C5E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block;">View request</a></p>
    </div>`;
  return { subject, html, text: `Request received: ${args.service} on ${start}. ${args.bookingUrl}` };
}
