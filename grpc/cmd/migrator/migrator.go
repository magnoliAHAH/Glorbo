package main

import (
	"errors"
	"flag"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx" // Исправленный драйвер для pgx
	_ "github.com/golang-migrate/migrate/v4/source/file"  // Источник миграций
)

func main() {
	var storagePath, migrationsPath, migrationsTable string

	// Флаги для пути хранения и миграций
	flag.StringVar(&storagePath, "storage-path", "", "PostgreSQL connection string (user:password@host:port/dbname)")
	flag.StringVar(&migrationsPath, "migrations-path", "", "path to migrations")
	flag.StringVar(&migrationsTable, "migrations-table", "migrations", "name of migrations table")
	flag.Parse()

	// Проверяем наличие обязательных параметров
	if storagePath == "" {
		panic("storage-path (PostgreSQL connection string) is required")
	}
	if migrationsPath == "" {
		panic("migrations-path is required")
	}

	// Создаем миграцию с указанием пути к миграциям и строки подключения
	m, err := migrate.New(
		"file://"+migrationsPath,
		fmt.Sprintf("pgx://%s", storagePath), // pgx драйвер для PostgreSQL v5
	)
	if err != nil {
		panic(err)
	}

	// Применяем миграции
	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			fmt.Println("no migrations to apply")
			return
		}
		panic(err)
	}

	fmt.Println("migrations applied")
}

// Log представляет логгер
type Log struct {
	verbose bool
}

// Printf выводит форматированное сообщение в лог
func (l *Log) Printf(format string, v ...interface{}) {
	fmt.Printf(format, v...)
}

// Verbose проверяет, включен ли verbose-режим
func (l *Log) Verbose() bool {
	return false
}
