# ZAQ web widget: integration feasibility

Source: https://github.com/www-zaq-ai/web_widget/blob/main/docs/integration-guideline.md

Test script provided:

```html
<script src="https://3f64-185-83-86-177.ngrok-free.app/web_widget/assets/embed.js" data-widget-id="13" defer></script>
```

**Verdict:** feasible for a test. A clean production version changes several project decisions.

## What the documentation says

- `embed.js` creates its own `<iframe id="zaq-widget">`. Our current `ChatFrame` (iframe without `src` + `chat-frame.ts`) would no longer be used. The script injects the iframe into the page, so we would need to provide a container for it.
- Identity goes **only through a signed JWT (HS256)** produced by a backend. The JWT contains `user_id`, `widget_id`, `iss`, `aud`, `exp` (300 s max) and `jti`. The front end then calls `zaq.widget.init({ identity_token })`.
- There is no dedicated municipality-code parameter. It would go through the free-text `prompt_context` claim of the JWT.
- The widget needs a list of **allowed embedding origins** in their back office (Channels → Communication → Web Widget). We must add `http://localhost:4321`, the Vercel preview URL and the final domain.
- `getSettings()` / `updateSettings()` exist (theme `dark`, language `fr`).

## Conflicts with our decisions

1. **A backend is required.** The doc requires an endpoint that signs the JWT with a secret key. Our site is static and has no server logic, and the key cannot go in the front end. We would need a Vercel serverless function, which adds server code and contradicts "no adapter, static". Our random cookie `userID` also does not match their model of an authenticated user. To settle with the ZAQ contact: is there a mode without JWT, or JWTs issued for anonymous visitors?
2. **CSP.** The ZAQ host must be added to `script-src`, `frame-src` and `connect-src` (including `wss:` for the WebSocket). `img-src`, `style-src` and `font-src` will probably need it too. To verify during acceptance testing, since the doc does not list them.
3. **Cookies and storage.** The doc mentions `sessionStorage` (key `zaq-conversation-{id}`) to resume a conversation. Our rule forbids `localStorage`/`sessionStorage`. We need to know whether it is written in the chat's origin (inside the iframe, which is acceptable) or in our page.
4. **Third-party script.** The "no third-party scripts" rule no longer holds, since ZAQ's script runs in our page with access to its DOM. The trust placed in that code must be validated.
5. **ngrok URL.** It is temporary and only good for a test. A deployment needs a stable ZAQ URL. The `ngrok-free.app` host may also show an ngrok warning page.

## Quick local test

1. Ask the ZAQ contact to add `http://localhost:4321` to the allowed origins of widget 13.
2. Temporarily add the script in `BaseLayout.astro` (or `ChatFrame.astro`), with a container sized to fill the space between header and footer.
3. Widen the CSP in development (`vercel.json` does not apply to `pnpm dev`). Watch the console and Network tab for blocked requests.
4. Observe the behavior without `init()`. If the widget requires a token, the test stops there for lack of a backend.

## Questions for the ZAQ contact

- Can the widget be used without a JWT, or with anonymous visitors?
- Can the iframe size or position be controlled (full screen, embedded in a container)?
- Does the widget set cookies, or use storage in our origin?
- What are the stable URLs (production and preview)?
- How should the municipality code be passed? Via `prompt_context`, or another way?
