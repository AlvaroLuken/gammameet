import { Resend } from "resend";
import { supabase } from "./supabase";
import { unsubscribeUrl } from "./unsubscribe";

async function filterOptedOut(emails: string[]): Promise<string[]> {
  if (emails.length === 0) return [];
  const { data } = await supabase
    .from("email_opt_outs")
    .select("email")
    .in("email", emails.map((e) => e.toLowerCase()));
  const optedOut = new Set((data ?? []).map((r) => r.email));
  return emails.filter((e) => !optedOut.has(e.toLowerCase()));
}

/**
 * Respect per-user share_mode preferences.
 * If any registered GammaMeet user in the attendee list has share_mode="me_only",
 * filter the recipient list to registered users only — non-registered attendees
 * don't get the email.
 */
async function applySharePreferences(emails: string[]): Promise<string[]> {
  if (emails.length === 0) return [];
  const lowered = emails.map((e) => e.toLowerCase());
  const { data: users } = await supabase
    .from("users")
    .select("email, dashboard_prefs")
    .in("email", lowered);

  const registered = new Set((users ?? []).map((u) => u.email.toLowerCase()));
  const anyMeOnly = (users ?? []).some(
    (u) => (u.dashboard_prefs as { shareMode?: string } | null)?.shareMode === "me_only"
  );

  if (anyMeOnly) {
    return emails.filter((e) => registered.has(e.toLowerCase()));
  }
  return emails;
}

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  line-height: 1.5;
  color: #111;
  background: #f4f4f5;
`;

function wrap(inner: string, preheader: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0;padding:0;${BASE_STYLE}">
        <span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <tr>
                  <td style="padding:28px 32px 8px;border-bottom:1px solid #f4f4f5;">
                    <div style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#111;">
                      Gamma<span style="color:#7c3aed;">Meet</span>
                    </div>
                  </td>
                </tr>
                ${inner}
              </table>
              <p style="color:#9ca3af;font-size:12px;margin:20px 0 0;text-align:center;">
                © ${new Date().getFullYear()} GammaMeet ·
                <a href="https://www.gamma-meet.com" style="color:#9ca3af;text-decoration:underline;">gamma-meet.com</a>
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export async function sendRecapEmail({
  to,
  meetingTitle,
  meetingDate,
  gammaUrl,
  previewImage,
}: {
  to: string[];
  meetingTitle: string;
  meetingDate: string;
  gammaUrl: string;
  previewImage: string | null;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const afterShare = await applySharePreferences(to);
  const filteredTo = await filterOptedOut(afterShare);
  if (filteredTo.length === 0) {
    console.log("sendRecapEmail: no eligible recipients, skipping");
    return;
  }

  const formattedDate = new Date(meetingDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Resend: one email per recipient so each gets their own unsubscribe link
  await Promise.all(
    filteredTo.map(async (recipient) => {
      const inner = renderRecapInner({ meetingTitle, formattedDate, gammaUrl, previewImage, unsubUrl: unsubscribeUrl(recipient) });
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: [recipient],
        subject: `Your deck is ready: ${meetingTitle}`,
        html: wrap(inner, `Your GammaMeet deck for "${meetingTitle}" is ready.`),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl(recipient)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    })
  );
}

function renderRecapInner({ meetingTitle, formattedDate, gammaUrl, previewImage, unsubUrl }: {
  meetingTitle: string;
  formattedDate: string;
  gammaUrl: string;
  previewImage: string | null;
  unsubUrl: string;
}) {
  return `
    <tr>
      <td style="padding:32px;">
        <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#7c3aed;margin:0 0 8px;">
          Your deck is ready
        </p>
        <h1 style="font-size:26px;font-weight:700;color:#111;margin:0 0 6px;letter-spacing:-0.5px;line-height:1.2;">
          ${meetingTitle}
        </h1>
        <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${formattedDate}</p>

        ${
          previewImage
            ? `
              <a href="${gammaUrl}" style="display:block;text-decoration:none;margin-bottom:24px;">
                <img src="${previewImage}" alt="${meetingTitle}" width="496" style="width:100%;max-width:496px;height:auto;border-radius:12px;display:block;border:1px solid #e5e7eb;" />
              </a>
            `
            : ""
        }

        <a href="${gammaUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;font-weight:600;font-size:15px;padding:14px 26px;border-radius:999px;text-decoration:none;">
          View your deck →
        </a>

        <p style="color:#6b7280;font-size:13px;margin:32px 0 0;line-height:1.6;">
          You can edit, restyle, or share the deck right in Gamma. Action items and a full summary are inside.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 28px;background:#fafafa;border-top:1px solid #f4f4f5;">
        <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;line-height:1.5;">
          Generated automatically by GammaMeet · <a href="https://www.gamma-meet.com" style="color:#7c3aed;text-decoration:none;">Get your own meeting decks</a>
        </p>
        <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.5;">
          Received this because you attended the meeting. <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>.
        </p>
      </td>
    </tr>
  `;
}

export async function sendWelcomeEmail({ to, name }: { to: string; name: string | null }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const firstName = (name ?? "").split(" ")[0];
  const greeting = firstName ? `Hey ${firstName},` : "Hey there,";

  const inner = `
    <tr>
      <td style="padding:32px;">
        <p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#7c3aed;margin:0 0 8px;">
          Welcome aboard
        </p>
        <h1 style="font-size:28px;font-weight:700;color:#111;margin:0 0 20px;letter-spacing:-0.5px;line-height:1.2;">
          You're in. Here's how GammaMeet works.
        </h1>

        <p style="color:#374151;font-size:15px;margin:0 0 20px;line-height:1.6;">
          ${greeting} from now on, every Google Meet on your calendar gets a beautifully-designed Gamma deck, emailed to all attendees right after the call. No setup, no notes.
        </p>

        <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:20px 24px;margin:24px 0;">
          <p style="font-size:13px;font-weight:600;color:#7c3aed;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.8px;">
            What happens next
          </p>
          <ol style="margin:0;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
            <li><strong>GammaMeet watches your calendar</strong> for meetings with a Meet link.</li>
            <li><strong>Jim from GammaMeet</strong> joins each meeting 2 min before it starts — just admit him when he knocks.</li>
            <li><strong>A polished deck</strong> lands in everyone's inbox within minutes of the meeting ending.</li>
          </ol>
        </div>

        <a href="https://www.gamma-meet.com/dashboard" style="display:inline-block;background:#7c3aed;color:#ffffff;font-weight:600;font-size:15px;padding:14px 26px;border-radius:999px;text-decoration:none;">
          Open your dashboard →
        </a>

        <p style="color:#6b7280;font-size:13px;margin:32px 0 0;line-height:1.6;">
          Have a meeting starting right now? Paste the link at
          <a href="https://www.gamma-meet.com/add-bot" style="color:#7c3aed;text-decoration:none;">gamma-meet.com/add-bot</a>
          and Jim joins instantly.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 28px;background:#fafafa;border-top:1px solid #f4f4f5;">
        <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;line-height:1.5;">
          Questions? Check the <a href="https://www.gamma-meet.com/faq" style="color:#7c3aed;text-decoration:none;">FAQ</a> or reply to this email.
        </p>
        <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.5;">
          GammaMeet · <a href="https://www.gamma-meet.com" style="color:#9ca3af;text-decoration:underline;">gamma-meet.com</a>
        </p>
      </td>
    </tr>
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [to],
    subject: "Welcome to GammaMeet — here's how it works",
    html: wrap(inner, "Your GammaMeet account is ready. Here's what happens next."),
  });
}
