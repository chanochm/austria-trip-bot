FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Persistent volume for future state (e.g. weather-watch change detection)
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
