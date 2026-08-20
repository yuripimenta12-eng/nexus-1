FROM node:20-alpine

# Install build tools needed for native modules (argon2, sharp)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies including devDeps (needed for nest build)
RUN npm install

COPY . .

# Generate Prisma client and compile TypeScript
RUN npx prisma generate && npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
