# IONOS Upload Guide for Zwima AI

Follow these steps to upload the `zwima-production` folder to IONOS Webspace and connect `zwima-group.online`.

1. Sign in to your IONOS account.
2. Open **Hosting** or **Webspace** for the contract that should host `zwima-group.online`.
3. Open **Webspace Explorer** or connect with FTP/SFTP using the credentials from IONOS.
4. In Webspace Explorer or your FTP client, open the website root area for the domain.
5. Upload the contents of `zwima-production`, not the folder itself, unless you plan to set the domain root folder to `/zwima-production`.
6. Make sure these files are present in the target folder: `index.html`, `pricing.html`, `about.html`, `contact.html`, `impressum.html`, `privacy.html`, `terms.html`, `styles.css`, and `script.js`.
7. In IONOS, go to **Domains & SSL**.
8. Select `zwima-group.online`.
9. Open the domain destination or root folder settings.
10. Point the domain to the folder that contains `index.html`.
11. Save the domain root folder setting and wait for IONOS to apply the change.
12. In **Domains & SSL**, activate SSL for `zwima-group.online`.
13. Wait until the SSL certificate is active.
14. Open `https://zwima-group.online` in a browser.
15. Confirm the homepage loads and shows `AI Workforce for European SMEs`.
16. Test the main navigation links: Home, Use Cases, Pricing, About, Contact, and Book Free Demo.
17. Test the footer legal links: Impressum, Privacy Policy, and Terms of Service.
18. Test the contact page and confirm the email address is `info@zwima-group.com`.
19. If the old website still appears, clear the browser cache and wait a few minutes for IONOS changes to propagate.
