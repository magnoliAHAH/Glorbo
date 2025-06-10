CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS apps (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    secret TEXT NOT NULL UNIQUE,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    email      TEXT   NOT NULL,
    pass_hash  BYTEA  NOT NULL,
    app_id     INTEGER NOT NULL
        REFERENCES apps(id)
        ON DELETE CASCADE,
    UNIQUE (app_id, email)
);

CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY, -- ID сервиса, соответствует node.id из фронтенда
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'backend', 'frontend', 'authentication'
    status TEXT DEFAULT 'unknown',
    volume TEXT,
    version TEXT,
    path TEXT NOT NULL, -- Относительный путь в репозитории
    position_x FLOAT DEFAULT 0.0,
    position_y FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email ON users (email);