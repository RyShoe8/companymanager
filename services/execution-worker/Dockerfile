FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY packages/ai-contracts ./packages/ai-contracts
COPY services/execution-worker ./services/execution-worker
RUN npm ci --ignore-scripts && npm run worker:build
USER node
ENV NODE_ENV=production PORT=8788
EXPOSE 8788
CMD ["node", "dist-worker/services/execution-worker/server.js"]
