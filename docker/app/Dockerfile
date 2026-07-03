# Build context is the repo root: docker compose build resolves
# context ".." with dockerfile "docker/app/Dockerfile".

FROM node:22-alpine AS build
WORKDIR /app

# Skip husky git-hook install inside the image (no .git in build context)
ENV HUSKY=0

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time — the compose file passes
# SUPABASE_PUBLIC_URL and ANON_KEY from .env.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}

RUN npm run build

FROM nginx:1.27-alpine
ARG VITE_SUPABASE_URL
COPY docker/app/nginx.conf /etc/nginx/conf.d/default.conf
# Bake the Supabase origin into the CSP connect-src (http->ws for Realtime)
RUN WS_URL=$(printf '%s' "$VITE_SUPABASE_URL" | sed 's~^http~ws~') && \
    sed -i \
      -e "s~__SUPABASE_URL__~${VITE_SUPABASE_URL}~g" \
      -e "s~__SUPABASE_WS_URL__~${WS_URL}~g" \
      /etc/nginx/conf.d/default.conf && \
    nginx -t
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
