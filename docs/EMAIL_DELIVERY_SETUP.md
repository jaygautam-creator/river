# Production email delivery

River intentionally does not send recovery or security email until its sender identity is verified. A `vercel.app` URL is not an email domain and cannot be used as one.

## Required owner setup

1. Buy or use a domain you control (for example, `river.example`).
2. In Resend, add the bare domain — not the Vercel URL and not a trailing slash.
3. Add the exact SPF and DKIM DNS records Resend supplies, then wait for verification.
4. In Vercel production environment variables, add:

   ```text
   RESEND_API_KEY=re_...
   EMAIL_FROM=River <hello@your-domain>
   APP_ORIGIN=https://your-production-domain
   ```

5. Redeploy, request a password reset, and verify receipt plus link expiry from a test account.

## What River sends after configuration

- email verification links;
- password-reset links (30-minute expiry);
- a new-device sign-in notice.

Do not use an unverified sender, commit any Resend key, or put a real email address in test fixtures. The readiness endpoint reports `email_delivery: true` only when both Resend variables are present; it does not prove DNS delivery, which must be tested manually.
