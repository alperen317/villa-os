# syntax=docker/dockerfile:1

# --- build -------------------------------------------------------------------
# Debian-based rather than Alpine: bcrypt ships glibc prebuilds, so no
# python3/make/g++ toolchain is needed to install it.
FROM node:22-slim AS build
WORKDIR /workspace

# Dependency layer. apps/api is a workspace member and the root postinstall
# runs `prisma generate`, so its package.json and schema must both be in place
# before `npm ci` — otherwise the install fails.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci

COPY . .

# Regenerate against the full source tree, then build and prune. `prune`
# emits a self-contained runtime package under apps/api/dist: main.js plus a
# package.json/package-lock.json narrowed to the API's runtime dependencies.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npx nx run @villa-os/api:prune

# --- runtime -----------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The Prisma schema engine used by `migrate deploy` probes for libssl and warns
# (then guesses) when it is absent from the slim base image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Install from the pruned manifest so the image carries only runtime deps.
# `npm install` rather than `npm ci`: the lockfile @nx/js:prune-lockfile emits
# is incomplete (it drops transitive @types entries), and `npm ci` rejects any
# lockfile that does not match the manifest exactly. `npm install` still honours
# the pinned versions present in the pruned lock and reconciles the rest.
COPY --from=build /workspace/apps/api/dist/package.json ./
COPY --from=build /workspace/apps/api/dist/package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=build /workspace/apps/api/dist/main.js ./
COPY --from=build /workspace/apps/api/prisma ./prisma
COPY docker/prisma.config.js ./prisma.config.js

# UPLOADS_ROOT resolves to <cwd>/uploads. Creating it here as `node` means the
# named volume compose mounts over it inherits non-root ownership.
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 3000

# Migrations are applied on boot; compose gates this on postgres being healthy.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node main.js"]
