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

CMD ["sh", "-c", "node src/migrate.js && node src/index.js"]
