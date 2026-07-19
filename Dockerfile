# Flow Circle (community-currency) frontend — built with vinext (Vite + Next on
# a worker runtime) and served by `vinext start`. It talks to loop-backend at
# runtime; there is no database binding to provide.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
# Bring the whole built project (incl. node_modules) so `vinext start` can run.
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "exec", "vinext", "start", "--port", "3000"]
