FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npx nx build @villa-os/api --configuration=production

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/dist/apps/api ./
COPY --from=build /workspace/apps/api/prisma ./prisma
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "main.js"]
