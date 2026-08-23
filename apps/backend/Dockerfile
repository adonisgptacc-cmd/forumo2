# Base image
# pnpm 11 (see root package.json "packageManager") requires Node >=22.13 —
# it uses the node:sqlite built-in, unavailable before Node 22.5.
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage
FROM base AS builder
WORKDIR /app

# Set dummy DATABASE_URL for Prisma
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Copy everything
COPY . .

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build packages in order
RUN pnpm --filter @forumo/shared build
RUN pnpm --filter backend prisma:generate
RUN pnpm --filter backend build

# Production stage
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

# Copy built app from builder
COPY --from=builder --chown=appuser:nodejs /app ./

ENV NODE_ENV=production
EXPOSE 4000

# Make entrypoint executable and switch to non-root user
RUN chmod +x /app/apps/backend/entrypoint.sh
USER appuser

ENTRYPOINT ["/app/apps/backend/entrypoint.sh"]
CMD ["pnpm", "--filter", "backend", "start"]
