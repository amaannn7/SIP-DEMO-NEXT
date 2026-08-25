# syntax=docker/dockerfile:1

# --- deps: install dependencies (argon2 needs a native build toolchain) ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: type-check, lint, build the Next.js standalone bundle -------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- migrator: full node_modules (drizzle-kit, tsx, etc.) + source, used as
# a one-shot init container that runs `npm run db:migrate` before `app`
# starts. Also the image `seed:client` / `seed:demo` run in (see
# NEW-CLIENT-SETUP.md) — the minimal `runner` image below has neither
# devDependencies nor `src/`, so seeding must target this stage, not `app`.
FROM node:20-alpine AS migrator
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
CMD ["npm", "run", "db:migrate"]

# --- runner: minimal production image --------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
