# Base image
FROM node:25-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage
FROM base AS builder
WORKDIR /app

# Copy everything
COPY . .

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build packages in order
RUN pnpm --filter @forumo/shared build
RUN pnpm --filter @forumo/design-system build || true
RUN pnpm --filter web build

# Production stage
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home appuser

# Copy built app from builder
COPY --from=builder --chown=appuser:nodejs /app ./

ENV NODE_ENV=production
EXPOSE 3000

USER appuser
CMD ["pnpm", "--filter", "web", "start"]
