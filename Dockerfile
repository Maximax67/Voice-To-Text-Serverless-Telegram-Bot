# ==========================================
# Stage 1: Build the application
# ==========================================
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./

RUN npm ci || npm install

COPY . .
RUN npm run build

# ==========================================
# Stage 2: Production environment
# ==========================================
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/public ./public

CMD ["node", "public/index.js"]
