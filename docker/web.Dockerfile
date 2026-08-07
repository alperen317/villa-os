# syntax=docker/dockerfile:1

# --- build -------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /workspace

# The root postinstall runs `prisma generate`, so the API workspace manifest
# and schema are needed even for a web-only build.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci

COPY . .
RUN npx nx build web --configuration=production

# --- runtime -----------------------------------------------------------------
FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# @angular/build:application nests the browser bundle under browser/.
COPY --from=build /workspace/dist/apps/web/browser /usr/share/nginx/html

EXPOSE 80
