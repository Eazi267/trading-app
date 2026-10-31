// Starter text for the public legal pages. Shown until an admin writes their own
// (Admin > Business Settings). It is a general template, NOT legal advice: a lawyer
// who knows your country and business should review it before you rely on it.
export function defaultLegalHtml(kind, brandName = 'Our platform', address = '') {
  const b = brandName
  const contact = address ? `<p>Contact: ${address}</p>` : '<p>Contact us through the Support page after you sign in.</p>'
  if (kind === 'terms') {
    return `
<p>These terms govern your use of ${b}. By creating an account you agree to them. If you do not agree, please do not use the service.</p>
<h2>1. Who can use ${b}</h2>
<p>You must be at least 18 years old (or the age of majority where you live) and able to enter a binding agreement. You must give accurate information and keep it up to date.</p>
<h2>2. Your account</h2>
<p>You are responsible for keeping your password and any confirmation codes private, and for activity on your account. Tell us straight away if you suspect someone else has access. We may ask you to verify your identity and email address before some actions.</p>
<h2>3. What the service is</h2>
<p>${b} lets you fund an account, request withdrawals and take part in managed investment sessions overseen by an account manager. Every deposit, withdrawal and result is recorded and reviewed. Some figures, prices or accounts may be simulated or for demonstration; where that is the case it is labelled.</p>
<h2>4. Deposits and withdrawals</h2>
<p>Requests are reviewed before they affect your balance. We may delay, refuse or reverse a request where needed to meet legal obligations, prevent fraud, or correct an error. Withdrawals go to the wallet or account you have registered.</p>
<h2>5. Risk</h2>
<p>Investing involves risk, including the loss of the money you commit. Past results do not guarantee future results. Nothing on ${b} is personal investment, tax or legal advice. Only commit money you can afford to lose.</p>
<h2>6. Fees</h2>
<p>Any fees that apply are shown in your account before you are charged. We will tell you before they change.</p>
<h2>7. Acceptable use</h2>
<p>Do not use ${b} for unlawful activity, money laundering, to attack or disrupt the service, to open accounts under false identities, or to abuse promotions or referral schemes.</p>
<h2>8. Suspension and closing accounts</h2>
<p>We may suspend or close an account that breaks these terms or the law. You may ask us to close your account at any time, subject to settling any pending requests.</p>
<h2>9. Liability</h2>
<p>To the extent the law allows, ${b} is not liable for indirect or consequential losses, or for events outside our reasonable control. Nothing here limits rights you have under the law that cannot be limited.</p>
<h2>10. Changes</h2>
<p>We may update these terms. When changes are important we will tell you; continuing to use the service afterwards means you accept them.</p>
${contact}`
  }
  if (kind === 'cookies') {
    return `
<p>This page explains the cookies and similar browser storage ${b} uses, and the choices you have.</p>
<h2>Essential (always on)</h2>
<ul>
<li><strong>Sign-in session</strong>: a secure cookie that keeps you signed in and protects your account. The site cannot work without it.</li>
<li><strong>Security and site operation</strong>: small items that remember your cookie choice and keep pages working.</li>
</ul>
<h2>Preferences (your choice)</h2>
<ul>
<li>Your chosen theme (light or dark) and colours.</li>
<li>Your favourite pages in the phone menu and your starred markets.</li>
</ul>
<p>If you decline, the site still works; these choices are simply not remembered after you close the tab.</p>
<h2>Analytics and advertising</h2>
<p>${b} does not currently use analytics or advertising cookies. If that changes, we will ask for your permission first.</p>
<h2>Changing your mind</h2>
<p>Use "Cookie settings" in the footer to change your choice at any time. You can also clear cookies and site data in your browser settings.</p>
${contact}`
  }
  return `
<p>This policy explains what personal information ${b} collects, why, and the choices you have.</p>
<h2>Information we collect</h2>
<ul>
<li><strong>Account details</strong>: name, email address, country and a securely stored (hashed) password.</li>
<li><strong>Identity verification</strong>: documents and images you submit when verification is required. These are stored encrypted.</li>
<li><strong>Financial activity</strong>: your deposits, withdrawals, wallet details, investment sessions and balances.</li>
<li><strong>Support and messages</strong>: what you send to us and what we send to you.</li>
<li><strong>Technical data</strong>: sign-in times and security logs used to protect accounts.</li>
</ul>
<h2>How we use it</h2>
<ul>
<li>To run your account and process your requests</li>
<li>To verify your identity and prevent fraud or abuse</li>
<li>To send account emails, such as verification and confirmation codes, and notices about requests</li>
<li>To meet legal and regulatory obligations</li>
<li>To keep an audit record of changes made to accounts</li>
</ul>
<h2>Who we share it with</h2>
<p>We do not sell your information. We share it only with service providers that help us run the platform (for example email delivery and hosting), when the law requires it, or to protect the platform and its users.</p>
<h2>How long we keep it</h2>
<p>We keep information while your account is open and for as long as needed afterwards for legal, security and accounting reasons.</p>
<h2>Security</h2>
<p>We use encryption in transit, hashed passwords, optional two-factor login for staff, and confirmation codes for sensitive actions. No system is perfectly secure, so please use a strong, unique password.</p>
<h2>Your choices and rights</h2>
<p>You can ask to see, correct or delete your information, subject to our legal duties to keep some records. Depending on where you live you may have further rights under local data protection law.</p>
<h2>Cookies</h2>
<p>See our Cookie Policy for the cookies and browser storage we use and how to control them.</p>
<h2>Changes</h2>
<p>We may update this policy and will tell you about important changes.</p>
${contact}`
}
