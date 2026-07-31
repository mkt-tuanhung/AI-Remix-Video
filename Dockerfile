# AI Remix Video — image chạy trên Railway/Render (Node always-on + ffmpeg-static).
FROM node:20-bookworm-slim AS base
WORKDIR /app

# --- deps (cài ĐẦY ĐỦ cả devDependencies để build được) ---
# LƯU Ý: KHÔNG đặt NODE_ENV=production ở đây, nếu không npm ci bỏ qua devDeps
# (typescript, @types/*) và `next build` sẽ fail.
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund \
  && node node_modules/ffmpeg-static/install.js || true

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime ---
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs

# Ổ đĩa bền sẽ được mount vào đây (Render disk / Railway volume).
RUN mkdir -p /app/persistent
EXPOSE 3000
CMD ["npm", "start"]
