INSERT INTO apps (id, name, secret, project_id)
VALUES (1, 'test', 'test-secret', 1)
ON CONFLICT DO NOTHING;
