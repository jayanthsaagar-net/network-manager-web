# Stage 1: Build the React application
FROM node:18-alpine as build

RUN apk add --no-cache dos2unix

WORKDIR /app

COPY package*.json ./
RUN dos2unix package*.json
RUN npm install

COPY . .
RUN dos2unix -R .
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
