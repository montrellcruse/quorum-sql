#!/bin/bash
set -e

echo "==================================="
echo "Quorum - Docker Setup"
echo "==================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for .env file
if [ ! -f .env ]; then
  echo -e "${RED}ERROR: .env file not found!${NC}"
  echo
  echo "Please complete the setup wizard first:"
  echo "  1. Run: npm run dev"
  echo "  2. Open: http://localhost:5173/setup"
  echo "  3. Download the .env file and save it to the project root"
  echo
  exit 1
fi

echo -e "${GREEN}Found .env file${NC}"

# Source .env for validation (handles export and non-export formats)
set -a
source .env
set +a

# Validate required variables
missing_vars=0

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo -e "${RED}ERROR: POSTGRES_PASSWORD not set in .env${NC}"
  missing_vars=1
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL not set in .env${NC}"
  missing_vars=1
fi

if [ -z "$POSTGRES_DB" ]; then
  echo -e "${YELLOW}WARNING: POSTGRES_DB not set, using default 'postgres'${NC}"
fi

if [ "$missing_vars" -eq 1 ]; then
  echo
  echo "Please ensure your .env file contains all required variables."
  exit 1
fi

echo -e "${GREEN}Environment variables validated${NC}"
echo

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Docker is not running${NC}"
  echo "Please start Docker Desktop and try again."
  exit 1
fi

echo -e "${GREEN}Docker is running${NC}"
echo

# Check if containers already exist
if docker compose ps --quiet 2>/dev/null | grep -q .; then
  echo -e "${YELLOW}Existing containers detected${NC}"
  read -p "Restart containers? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping existing containers..."
    docker compose down
  else
    echo "Keeping existing containers."
    echo
    echo "Run 'docker compose logs -f' to view logs."
    exit 0
  fi
fi

echo "Starting Docker containers..."
docker compose up -d --build

echo
echo "Waiting for database to be ready..."
attempt=1
max_attempts=30

while [ $attempt -le $max_attempts ]; do
  if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}Database is ready!${NC}"
    break
  fi
  echo -n "."
  sleep 2
  attempt=$((attempt + 1))
done

if [ $attempt -gt $max_attempts ]; then
  echo -e "${RED}ERROR: Database failed to start${NC}"
  echo "Check logs with: docker compose logs db"
  exit 1
fi

echo
echo "Checking server startup..."
sleep 3

# Check if server is responding
if curl -s http://localhost:8787/health > /dev/null 2>&1; then
  echo -e "${GREEN}Server is running!${NC}"
else
  echo -e "${YELLOW}Server may still be starting...${NC}"
  echo "Check logs with: docker compose logs server"
fi

echo
echo "==================================="
echo -e "${GREEN}Setup complete!${NC}"
echo "==================================="
echo
echo "Services running:"
echo "  - PostgreSQL:  localhost:5432"
echo "  - REST API:    localhost:8787"
echo "  - DB Admin:    localhost:8080 (Adminer)"
echo
echo "Next steps:"
echo "  1. Run: npm run dev"
echo "  2. Open: http://localhost:5173"
echo "  3. Sign in with: admin@example.com"
echo
echo "Useful commands:"
echo "  - View logs:    docker compose logs -f"
echo "  - Stop:         docker compose down"
echo "  - Reset data:   docker compose down -v"
echo
