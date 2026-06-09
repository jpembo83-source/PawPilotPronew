export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<{ id: string }>;
}

class ResendSender implements EmailSender {
  constructor(private apiKey: string, private defaultFrom: string) {}
  async send(msg: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: msg.from ?? this.defaultFrom,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body}`);
    }
    return res.json();
  }
}

export function getEmailSender(): EmailSender {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("PORTAL_EMAIL_FROM") ?? "PawPilotPro <hello@pawpilotpro.app>";
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new ResendSender(key, from);
}
