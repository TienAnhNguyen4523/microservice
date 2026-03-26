FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source code
COPY . .

# Start the service
CMD ["node", "index.js"]
