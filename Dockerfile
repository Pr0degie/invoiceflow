# Multi-stage build for the standalone Next.js server (next.config.ts sets
# output: "standalone"). Runtime image contains only the traced server bundle
# and static assets, runs as non-root on :3000.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# server.js + traced node_modules; static assets are served by the same server
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Required runtime env (see ../invoice-api/docs/deploy.md):
#   AUTH_SECRET       — NextAuth session-JWT key
#   API_BASE_URL      — backend URL for the server-side proxy/client
#   NEXTAUTH_URL      — public URL of this app
CMD ["node", "server.js"]
