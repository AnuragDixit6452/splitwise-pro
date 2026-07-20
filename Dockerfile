# Build frontend + install deps
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production: Express serves API + static dist
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/types.ts ./src/types.ts
EXPOSE 10000
CMD ["npx", "tsx", "server/index.ts"]
