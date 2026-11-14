# Stage 1: Build Vite frontend & prepare dependencies
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Lightweight production runtime
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.ts"]
