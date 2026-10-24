FROM node:22-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY ui/package.json ui/
RUN pnpm install --frozen-lockfile
COPY erxes.json ./
COPY api api
RUN pnpm --filter classradar_api build

FROM base AS runtime
ENV NODE_ENV=production PORT=80
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY ui/package.json ui/
RUN pnpm install --frozen-lockfile --prod
COPY erxes.json ./
COPY --from=build /app/api/dist api/dist
ARG UI_ENTRY_URL
ENV UI_ENTRY_URL=$UI_ENTRY_URL
EXPOSE 80
CMD ["node", "api/dist/main.js"]
