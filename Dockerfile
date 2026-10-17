# Moss & Moon: production image (works on Railway, Render, Fly.io, any VPS)
FROM node:26-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    TZ=Asia/Kolkata \
    PORT=3000
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public* ./public/
COPY --from=build /app/next.config.ts ./
# The /data folder is a persistent disk (a Railway Volume, or docker run -v)
RUN mkdir -p /data
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
