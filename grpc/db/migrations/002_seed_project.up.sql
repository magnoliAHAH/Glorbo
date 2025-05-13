INSERT INTO projects (user_id, name)
VALUES (1, 'system')
ON CONFLICT DO NOTHING;
