-- Minimal seed for Postgres-only quickstart
INSERT INTO auth.users (id, email, full_name)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@example.com', 'Admin User')
ON CONFLICT (id) DO NOTHING;
