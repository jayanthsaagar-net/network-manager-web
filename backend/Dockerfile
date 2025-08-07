FROM node:18-alpine

RUN apk add --no-cache dos2unix

WORKDIR /app

COPY package*.json ./
RUN dos2unix package*.json
RUN npm install

COPY . .
RUN dos2unix -R .

EXPOSE 5001

CMD ["npm", "start"]
