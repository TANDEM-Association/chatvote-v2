# Embedding the chat in an iframe — information for the chat team

This document summarizes what the ChatVote site expects from the chat application it embeds in an iframe, and the points we need to check together.

## Context

The new site is a **static shell** (Astro) made of an announcement bar, a header, a footer and, in between, a **full-width iframe** that displays the chat.

- The site and the chat will be on **two different domains**.
- V1: municipality **Saint-Saturnin, code `63396`**.
- The site **sets no cookies** and **calls no third-party services**.

## To set up on the chat side (blocking)

1. **Allow iframe embedding.**
   - Send `Content-Security-Policy: frame-ancestors <site domain>`.
   - Do not send `X-Frame-Options: DENY` or `SAMEORIGIN`.
   - Without this, the iframe stays empty.
   - Allow the production domain (not yet known) and at least one preview domain for testing. Vercel preview URLs change with every branch: a `*.vercel.app` wildcard would be too broad, so the list of allowed domains needs to be defined together.
2. **Serve the chat over HTTPS** (prerequisite for the cookies described below).

## Questions to clarify

| # | Question | Why it matters |
|---|---|---|
| 1 | **Which target application?** Production app (`app.chatvote.org`) or v2 (`chatvote-v2-…vercel.app`)? What is the final URL? | Determines the iframe URL and our site's CSP. |
| 2 | **Which URL parameter for the municipality code?** v1 uses `municipality_code`, v2 seems to use `commune`, and `municipalityCode` has also been mentioned. | Our site forwards this parameter under a configurable name. We need the exact name. |
| 3 | **Which other parameters are required?** The v2 example URL contains `institutionId` and `conseilView`. Are they mandatory? Does `institutionId` depend on the municipality? | Defines the allowlist of parameters forwarded to the iframe. Their role could not be verified on the site side. |
| 4 | **Does the chat set cookies or local storage?** Session, preferences, theme, analytics… (v1 offered "Se connecter"). | Affects behavior in a cross-domain iframe and how users are informed. |
| 5 | **Which browser features does the chat need?** Clipboard, microphone, etc. | Each one must be declared in the iframe's `allow` attribute, limited to what is strictly necessary. |

## Technical points to check together

- **Third-party cookies.** In an iframe on another domain, the chat's cookies are "third-party" cookies: blocked or restricted by Safari and Firefox. If there are any (session in particular), plan for `SameSite=None; Secure` and test on Safari/iOS. `localStorage` is also partitioned in this context.
- **Login inside the iframe.** If authentication goes through a redirect or an external window (OAuth, for example), these flows often behave poorly in an iframe. Worth testing early.
- **GDPR.** The site collects nothing, but any cookies or storage used by the chat fall under its own domain. Whether the chat needs to display information or request consent is to be discussed with the person in charge of legal matters.

## Desirable changes on the chat side

Nice-to-haves, not blocking:

- **Responsive at any iframe size**, with its own internal scrolling. On mobile, the iframe is roughly the screen height minus the announcement bar, header and footer. Watch out for the virtual keyboard.
- **Single dark theme.** The site has no light theme, whereas the chat offers a theme selector. Ideally: a parameter or an "embed mode" that forces the dark theme (navy background `#170742`).
- **Avoid duplicating the site's chrome.** v1 displayed its own logos, navigation links and a donation call ("Soutenez chatvote"), while the site's announcement bar already carries a "Soutenir" button. An embed mode that hides these elements would avoid the repetition.
- **External links**: open in a new tab (or `_top`), so that a third-party site is not loaded inside the iframe.

## Out of scope for V1

- Site ↔ chat communication via `postMessage` (syncing theme, URL or municipality). This would require agreeing on the allowed origins on both sides.
