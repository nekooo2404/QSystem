# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile --filter @qsystem/contracts... --filter @qsystem/ui... --filter web...

COPY packages/contracts ./packages/contracts
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

RUN pnpm --filter @qsystem/contracts build && pnpm --filter web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/ui ./packages/ui
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
USER node
EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "--port", "3000"]
