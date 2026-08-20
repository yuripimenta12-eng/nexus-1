FROM node:20-slim

# Install build tools and OpenSSL (required for Prisma and native modules)
RUN apt-get update && apt-get install -y python3 make g++ openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies including devDeps (needed for nest build)
RUN npm install

COPY . .

# Generate Prisma client and compile TypeScript
# Verification step: build FAILS if dist/main.js not created
RUN npx prisma generate && npm run build && echo "=== BUILD OK ===" && ls -la /app/dist/ && ls -la /app/dist/main.js

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
