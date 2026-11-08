FROM node:22-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json shared/
COPY web/package.json web/
RUN npm ci -w shared -w web --no-audit --no-fund 2>/dev/null || npm install -w shared -w web --no-audit --no-fund
COPY shared/ shared/
COPY web/ web/
RUN npm run build -w shared && npm run build -w web

FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm ci -w shared -w server --no-audit --no-fund 2>/dev/null || npm install -w shared -w server --no-audit --no-fund
COPY shared/ shared/
COPY server/ server/
RUN npm run build -w shared && npm run build -w server
RUN npm prune -w shared -w server --omit=dev --no-audit --no-fund 2>/dev/null || true
COPY --from=web-build /app/web/dist /app/server/public
ENV NODE_ENV=production PORT=10000
EXPOSE 10000
CMD ["sh", "-c", "node server/dist/migrate.js && node server/dist/seed.js && node server/dist/index.js"]
