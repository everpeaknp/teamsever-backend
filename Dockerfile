# Use a lightweight Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (only production if needed, but build needs devDeps)
RUN npm install

# Copy all source files
COPY . .

# Build the TypeScript project
RUN npm run build

# Expose the backend port
EXPOSE 5000

# Start the server
CMD ["npm", "start"]
