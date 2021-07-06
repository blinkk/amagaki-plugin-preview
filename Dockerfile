FROM node:14
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --also=dev
COPY . ./
RUN npm run dev:start
CMD [ "node", "dist/bin/preview.js", "serve-proxy" ]
