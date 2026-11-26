# syntax=docker/dockerfile:1
# Image du front (Astro, adapter Node standalone). Caddy tourne dans un conteneur à part du même pod (deploy/app.yaml).
# Image Debian (glibc) et non Alpine : le moteur Markdown `satteri` est un module natif.
# Build : docker build --platform linux/amd64 ... (les nœuds Scaleway sont en x86).

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Variables PUBLIC_* : figées dans les pages au moment du build (à passer avec --build-arg).
# PUBLIC_ZAQ_WIDGET_ID est obligatoire (le build échoue sans).
ARG PUBLIC_ZAQ_URL
ARG PUBLIC_ZAQ_PATH_PREFIX=""
ARG PUBLIC_ZAQ_WIDGET_ID
ARG PUBLIC_MATOMO_URL=""
ARG PUBLIC_MATOMO_SITE_ID=""
ARG PUBLIC_USER_ID_COOKIE_MAX_AGE=31536000
ARG PUBLIC_DONATE_URL=""
ARG PUBLIC_LOGO_HREF=""
ARG PUBLIC_LOGO_TANDEM_HREF=""
ARG PUBLIC_MORE_URL=""
ARG PV_BASE_URL=""
ENV PUBLIC_ZAQ_URL=$PUBLIC_ZAQ_URL \
    PUBLIC_ZAQ_PATH_PREFIX=$PUBLIC_ZAQ_PATH_PREFIX \
    PUBLIC_ZAQ_WIDGET_ID=$PUBLIC_ZAQ_WIDGET_ID \
    PUBLIC_MATOMO_URL=$PUBLIC_MATOMO_URL \
    PUBLIC_MATOMO_SITE_ID=$PUBLIC_MATOMO_SITE_ID \
    PUBLIC_USER_ID_COOKIE_MAX_AGE=$PUBLIC_USER_ID_COOKIE_MAX_AGE \
    PUBLIC_DONATE_URL=$PUBLIC_DONATE_URL \
    PUBLIC_LOGO_HREF=$PUBLIC_LOGO_HREF \
    PUBLIC_LOGO_TANDEM_HREF=$PUBLIC_LOGO_TANDEM_HREF \
    PUBLIC_MORE_URL=$PUBLIC_MORE_URL \
    PV_BASE_URL=$PV_BASE_URL
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 4321
# Secrets d'exécution (ZAQ_SIGNING_KEY, ZAQ_ISSUER, ZAQ_AUDIENCE, PV_BASE_URL) : fournis par le pod, pas par l'image.
CMD ["node", "./dist/server/entry.mjs"]
