FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Vite frontend
RUN npm run build

# Expose the port the Express server runs on
EXPOSE 3001

# Start the Node backend (which serves the frontend + API)
CMD ["node", "server/index.js"]
