FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx nx build web --configuration=production

FROM nginx:alpine AS runtime
COPY --from=build /workspace/dist/apps/web/browser /usr/share/nginx/html
EXPOSE 80
