/**
 * Gubernator-branded HTML email layout for app-originated mail (test sends
 * and manual notifications sent via this function). Mirrors the visual
 * design of the Supabase auth templates in `supabase/templates/` (dark
 * header with wordmark, content slot, muted footer) -- GoTrue templates are
 * static Go-template files and cannot import this module, so the markup is
 * intentionally kept in sync by hand across both locations.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Converts a plain-text message body (as authored by a superadmin in the
 * manual notification sender) into safe HTML: characters are escaped first,
 * then line breaks are turned into paragraphs/<br> so the author's intent is
 * preserved without allowing arbitrary HTML/script injection.
 */
export function renderMessageBodyHtml(plainTextMessage: string): string {
  const paragraphs = plainTextMessage
    .split(/\n{2,}/)
    .map((paragraph) => escapeHtml(paragraph.trim()).replace(/\n/g, "<br />"))
    .filter((paragraph) => paragraph.length > 0);

  return paragraphs.map((paragraph) => `<p style="margin: 0 0 16px">${paragraph}</p>`).join("\n");
}

export function renderEmailHtml(options: {
  readonly subject: string;
  readonly bodyHtml: string;
}): string {
  const safeSubject = escapeHtml(options.subject);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeSubject}</title>
  </head>
  <body
    style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;"
  >
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td style="background-color: #0f172a; padding: 24px 32px;">
                <span style="color: #f8fafc; font-size: 20px; font-weight: 700; letter-spacing: 0.05em;">GUBERNATOR</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px; color: #1e293b; font-size: 15px; line-height: 1.6;">
                ${options.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background-color: #f8fafc; color: #94a3b8; font-size: 12px; line-height: 1.5; border-top: 1px solid #e2e8f0;">
                This is an automated message from Gubernator. If you did not expect this email, you can safely ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
