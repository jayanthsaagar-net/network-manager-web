# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Install dos2unix to fix potential line ending issues on Windows
RUN apk add --no-cache dos2unix

# Set the working directory in the container
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

# Make port 5001 available to the world outside this container
EXPOSE 5001

# Define the command to run your app
CMD ["npm", "start"]
