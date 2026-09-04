FROM debian:bookworm-slim AS icon-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends librsvg2-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /icons
COPY public/icons/porodicni-unos.svg ./porodicni-unos.svg
RUN rsvg-convert -w 192 -h 192 porodicni-unos.svg -o icon-192.png \
    && rsvg-convert -w 512 -h 512 porodicni-unos.svg -o icon-512.png \
    && rsvg-convert -w 180 -h 180 porodicni-unos.svg -o apple-touch-icon.png

FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY public ./public
COPY scripts ./scripts
COPY --from=icon-builder /icons/icon-192.png ./public/icons/icon-192.png
COPY --from=icon-builder /icons/icon-512.png ./public/icons/icon-512.png
COPY --from=icon-builder /icons/apple-touch-icon.png ./public/icons/apple-touch-icon.png
RUN node scripts/prepare-pwa.js

RUN mkdir -p /app/data/uploads

ENV PORT=8787
ENV DATA_DIR=/app/data
EXPOSE 8787

CMD ["node", "server.js"]
