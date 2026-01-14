FROM node:20-alpine
WORKDIR /app

# Install deps
COPY server/package.json ./package.json
RUN npm install --omit=dev

# App source
COPY server/src ./src
COPY server/migrations ./migrations
COPY server/seed.sql ./seed.sql

# Include supabase migrations for compatibility
COPY supabase ./supabase

ENV PORT=8787
EXPOSE 8787

ENV APPLY_SEED=true
CMD ["sh", "-c", "node src/migrate.js && if [ \"$APPLY_SEED\" = 'true' ]; then node src/seed.js; fi && node src/index.js"]
