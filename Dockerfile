FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies and required build tools
RUN apk add --no-cache python3 make g++ \
    && npm install --legacy-peer-deps \
    && npm install @next/swc-linux-x64-musl

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Clean up build dependencies
RUN apk del python3 make g++

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 