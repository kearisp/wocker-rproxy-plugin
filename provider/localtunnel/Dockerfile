FROM node:18-alpine

RUN apk update && \
    apk add --no-cache bash curl

WORKDIR /app

RUN npm install localtunnel

COPY index.js .

CMD ["node", "index.js"]
