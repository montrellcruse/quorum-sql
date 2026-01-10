-- Minimal seed for Postgres-only quickstart
-- Default admin user with password: admin123
INSERT INTO auth.users (id, email, full_name, encrypted_password)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@example.com', 'Admin User', '$2b$12$ORSFfS.ngXlOm50wHTYd0eXZVD4zfIrMhopqHB5OYpW3YtiCFC9h6')
ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;
