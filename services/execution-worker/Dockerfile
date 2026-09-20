FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN groupadd --gid 10001 sandbox && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin sandbox
COPY package.json package-lock.json tsconfig.json ./
COPY packages/ai-contracts ./packages/ai-contracts
COPY services/execution-worker ./services/execution-worker
RUN npm ci --ignore-scripts && npm run worker:build
# The controller retains only enough privilege to launch repository commands as
# uid 10001. Model-controlled code never runs as this controller user.
USER root
ENV NODE_ENV=production PORT=8788
EXPOSE 8788
CMD ["node", "dist-worker/services/execution-worker/server.js"]
