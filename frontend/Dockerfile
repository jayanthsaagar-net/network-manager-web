# Stage 1: Build the React application
FROM node:18-alpine as build

# Install dos2unix to fix potential line ending issues on Windows
RUN apk add --no-cache dos2unix

WORKDIR /app

# Copy package files and convert them first
COPY package*.json ./
RUN dos2unix package*.json

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Convert all remaining text files to Unix line endings
RUN find . -type f -print0 | xargs -0 dos2unix

# Now, build the application
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:stable-alpine

# Copy the built assets from the 'build' stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
