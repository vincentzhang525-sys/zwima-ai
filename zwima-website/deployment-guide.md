# Zwima AI Deployment Guide

This guide deploys the static Zwima AI website for the message: **AI Workforce for European SMEs**.

## Files To Deploy
Upload these files from `zwima-website/`:

- `index.html`
- `pricing.html`
- `about.html`
- `contact.html`
- `impressum.html`
- `privacy.html`
- `terms.html`
- `styles.css`
- `script.js`
- `launch-checklist.md`
- `deployment-guide.md`

The public website does not require a backend, payment integration, or login system.

## IONOS Deployment Steps
1. Log in to the IONOS account that manages the hosting package.
2. Open **Hosting** or **Webspace** for the target domain.
3. Open **WebspaceExplorer** or connect by SFTP/FTP.
4. Go to the document root for `zwima-group.online`.
5. Upload all website files from `zwima-website/`.
6. Ensure `index.html` is placed in the root folder for the domain.
7. Confirm `styles.css` and `script.js` are in the same folder as `index.html`.
8. Open `https://zwima-group.online/` and confirm the homepage loads.
9. Open each page directly:
   - `https://zwima-group.online/pricing.html`
   - `https://zwima-group.online/about.html`
   - `https://zwima-group.online/contact.html`
   - `https://zwima-group.online/impressum.html`
   - `https://zwima-group.online/privacy.html`
   - `https://zwima-group.online/terms.html`

## Domain Configuration
Primary AI platform domain:

- `zwima-group.online`

Related domains:

- `zwima-group.com` for corporate website
- `zwima-tech.de` for the German market

Recommended configuration:

1. Point `zwima-group.online` to the IONOS webspace.
2. Add or verify the `www` subdomain if used.
3. Decide whether `www.zwima-group.online` redirects to `zwima-group.online` or the other way around.
4. Keep `zwima-group.com` and `zwima-tech.de` either as separate websites or redirects, depending on the business decision.
5. Confirm footer links match the final domain strategy.

## DNS Verification
1. In IONOS DNS settings, verify the domain points to the active webspace.
2. Confirm the required A, AAAA, or CNAME records match IONOS instructions.
3. Check DNS propagation with an external DNS checker.
4. Confirm both root and `www` hostnames resolve correctly if both are used.
5. Confirm there are no conflicting old records from previous hosting.

## SSL Verification
1. Enable IONOS SSL certificate for `zwima-group.online`.
2. Include `www.zwima-group.online` if the `www` hostname is active.
3. Wait until the certificate status is active.
4. Open `https://zwima-group.online/` and confirm there is no browser warning.
5. Test `http://zwima-group.online/` and confirm it redirects to HTTPS.
6. Confirm every internal page loads over HTTPS.

## GDPR Verification
Before launch, verify the legal pages against the real operating setup:

1. Confirm hosting provider details and server-log retention.
2. Confirm whether analytics, tracking, cookies, fonts, CDNs, form providers, or chat widgets are used.
3. Confirm actual AI infrastructure providers and data transfer locations.
4. Confirm all processors have appropriate data processing agreements.
5. Confirm the statement "Customer data is not used by Zwima AI to train AI models" is technically and contractually accurate.
6. Confirm the data minimization wording reflects actual product behavior.
7. Confirm legal details in `impressum.html`, including managing director, register court, registration number, and VAT ID if legally required.

## Cookie Notice Verification
Current website status:

- Static website
- No login system
- No payment system
- No external backend
- No intentional non-essential cookies in the current files

Before launch:

1. Confirm the deployed hosting does not inject analytics or tracking scripts.
2. Confirm no third-party widgets are added after upload.
3. If analytics, ads, tracking pixels, embedded videos, chat widgets, or non-essential cookies are added, implement a GDPR-compliant cookie consent banner before launch.
4. If no non-essential cookies are used, keep the legal cookie notice accurate.

## Contact Form Verification
The contact form uses `mailto:info@zwima-group.com`.

Test steps:

1. Open `contact.html` in a browser.
2. Enter Name, Company, Email, and Message.
3. Click **Send Message**.
4. Confirm the local email client opens.
5. Confirm the recipient is `info@zwima-group.com`.
6. Confirm the subject is `Zwima AI free demo request`.
7. Confirm all form fields appear in the email body.

Recommendation:

- For serious paid traffic, replace `mailto:` with a privacy-compliant hosted form or backend endpoint with spam protection, logging rules, and GDPR documentation.

## Post-Deployment Smoke Test
1. Open the homepage on desktop.
2. Open the homepage on mobile.
3. Test the mobile menu.
4. Click every header link.
5. Click every footer legal link.
6. Click every CTA.
7. Check browser console for 404 errors.
8. Confirm no search-engine blocking meta tag exists.
9. Confirm the visible homepage message is **AI Workforce for European SMEs**.
