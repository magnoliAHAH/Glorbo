INSERT INTO projects (id, user_id, name)
VALUES (1, 1, 'system')
ON CONFLICT DO NOTHING;
