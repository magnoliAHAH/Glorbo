package postgres

import (
	"context"
	"errors"
	"fmt"
	"grpc-SSO/internal/domain/models"
	"grpc-SSO/internal/storage"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Storage struct {
	db *pgx.Conn
}

func New(storagePath string) (*Storage, error) {
	const op = "storage.postgres.New"

	// Подключение через pgx
	db, err := pgx.Connect(context.Background(), storagePath)
	if err != nil {
		return nil, fmt.Errorf("%s: failed to open DB %w", op, err)
	}

	// Проверяем соединение с базой данных
	if err = db.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("%s: failed to ping DB %w", op, err)
	}

	return &Storage{
		db: db,
	}, nil
}

func (s *Storage) SaveUser(ctx context.Context, email string, passHash []byte) (int64, error) {
	const op = "storage.postgres.SaveUser"

	query := `INSERT INTO users (email, pass_hash) VALUES ($1, $2) RETURNING id`

	var id int64
	// Используем QueryRowContext для выполнения запроса
	err := s.db.QueryRow(ctx, query, email, passHash).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		// Обработка ошибки уникальности (23505 - уникальное нарушение)
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return 0, fmt.Errorf("%s: %w", op, storage.ErrUserExists)
		}
		return 0, fmt.Errorf("%s: %w", op, err)
	}

	return id, nil
}

func (s *Storage) User(ctx context.Context, email string) (models.User, error) {
	const op = "storage.postgres.User"

	query := `SELECT id, email, pass_hash FROM users WHERE email = $1`

	var user models.User
	// Выполняем запрос и сканируем результат
	err := s.db.QueryRow(ctx, query, email).Scan(&user.ID, &user.Email, &user.PassHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.User{}, fmt.Errorf("%s: %w", op, storage.ErrUserNotFound)
		}
		return models.User{}, fmt.Errorf("%s: %w", op, err)
	}

	return user, nil
}

func (s *Storage) App(ctx context.Context, id int) (models.App, error) {
	const op = "storage.postgres.App"

	query := `SELECT id, name, secret FROM apps WHERE id = $1`

	var app models.App
	err := s.db.QueryRow(ctx, query, id).Scan(&app.ID, &app.Name, &app.Secret)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.App{}, fmt.Errorf("%s: %w", op, storage.ErrAppNotFound)
		}
		return models.App{}, fmt.Errorf("%s: %w", op, err)
	}

	return app, nil
}
