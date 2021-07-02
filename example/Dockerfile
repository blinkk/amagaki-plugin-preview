FROM node:14
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --also=dev
COPY . ./
RUN npm run build:src
CMD [ "npx", "amagaki", "serve" ]
