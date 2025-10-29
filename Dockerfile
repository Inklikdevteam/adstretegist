# Multi-stage build for AdStrategist - Latest Node.js LTS
FROM node:22-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
# Copy package files
COPY package*.json ./
# Install all dependencies for building
RUN npm ci --include=dev && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --include=dev

# Copy source code
COPY . .

# Set build environment
ENV NODE_ENV=production

# Build frontend and backend
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Create non-root user for security
RUN addgroup --system --gid 1001 adstrategist && \
    adduser --system --uid 1001 --ingroup adstrategist adstrategist

# Copy built application
COPY --from=builder --chown=adstrategist:adstrategist /app/dist ./dist
COPY --from=builder --chown=adstrategist:adstrategist /app/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy shared schemas and other necessary files
COPY --from=builder --chown=adstrategist:adstrategist /app/shared ./shared

# Create logs directory
RUN mkdir -p /app/logs && chown adstrategist:adstrategist /app/logs

# Switch to non-root user
USER adstrategist

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Expose port
EXPOSE 5000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]