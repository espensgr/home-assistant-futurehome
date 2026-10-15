# Multi-stage: install deps with npm, then run on bare Alpine with only the node binary (no npm/yarn)
# Node runs the TypeScript sources directly (type stripping), so there's no build step
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM alpine:3
RUN apk add --no-cache libstdc++ libgcc
COPY --from=deps /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER nobody
EXPOSE 8787
CMD ["node", "src/server.ts"]
