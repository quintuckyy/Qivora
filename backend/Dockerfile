# syntax=docker/dockerfile:1

##
## deps: install full dependency tree (dev deps included, needed to build and to run
## `prisma migrate deploy` at container startup).
##
FROM node:24-alpine AS deps
WORKDIR /app

# argon2 ships prebuilt native bindings for most platforms, but falls back to
# compiling from source on musl/alpine when no prebuilt binary matches.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

##
## build: generate the Prisma client and compile TypeScript.
##
FROM node:24-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json tsconfig.build.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

##
## runtime: minimal image with only the compiled output, production node_modules,
## and what's needed to run migrations on startup.
##
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json prisma.config.ts docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh \
  && mkdir -p uploads/resumes \
  && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
