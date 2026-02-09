# ---- Build stage ----
FROM node:16.10-alpine AS build
WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
# If you use npm:
# TODO: Check if --legacy-peer-deps is still needed after uprgrading angular and other deps. Remove if not.
RUN npm ci --legacy-peer-deps
# If you use pnpm/yarn, tell me and I’ll adapt.

# Copy source and build
COPY . .
# Typical Ionic build:
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine

# If your output is "www" (common for Ionic):
COPY --from=build /app/www /usr/share/nginx/html

# If your build output is "dist", replace the line above with:
# COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing (Angular/React/Vue): serve index.html for unknown routes
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
