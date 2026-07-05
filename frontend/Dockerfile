# ── Frontend Dockerfile ─────────────────────────────────────────────────────
# Stage 1: Build React/Vite bundle
FROM node:20-alpine AS build

WORKDIR /app

# Accept API URL as build-time arg (Vite bakes it into the bundle)
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Install dependencies (cached unless package*.json changes)
COPY package*.json ./
RUN npm ci --prefer-offline

# Build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:1.27-alpine AS production

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Non-root: nginx worker already runs as nginx user by default
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
