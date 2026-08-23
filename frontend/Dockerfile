# syntax=docker/dockerfile:1

##
## build: compile the SPA. VITE_API_BASE_URL is baked in at build time (Vite env
## vars are resolved when the bundle is built, not when the container starts) —
## it must point at a URL the *browser* can reach, not a Docker-internal hostname.
##
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

##
## runtime: serve the static build with nginx.
##
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
