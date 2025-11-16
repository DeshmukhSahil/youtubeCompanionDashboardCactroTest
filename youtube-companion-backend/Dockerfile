# Use official Node.js base image for Node.js backend
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port for the Node.js app
EXPOSE 7000

# Start the backend server
CMD ["node", "server.js"]
