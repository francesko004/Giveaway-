# syntax=docker/dockerfile:1.7
# ── deps ───────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

# ── build ──────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN npx prisma generate && npx next build

# ── migrate (one-shot job: prisma migrate deploy, seed, admin creation) ──
FROM build AS migrate
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# ── runtime ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/storage/uploads
RUN groupadd --system --gid 1001 app && useradd --system --uid 1001 --gid app app \
 && mkdir -p /app/storage/uploads && chown -R app:app /app/storage
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
