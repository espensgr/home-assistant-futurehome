# Node 24 runs the TypeScript sources directly (type stripping), so there's no build step
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
EXPOSE 8787
CMD ["node", "src/node.ts"]
