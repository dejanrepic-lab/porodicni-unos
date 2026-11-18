FROM debian:bookworm-slim AS icon-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends librsvg2-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /icons
# App icons are full-bleed, without transparency (iOS paints it black) or a tile of their own; the phone gives the shape.
# porodicni-unos-full.svg is the same file as in dejanrepic-lab/app-icons (ZimaOS, Homarr). The Android maskable
# icon scales the logo into the safe zone, because Android shows only the middle of a maskable icon.
COPY public/icons/porodicni-unos-full.svg public/icons/porodicni-unos-maskable.svg ./
RUN rsvg-convert -w 192 -h 192 porodicni-unos-full.svg -o icon-192.png \
    && rsvg-convert -w 512 -h 512 porodicni-unos-full.svg -o icon-512.png \
    && rsvg-convert -w 512 -h 512 porodicni-unos-maskable.svg -o icon-maskable-512.png \
    && rsvg-convert -w 180 -h 180 porodicni-unos-full.svg -o apple-touch-icon.png

FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts
COPY --from=icon-builder /icons/icon-192.png ./public/icons/icon-192.png
COPY --from=icon-builder /icons/icon-512.png ./public/icons/icon-512.png
COPY --from=icon-builder /icons/icon-maskable-512.png ./public/icons/icon-maskable-512.png
COPY --from=icon-builder /icons/apple-touch-icon.png ./public/icons/apple-touch-icon.png

RUN mkdir -p /app/data/uploads

ENV PORT=8787
ENV DATA_DIR=/app/data
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '8787') + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "scripts/start.js"]
