# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Uploaded gallery images live here — mount a volume in production so they
# survive container restarts/redeploys (see DEPLOYMENT.md for the S3 upgrade path).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 5000
USER node
CMD ["node", "dist/index.js"]
