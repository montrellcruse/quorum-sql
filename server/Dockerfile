FROM node:20-alpine AS build
WORKDIR /app

# Install deps
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# App source
COPY server ./server
COPY supabase ./supabase

RUN cd server && npm run build

FROM node:20-alpine AS runner
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/seed.sql ./server/seed.sql
COPY --from=build /app/supabase ./supabase

ENV PORT=8787
EXPOSE 8787

ENV APPLY_SEED=true
CMD ["sh", "-c", "node server/dist/migrate.js && if [ \"$APPLY_SEED\" = 'true' ]; then node server/dist/seed.js; fi && node server/dist/index.js"]
