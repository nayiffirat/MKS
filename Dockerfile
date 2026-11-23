FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json .npmrc* ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json .npmrc* ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
