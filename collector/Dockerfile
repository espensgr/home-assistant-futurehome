# Bundle the app into one file, so the runtime image only needs Bun itself
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
RUN bun build src/server.ts --target=bun --minify --outfile=dist/server.js

FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=build /app/dist/server.js ./
USER bun
EXPOSE 8787
CMD ["bun", "server.js"]
