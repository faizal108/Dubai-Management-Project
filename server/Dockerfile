FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy only package files first (optimize caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy entire app
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose API port
EXPOSE 4000

# Start app
CMD ["npm", "start"]
