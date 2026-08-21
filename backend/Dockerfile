# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files to leverage Docker layer caching
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies for nest build)
RUN pnpm i --frozen-lockfile

# Copy source code and build NestJS TypeScript into production JavaScript
COPY . .
RUN pnpm run build

# Stage 2: Run the production application
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Secure container by creating a non-root system user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Enable pnpm for production install
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package definitions and install ONLY production dependencies (prunes devDependencies)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm i --prod --frozen-lockfile

# Copy the built production code from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Run under secure non-root user
USER nestjs

EXPOSE 4000

CMD ["node", "dist/main.js"]
