FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY public ./public

RUN mkdir -p /app/data/uploads

ENV PORT=8787
ENV DATA_DIR=/app/data
EXPOSE 8787

CMD ["node", "server.js"]
