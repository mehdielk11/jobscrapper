"""Email sending utilities for the Job Recommender platform.

Uses Supabase's built-in SMTP (via the Auth admin API) for sending emails,
avoiding the need for an external email provider like Resend.
Falls back to a simple log-based "send" when SMTP is not configured,
so development works without credentials.
"""

import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)


def _build_activation_html(first_name: str, activation_url: str) -> str:
    """Build a branded HTML email for account activation."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;">
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">JobFind Platform</h1>
  <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Academic Manager Account Activation</p>
</td></tr>

<!-- Body -->
<tr><td style="padding:40px;">
  <p style="margin:0 0 16px;color:#1e293b;font-size:16px;font-weight:600;">
    Hello {first_name},
  </p>
  <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">
    Your application for an Academic Manager account has been <strong style="color:#059669;">approved</strong>.
    Click the button below to set your password and activate your account.
  </p>

  <!-- CTA Button -->
  <table cellpadding="0" cellspacing="0" width="100%">
  <tr><td align="center" style="padding:8px 0 24px;">
    <a href="{activation_url}"
       style="display:inline-block;padding:16px 40px;background:#4f46e5;color:#ffffff;
              font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;
              box-shadow:0 4px 14px rgba(79,70,229,0.3);">
      Set Up My Account
    </a>
  </td></tr>
  </table>

  <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">
    This link expires in <strong>72 hours</strong> and can only be used once.
  </p>
  <p style="margin:0;color:#94a3b8;font-size:12px;">
    If the button doesn't work, copy this URL into your browser:
  </p>
  <p style="margin:4px 0 0;word-break:break-all;color:#6366f1;font-size:11px;">
    {activation_url}
  </p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
  <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">
    If you did not apply for this account, you can safely ignore this email.
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>"""


def send_activation_email(to_email: str, first_name: str, activation_url: str) -> bool:
    """Send the account activation email to an approved applicant.

    Uses SMTP credentials from environment variables. If not configured,
    logs the activation URL for development use.
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    from_email = os.getenv("SMTP_FROM", smtp_user or "noreply@jobfind.app")

    html_body = _build_activation_html(first_name, activation_url)

    # If SMTP is not configured, log the URL (dev mode)
    if not smtp_host or not smtp_user or not smtp_pass:
        logger.warning(
            "SMTP not configured. Activation URL for %s: %s",
            to_email, activation_url,
        )
        print(f"\n{'='*60}")
        print(f"[DEV] Activation email for: {to_email}")
        print(f"[DEV] URL: {activation_url}")
        print(f"{'='*60}\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Activate Your Academic Manager Account — JobFind"
        msg["From"] = from_email
        msg["To"] = to_email

        # Plain text fallback
        plain = (
            f"Hello {first_name},\n\n"
            f"Your Academic Manager application has been approved.\n"
            f"Set your password here (link expires in 72h):\n\n"
            f"{activation_url}\n\n"
            f"— JobFind Platform"
        )
        msg.attach(MIMEText(plain, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        logger.info("Activation email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send activation email to %s: %s", to_email, e)
        return False
