FROM node:22-bookworm

WORKDIR /app

COPY package*.json ./

RUN npm ci || npm install

RUN npx playwright install --with-deps chromium

COPY . .

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
