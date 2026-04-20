import { Resend } from "resend";

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

  const formattedDate = new Date(meetingDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to,
    subject: `Your deck is ready: ${meetingTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #09090b; color: #fff; border-radius: 16px;">
        <h2 style="margin: 0 0 4px; font-size: 22px;">Your deck is ready</h2>
        <p style="color: #a1a1aa; margin: 0 0 24px;">${meetingTitle} · ${formattedDate}</p>
        ${previewImage ? `<img src="${previewImage}" alt="Deck preview" style="width: 100%; border-radius: 10px; margin-bottom: 24px;" />` : ""}
        <a href="${gammaUrl}" style="display: inline-block; background: #7c3aed; color: #fff; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none; cursor: pointer;">
          View Deck in GammaMeet →
        </a>
        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #27272a; text-align: center;">
          <p style="color: #52525b; font-size: 12px; margin: 0 0 8px;">
            Generated automatically by <a href="https://gamma-meet.com" style="color: #7c3aed; text-decoration: none;">GammaMeet</a>
          </p>
          <p style="color: #3f3f46; font-size: 12px; margin: 0;">
            <a href="https://gamma-meet.com" style="color: #7c3aed; text-decoration: none;">Get your own meeting decks →</a>
          </p>
        </div>
      </div>
    `,
  });
}
