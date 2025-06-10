package main

import (
	grpcclient "backend/grpcClient"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings" // Добавим для работы со строками
	"time"

	"github.com/gorilla/mux"

	"github.com/golang-jwt/jwt/v5"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Глобальные переменные для подключения к БД и gRPC клиента
var db *sql.DB
var authClient *grpcclient.Client

// Структуры данных для API и БД
type Project struct {
	ID     int64  `json:"id"`
	UserID string `json:"user_id"`
	Name   string `json:"name"`
	URL    string `json:"url,omitempty"` // URL репозитория, связывающий проект с содержимым
}

type User struct {
	ID    int32
	Email string
	AppID int32
}

// contextKey для сохранения userID в контексте запроса
type contextKey string

const userIDKey contextKey = "userID"

// Prometheus метрики
var (
	requestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"path", "method"},
	)
)

// Position - для хранения координат узла на графе
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// FileNode - представляет узел в древовидной структуре репозитория.
// Содержит ID, Type, Name, опционально Children, и метаданные для сервисов/файлов.
type FileNode struct {
	ID          string        `json:"id"`                    // Уникальный ID узла, генерируется бэкендом
	Name        string        `json:"name"`                  // Имя файла/папки/сервиса
	Type        string        `json:"type"`                  // "file", "folder", "service", "repo"
	Children    []FileNode    `json:"children,omitempty"`    // Дочерние элементы (для папок)
	ServiceType string        `json:"serviceType,omitempty"` // Тип сервиса (backend, frontend, redis, etc.)
	Status      string        `json:"status,omitempty"`      // Статус сервиса (running, stopped, etc.)
	Volume      string        `json:"volume,omitempty"`      // Объем или другие метаданные для сервисов
	Version     string        `json:"version,omitempty"`     // Версия сервиса
	Content     string        `json:"content,omitempty"`     // Содержимое файла (для небольших текстовых файлов)
	Position    *Position     `json:"position,omitempty"`    // Позиция узла на React Flow канвасе (для сервисов)
	ProjectID   sql.NullInt64 `json:"projectId,omitempty"`   // ID проекта, к которому относится сервис/репозиторий
}

// Service - представляет сервис, сохраненный в базе данных
// Содержит информацию, которая может быть постоянной между сканированиями репозитория
type Service struct {
	ID        string  `json:"id"`        // Уникальный ID сервиса
	ProjectID int64   `json:"projectId"` // ID проекта, к которому относится сервис
	Name      string  `json:"name"`      // Имя сервиса (может быть произвольным)
	Type      string  `json:"type"`      // Тип сервиса (backend, frontend, redis, etc.)
	Status    string  `json:"status"`    // Статус сервиса
	Volume    string  `json:"volume"`    // Объем
	Version   string  `json:"version"`   // Версия
	Path      string  `json:"path"`      // Относительный путь в репозитории (например, "backend", "frontend/src")
	PositionX float64 `json:"positionX"` // Координата X на канвасе
	PositionY float64 `json:"positionY"` // Координата Y на канвасе
}

// Инициализация Prometheus метрик при запуске приложения
func init() {
	prometheus.MustRegister(requestsTotal)
}

// initDB инициализирует подключение к базе данных PostgreSQL
func initDB() {
	var err error
	connStr := "postgres://postgres:password@db/postgres?sslmode=disable" // Замените на актуальные данные
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	// Проверяем соединение
	if err = db.Ping(); err != nil {
		log.Fatalf("Failed to ping DB: %v", err)
	}
	log.Println("Successfully connected to the database!")
}

// main является точкой входа в приложение
func main() {
	ctx := context.Background()
	logger := slog.Default()

	initDB()
	// Создаем или проверяем наличие необходимых таблиц в БД
	if err := createTables(); err != nil {
		log.Fatalf("Failed to create/check tables: %v", err)
	}

	// Инициализация gRPC клиента для сервиса авторизации
	client, err := grpcclient.New(ctx, logger, "grpcauth:44044", 2*time.Second, 3) // Уточните адрес gRPC сервиса
	if err != nil {
		log.Fatalf("failed to init gRPC client: %v", err)
	}
	authClient = client

	// Инициализация маршрутизатора Gorilla Mux
	router := mux.NewRouter()

	// Регистрация маршрутов
	router.Handle("/metrics", promhttp.Handler()) // Prometheus метрики

	// Маршруты для работы с репозиторием и сервисами
	router.HandleFunc("/api/repo-tree", handleRepoTree).Methods("GET", "OPTIONS")
	router.Handle("/api/create-service", WithAuth(http.HandlerFunc(handleCreateService))).Methods("POST", "OPTIONS")
	router.Handle("/api/update-node-position", WithAuth(http.HandlerFunc(handleUpdateNodePosition))).Methods("POST", "OPTIONS")

	// Маршруты для управления проектами
	router.Handle("/api/projects", WithAuth(http.HandlerFunc(handleProjects)))

	// Маршруты для аутентификации
	router.HandleFunc("/api/register", handleRegister).Methods("POST", "OPTIONS")
	router.HandleFunc("/api/login", handleLogin).Methods("POST", "OPTIONS")

	// Маршруты для специфичных сервисов авторизации (связанных с project_id)
	router.Handle(
		"/api/projects/{project_id}/auth-services",
		WithAuth(http.HandlerFunc(handleCreateAuthService)),
	).Methods("POST", "OPTIONS")

	// Маршруты для получения пользователей проекта
	router.Handle(
		"/api/projects/{project_id}/users",
		WithAuth(http.HandlerFunc(getUsersHandler)),
	).Methods("GET", "OPTIONS")

	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", router))
}

// createTables создает или проверяет наличие всех необходимых таблиц в БД
func createTables() error {
	// Таблица для хранения информации о сервисах
	servicesTableSQL := `
	CREATE TABLE IF NOT EXISTS services (
		id TEXT PRIMARY KEY,
		project_id BIGINT NOT NULL,
		name TEXT NOT NULL,
		type TEXT NOT NULL, -- backend, frontend, redis, postgres, etc.
		status TEXT DEFAULT 'unknown',
		volume TEXT DEFAULT '',
		version TEXT DEFAULT '',
		path TEXT NOT NULL, -- Относительный путь в репозитории (например "backend" или "frontend/src")
		position_x FLOAT DEFAULT 0.0,
		position_y FLOAT DEFAULT 0.0,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT fk_project
			FOREIGN KEY(project_id)
			REFERENCES projects(id)
			ON DELETE CASCADE
	);`

	// Добавим project_id в таблицу apps, если его нет
	// Это нужно, чтобы связать приложения (auth-сервисы) с проектами
	alterAppsTableSQL := `
	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='apps' and column_name='project_id') THEN
			ALTER TABLE apps ADD COLUMN project_id BIGINT;
		END IF;
	END
	$$;`

	// Добавим внешний ключ apps.project_id к projects.id
	addForeignKeySQL := `
	DO $$
	BEGIN
		IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'apps_project_id_fkey') THEN
			ALTER TABLE apps
			ADD CONSTRAINT apps_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
		END IF;
	END
	$$;`

	_, err := db.Exec(servicesTableSQL)
	if err != nil {
		return fmt.Errorf("failed to create services table: %w", err)
	}
	log.Println("Services table checked/created.")

	_, err = db.Exec(alterAppsTableSQL)
	if err != nil {
		return fmt.Errorf("failed to alter apps table for project_id: %w", err)
	}
	log.Println("Apps table project_id column checked/added.")

	// Для существующих apps, у которых project_id NULL, можно установить его,
	// если есть логика для определения, к какому проекту они относятся.
	// UPDATE apps SET project_id = (SELECT id FROM projects WHERE name = 'default_project' LIMIT 1) WHERE project_id IS NULL;

	_, err = db.Exec(addForeignKeySQL)
	if err != nil {
		return fmt.Errorf("failed to add foreign key to apps table: %w", err)
	}
	log.Println("Apps table foreign key checked/added.")

	return nil
}

// generateUUID генерирует уникальный ID (UUIDv4) для узлов и сервисов
func generateUUID() string {
	b := make([]byte, 16) // 32 байта = 256 бит
	if _, err := rand.Read(b); err != nil {
		log.Fatalf("Error generating UUID: %v", err) // Если не удается сгенерировать, это критическая ошибка
	}
	// Устанавливаем биты для UUIDv4
	b[6] = (b[6] & 0x0F) | 0x40 // Version 4
	b[8] = (b[8] & 0x3F) | 0x80 // Variant 10xx
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// scanDir рекурсивно сканирует директорию, строит древовидную структуру FileNode,
// и интегрирует данные о сервисах из БД.
func scanDir(path, repoRootPath string, projectID int64, servicesMap map[string]Service) (FileNode, error) {
	node := FileNode{
		ID:   generateUUID(), // Генерируем ID для каждой папки
		Name: filepath.Base(path),
		Type: "folder",
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return node, err
	}

	for _, entry := range entries {
		// Пропускаем .git и другие служебные папки/файлы
		if entry.Name() == ".git" || entry.Name() == ".github" || entry.Name() == "vendor" || entry.Name() == "node_modules" {
			continue
		}

		fullPath := filepath.Join(path, entry.Name())
		// Вычисляем относительный путь для сопоставления с сервисами из БД
		// repoRootPath - это путь к корневой папке клонированного репозитория (tmpDir + repoName)
		relativePath := strings.TrimPrefix(fullPath, repoRootPath)
		relativePath = strings.TrimPrefix(relativePath, string(filepath.Separator)) // Удаляем начальный разделитель

		service, isService := servicesMap[relativePath] // Проверяем, является ли этот путь сервисом

		if entry.IsDir() {
			child, err := scanDir(fullPath, repoRootPath, projectID, servicesMap)
			if err != nil {
				// Логируем ошибку, но продолжаем сканирование
				log.Printf("Error scanning directory %s: %v", fullPath, err)
				continue
			}
			// Если папка соответствует сервису, обновляем ее тип и данные
			if isService {
				child.Type = "service"
				child.ServiceType = service.Type
				child.Status = service.Status
				child.Volume = service.Volume
				child.Version = service.Version
				child.Position = &Position{X: service.PositionX, Y: service.PositionY}
				child.ProjectID = sql.NullInt64{Int64: service.ProjectID, Valid: true}
				child.ID = service.ID // Используем ID сервиса из БД
			}
			node.Children = append(node.Children, child)
		} else { // Это файл
			fileNode := FileNode{
				ID:   generateUUID(), // Генерируем ID для каждого файла
				Name: entry.Name(),
				Type: "file",
			}
			// Если файл соответствует сервису (например, Dockerfile или main.go для микросервиса)
			if isService {
				fileNode.Type = "service"
				fileNode.ServiceType = service.Type
				fileNode.Status = service.Status
				fileNode.Volume = service.Volume
				fileNode.Version = service.Version
				fileNode.Position = &Position{X: service.PositionX, Y: service.PositionY}
				fileNode.ProjectID = sql.NullInt64{Int64: service.ProjectID, Valid: true}
				fileNode.ID = service.ID // Используем ID сервиса из БД
			}
			// Опционально: читать содержимое небольших файлов
			// fileInfo, _ := entry.Info()
			// if fileInfo != nil && fileInfo.Size() < 1024*10 { // например, файлы до 10KB
			// 	contentBytes, readErr := os.ReadFile(fullPath)
			// 	if readErr == nil {
			// 		fileNode.Content = string(contentBytes)
			// 	}
			// }
			node.Children = append(node.Children, fileNode)
		}
	}
	return node, nil
}

// handleRepoTree обрабатывает запрос на получение древовидной структуры репозитория.
// Она клонирует репозиторий, сканирует его и обогащает данными о сервисах из БД.
func handleRepoTree(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru") // Уточните ваш домен
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS") // Добавляем POST для создания сервисов

	requestsTotal.WithLabelValues("/api/repo-tree", r.Method).Inc()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	repoURL := r.URL.Query().Get("repo") // URL репозитория
	if repoURL == "" {
		http.Error(w, "Missing 'repo' query param (repository URL)", http.StatusBadRequest)
		return
	}

	// Находим project_id по URL репозитория
	var projectID int64
	err := db.QueryRow("SELECT id FROM projects WHERE url = $1", repoURL).Scan(&projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Project not found for this repository URL", http.StatusNotFound)
			return
		}
		log.Printf("Database error fetching project ID for URL %s: %v", repoURL, err)
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}

	// Получаем все сервисы для данного проекта из БД
	services, err := getServicesByProjectID(projectID)
	if err != nil {
		log.Printf("Failed to fetch services for project %d: %v", projectID, err)
		http.Error(w, fmt.Sprintf("Failed to fetch services: %v", err), http.StatusInternalServerError)
		return
	}

	// Создаем карту для быстрого доступа к сервисам по их относительному пути
	servicesMap := make(map[string]Service)
	for _, s := range services {
		servicesMap[s.Path] = s
	}

	// Создаем временную директорию для клонирования репозитория
	tmpDir, err := os.MkdirTemp("", "repo-*")
	if err != nil {
		http.Error(w, "Could not create temp dir", http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tmpDir) // Удаляем временную директорию после обработки

	// Клонируем репозиторий
	cmd := exec.Command("git", "clone", "--depth=1", repoURL, tmpDir)
	if err := cmd.Run(); err != nil {
		log.Printf("Failed to clone repo %s to %s: %v", repoURL, tmpDir, err)
		http.Error(w, fmt.Sprintf("Failed to clone repository: %v", err), http.StatusInternalServerError)
		return
	}

	// Извлекаем имя репозитория из URL
	repoName := filepath.Base(repoURL)
	if strings.HasSuffix(repoName, ".git") {
		repoName = strings.TrimSuffix(repoName, ".git")
	}

	// Путь к корневой папке клонированного репозитория (внутри tmpDir)
	repoRootPath := filepath.Join(tmpDir, repoName)
	// В некоторых случаях git clone может клонировать прямо в tmpDir, а не tmpDir/repoName
	// Проверим, существует ли repoRootPath, иначе используем tmpDir
	_, err = os.Stat(repoRootPath)
	if os.IsNotExist(err) {
		repoRootPath = tmpDir
	}

	// Сканируем директорию и строим древовидную структуру
	structure, err := scanDir(repoRootPath, repoRootPath, projectID, servicesMap)
	if err != nil {
		log.Printf("Failed to scan repo %s at %s: %v", repoName, repoRootPath, err)
		http.Error(w, fmt.Sprintf("Failed to scan repository: %v", err), http.StatusInternalServerError)
		return
	}

	// Обновляем корневой узел
	structure.Name = repoName
	structure.ID = fmt.Sprintf("repo-root-%d", projectID) // Уникальный ID для корня репозитория
	structure.Type = "repo"                               // Отмечаем корневой узел как "repo"
	structure.ProjectID = sql.NullInt64{Int64: projectID, Valid: true}

	// Отправляем JSON-ответ
	json.NewEncoder(w).Encode(structure)
}

// handleCreateService создает новый сервис и сохраняет его в БД
func handleCreateService(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	requestsTotal.WithLabelValues("/api/create-service", r.Method).Inc()
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Проверка авторизации
	raw := r.Context().Value(userIDKey)
	if raw == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	// userID := raw.(string) // userID не используется напрямую здесь, но может быть для доп. проверок

	var req struct {
		ProjectID   int64     `json:"projectId"`   // Теперь ожидаем project_id напрямую
		ServiceType string    `json:"serviceType"` // Тип сервиса (backend, redis, etc.)
		Position    *Position `json:"position"`    // Желаемая позиция на канвасе
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Проверяем наличие необходимых полей
	if req.ProjectID == 0 || req.ServiceType == "" {
		http.Error(w, "projectId and serviceType are required", http.StatusBadRequest)
		return
	}
	if req.Position == nil {
		req.Position = &Position{X: 0, Y: 0} // Устанавливаем дефолтную позицию, если не указана
	}

	// Используем projectID напрямую из запроса
	projectID := req.ProjectID

	// Генерируем уникальный ID для нового сервиса
	serviceID := generateUUID()
	serviceName := fmt.Sprintf("%s-service-%s", req.ServiceType, serviceID[:4]) // Пример имени сервиса
	// Определяем путь для сервиса. Это может быть подпапка с именем типа сервиса,
	// или просто корень репозитория, если это "главный" сервис.
	// Пока что просто используем тип сервиса в нижнем регистре.
	servicePath := strings.ToLower(req.ServiceType)

	// Вставляем новый сервис в БД
	_, err := db.Exec(`
		INSERT INTO services (id, project_id, name, type, status, volume, version, path, position_x, position_y)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, serviceID, projectID, serviceName, req.ServiceType, "pending", "", "", servicePath, req.Position.X, req.Position.Y)

	if err != nil {
		log.Printf("Failed to create service in DB: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create service: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message":   "Service created successfully",
		"serviceId": serviceID,
		"name":      serviceName, // Отдаем имя обратно, чтобы фронтенд мог его использовать
	})
}

// handleUpdateNodePosition обновляет позицию узла (сервиса) в БД
func handleUpdateNodePosition(w http.ResponseWriter, r *http.Request) {
	// Установка CORS-заголовков для POST-запроса
	// Gorilla Mux должен настроить их для OPTIONS-запросов отдельно
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization") // Укажите все заголовки, используемые фронтендом
	w.Header().Set("Access-Control-Allow-Methods", "POST")                        // В этом обработчике ожидаем только POST

	// Проверка авторизации: если middleware WithAuth работает правильно,
	// userIDKey должен быть в контексте.
	raw := r.Context().Value(userIDKey)
	if raw == nil {
		// Это не должно произойти, если WithAuth работает, но как запасной вариант.
		http.Error(w, "Unauthorized: User ID not found in context", http.StatusUnauthorized)
		return
	}
	// userID := raw.(string) // Если нужен ID пользователя, раскомментируйте

	// Декодирование тела запроса (NodeID, Position, ProjectID)
	var req struct {
		NodeID    string   `json:"nodeId"`
		Position  Position `json:"position"`
		ProjectID int64    `json:"projectId"`
	}

	decoder := json.NewDecoder(r.Body)
	// decoder.DisallowUnknownFields() // Уберем для простоты, если есть проблемы с парсингом

	if err := decoder.Decode(&req); err != nil {
		log.Printf("ERROR: Failed to decode request body: %v", err)
		http.Error(w, "Invalid request format", http.StatusBadRequest)
		return
	}

	// Базовая валидация полученных данных
	if req.NodeID == "" || req.ProjectID <= 0 {
		http.Error(w, "Node ID and valid Project ID are required", http.StatusBadRequest)
		return
	}

	// Обновление позиции в базе данных
	// Важно: обновление происходит только для узла с данным ID ВНУТРИ данного ProjectID
	result, err := db.Exec(`
		UPDATE services
		SET position_x = $1, position_y = $2
		WHERE id = $3 AND project_id = $4
	`, req.Position.X, req.Position.Y, req.NodeID, req.ProjectID)

	if err != nil {
		log.Printf("ERROR: Database update failed for node %s in project %d: %v", req.NodeID, req.ProjectID, err)
		http.Error(w, "Failed to update node position in database", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("ERROR: Failed to get rows affected after update: %v", err)
		// Не возвращаем ошибку пользователю, это внутренняя проблема.
	}

	if rowsAffected == 0 {
		// Если 0 строк затронуто, значит, либо такого узла нет, либо он не в этом проекте,
		// либо позиции не изменились.
		log.Printf("INFO: No changes made or node %s not found for project %d.", req.NodeID, req.ProjectID)
		http.Error(w, "Node not found or position already up-to-date", http.StatusNotFound)
		return
	}

	// Успешный ответ
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Node position updated successfully"})
}

// getServicesByProjectID извлекает все сервисы из БД для заданного projectID
func getServicesByProjectID(projectID int64) ([]Service, error) {
	rows, err := db.Query(`
		SELECT id, project_id, name, type, status, volume, version, path, position_x, position_y
		FROM services
		WHERE project_id = $1
	`, projectID)
	if err != nil {
		return nil, fmt.Errorf("error querying services: %w", err)
	}
	defer rows.Close()

	var services []Service
	for rows.Next() {
		var s Service
		if err := rows.Scan(&s.ID, &s.ProjectID, &s.Name, &s.Type, &s.Status, &s.Volume, &s.Version, &s.Path, &s.PositionX, &s.PositionY); err != nil {
			return nil, fmt.Errorf("error scanning service row: %w", err)
		}
		services = append(services, s)
	}
	return services, nil
}

// generateSecret генерирует случайную строку для секрета
func generateSecret() string {
	b := make([]byte, 32) // 256-битный секрет
	if _, err := rand.Read(b); err != nil {
		log.Printf("Failed to generate secret: %v", err)
		return ""
	}
	return hex.EncodeToString(b)
}

// createAuthServiceDB создает запись о новом сервисе аутентификации (приложении) в БД
// Обратите внимание: apps.project_id может быть NULL, если не установлен.
// В идеале, он должен быть NOT NULL и заполняться при создании проекта,
// или привязываться к проекту сразу при создании auth-сервиса.
func createAuthServiceDB(appName, secret, projectIDStr string) error {
	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid project_id: %w", err)
	}

	// Проверяем, существует ли проект с таким ID
	var exists bool
	err = db.QueryRow("SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1)", projectID).Scan(&exists)
	if err != nil {
		return fmt.Errorf("database error checking project existence: %w", err)
	}
	if !exists {
		return fmt.Errorf("project with ID %d does not exist", projectID)
	}

	// Вставляем в таблицу apps.
	// app_id будет сгенерирован автоматически, если это SERIAL PRIMARY KEY.
	// name - это имя приложения, которое пользователь ввел.
	// secret - это сгенерированный секрет.
	// project_id - это projectID, к которому привязан auth-сервис.
	query := `INSERT INTO apps (name, secret, project_id) VALUES ($1, $2, $3)`
	_, err = db.Exec(query, appName, secret, projectID)
	if err != nil {
		return fmt.Errorf("failed to insert auth service into apps table: %w", err)
	}
	log.Printf("Auth service '%s' created for project ID %d", appName, projectID)
	return nil
}

// handleCreateAuthService создает новый сервис авторизации (приложение) для проекта
func handleCreateAuthService(w http.ResponseWriter, r *http.Request) {
	// --- CORS-заголовки ---
	// ВНИМАНИЕ: Если вы разделили обработчики OPTIONS и POST в main.go,
	// то 'Access-Control-Allow-Methods' для POST запроса может быть просто "POST".
	// Однако, оставляем его полным для обеспечения совместимости, если не разделено.
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	// --- Метрики (если используются) ---
	// if requestsTotal != nil {
	// 	requestsTotal.WithLabelValues("/api/projects/{project_id}/auth-services", r.Method).Inc()
	// }

	// --- Обработка OPTIONS-запросов (preflight) ---
	// Если этот маршрут обрабатывается Gorilla Mux только для POST,
	// а OPTIONS обрабатывается отдельно, этот блок можно убрать.
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// --- Проверка авторизации ---
	raw := r.Context().Value(userIDKey)
	if raw == nil {
		log.Println("Unauthorized attempt to create auth service: User ID not found in context.")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	// userID := raw.(string) // ID авторизованного пользователя, если нужен для проверки прав

	// --- Декодирование тела запроса ---
	var req struct {
		Name string `json:"name"` // Имя приложения для аутентификации
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("ERROR: Invalid request body for creating auth service: %v", err)
		http.Error(w, "Invalid input format or unknown fields provided", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		log.Println("ERROR: Auth service name is required but was empty.")
		http.Error(w, "App name is required", http.StatusBadRequest)
		return
	}

	// --- Получение project_id из URL ---
	vars := mux.Vars(r)
	projectIDStr, ok := vars["project_id"]
	if !ok || projectIDStr == "" {
		log.Println("ERROR: Missing project_id in URL for creating auth service.")
		http.Error(w, "Missing project_id in URL", http.StatusBadRequest)
		return
	}
	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		log.Printf("ERROR: Invalid project_id in URL '%s': %v", projectIDStr, err)
		http.Error(w, "Invalid project ID format", http.StatusBadRequest)
		return
	}

	// --- Создание секрета для нового приложения ---
	secret := generateSecret() // Предполагаем, что generateSecret() определена

	// --- ШАГ 1: Вставляем новую запись в таблицу 'apps' ---
	var newAppID int64 // Используем int64 для соответствия BIGINT в БД
	// Используем RETURNING id для получения ID сразу после вставки
	err = db.QueryRow(`
		INSERT INTO apps (name, secret, project_id)
		VALUES ($1, $2, $3)
		RETURNING id
	`, req.Name, secret, projectID).Scan(&newAppID)
	if err != nil {
		log.Printf("ERROR: Failed to insert new app (auth service) into 'apps' table: %v", err)
		// Проверяем на ошибку уникального ключа (если имя уже занято)
		if strings.Contains(err.Error(), "duplicate key value violates unique constraint") {
			http.Error(w, "App name already exists for this project or globally", http.StatusConflict)
		} else {
			http.Error(w, fmt.Sprintf("Failed to create auth service: %v", err), http.StatusInternalServerError)
		}
		return
	}
	log.Printf("INFO: Successfully created app (auth service) in 'apps' table with ID: %d", newAppID)

	// --- ШАГ 2: Вставляем соответствующую запись в таблицу 'services' ---
	// Этот ID будет использоваться фронтендом для React Flow узла
	serviceNodeID := fmt.Sprintf("auth-%d", newAppID) // Формат ID должен соответствовать фронтенду!
	serviceNameForDashboard := req.Name + " (Auth)"   // Более наглядное имя для дашборда
	serviceTypeForDashboard := "authentication"       // Тип сервиса для дашборда
	servicePathForDashboard := "auth"                 // Относительный путь, может быть пустым

	_, err = db.Exec(`
		INSERT INTO services (id, project_id, name, type, status, volume, version, path, position_x, position_y)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, serviceNodeID, projectID, serviceNameForDashboard, serviceTypeForDashboard, "pending", "", "", servicePathForDashboard, 0.0, 0.0) // Начальные позиции 0,0
	if err != nil {
		log.Printf("ERROR: Failed to insert service node for auth app (ID: %d) into 'services' table: %v", newAppID, err)
		// ВНИМАНИЕ: Если здесь произошла ошибка, запись в 'apps' уже создана.
		// В продакшене вам, возможно, понадобится транзакция, чтобы откатить вставку в 'apps'.
		http.Error(w, fmt.Sprintf("Failed to create associated dashboard service: %v", err), http.StatusInternalServerError)
		return
	}
	log.Printf("INFO: Successfully created service node in 'services' table with ID: %s for app ID: %d", serviceNodeID, newAppID)

	// --- Успешный ответ ---
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":        "created",
		"secret":        secret,
		"authServiceId": newAppID,      // ID из таблицы 'apps'
		"serviceNodeId": serviceNodeID, // ID, который будет у узла на дашборде
		"message":       fmt.Sprintf("Auth service '%s' created and added to dashboard.", req.Name),
	})
}

// handleProjects обрабатывает запросы на создание и получение проектов пользователя
func handleProjects(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	requestsTotal.WithLabelValues("/api/projects", r.Method).Inc()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	raw := r.Context().Value(userIDKey)
	if raw == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := raw.(string)

	switch r.Method {
	case http.MethodGet:
		rows, err := db.Query("SELECT id, name, url FROM projects WHERE user_id = $1", userID)
		if err != nil {
			log.Printf("Error querying projects for user %s: %v", userID, err)
			http.Error(w, "Failed to fetch projects", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var projects []Project
		for rows.Next() {
			var p Project
			var url sql.NullString // Используем sql.NullString для nullable URL
			if err := rows.Scan(&p.ID, &p.Name, &url); err != nil {
				log.Printf("Error scanning project row: %v", err)
				continue
			}
			if url.Valid {
				p.URL = url.String
			}
			p.UserID = userID // Устанавливаем user_id, так как он не выбирается напрямую
			projects = append(projects, p)
		}
		json.NewEncoder(w).Encode(projects)

	case http.MethodPost:
		var req struct {
			Name string `json:"name"`
			URL  string `json:"url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" || req.URL == "" {
			http.Error(w, "Project name and URL are required", http.StatusBadRequest)
			return
		}

		var projectID int64
		err := db.QueryRow(
			"INSERT INTO projects (user_id, name, url) VALUES ($1, $2, $3) RETURNING id",
			userID, req.Name, req.URL,
		).Scan(&projectID)
		if err != nil {
			log.Printf("Failed to insert new project: %v", err)
			http.Error(w, "Failed to create project", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]any{
			"message":   "Project created successfully",
			"projectID": projectID,
		})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// getUsersHandler retrieves users associated with a specific app within a project.
// This function needs further development based on how 'apps' and 'users' are truly linked
// and how 'project_id' relates to the app/user context.
func getUsersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")

	requestsTotal.WithLabelValues("/api/projects/{project_id}/users", r.Method).Inc()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	raw := r.Context().Value(userIDKey)
	if raw == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	// authenticatedUserID := raw.(string) // The ID of the user making the request

	vars := mux.Vars(r)
	projectIDStr, ok := vars["project_id"]
	if !ok || projectIDStr == "" {
		http.Error(w, "Missing project_id in URL", http.StatusBadRequest)
		return
	}

	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid project_id", http.StatusBadRequest)
		return
	}

	// --- Logic to fetch users for the given project_id ---
	// This assumes:
	// 1. There's a relationship between 'projects' and 'apps' (auth services)
	// 2. There's a relationship between 'apps' and 'users'
	// This is a placeholder; you'll need to adjust the SQL query based on your actual schema
	// and how users are linked to specific authentication services (apps) within a project.

	// Example: Fetch users associated with apps belonging to this project
	// This assumes:
	// - 'users' table has a 'app_id' column
	// - 'apps' table has a 'project_id' column
	rows, err := db.Query(`
        SELECT u.id, u.email, u.app_id
        FROM users u
        JOIN apps a ON u.app_id = a.id
        WHERE a.project_id = $1
    `, projectID)
	if err != nil {
		log.Printf("Failed to fetch users for project %d: %v", projectID, err)
		http.Error(w, "Failed to retrieve users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Email, &user.AppID); err != nil {
			log.Printf("Error scanning user row: %v", err)
			continue
		}
		users = append(users, user)
	}

	json.NewEncoder(w).Encode(users)
}

// WithAuth - Middleware для проверки аутентификации пользователя по JWT токену из куки
func WithAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru") // Уточните ваш домен
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS") // Добавил POST, OPTIONS
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Обработка Preflight-запросов CORS
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		cookie, err := r.Cookie("token")
		if err != nil {
			log.Printf("Cookie error: %v", err)
			http.Error(w, "Unauthorized: no token cookie", http.StatusUnauthorized)
			return
		}
		tokenString := cookie.Value
		log.Printf("Received token: %s", tokenString)

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte("test-secret"), nil // !!! В продакшене используйте сложный секрет из переменных окружения
		})
		if err != nil || !token.Valid {
			log.Printf("Token parse/valid error: %v", err)
			http.Error(w, "Unauthorized: invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Println("Invalid claims format")
			http.Error(w, "Unauthorized: invalid claims", http.StatusUnauthorized)
			return
		}

		rawUID, exists := claims["uid"]
		if !exists {
			log.Printf("Claims missing uid: %v", claims)
			http.Error(w, "Unauthorized: no user ID in claims", http.StatusUnauthorized)
			return
		}
		uidFloat, ok := rawUID.(float64)
		if !ok {
			log.Printf("uid is not a number: %T %#v", rawUID, rawUID)
			http.Error(w, "Unauthorized: invalid user ID", http.StatusUnauthorized)
			return
		}
		userID := strconv.Itoa(int(uidFloat))
		log.Printf("Authenticated userID: %s", userID)

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// handleRegister обрабатывает запросы на регистрацию нового пользователя
func handleRegister(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru") // Уточните ваш домен
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	requestsTotal.WithLabelValues("/api/register", r.Method).Inc()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type reqBody struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		AppID    int32  `json:"app_id"` // AppID пока не используется в регистрации, но может понадобиться
	}

	var req reqBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	userID, err := authClient.Register(r.Context(), req.Email, req.Password, req.AppID)
	if err != nil {
		log.Printf("Registration failed for %s: %v", req.Email, err)
		http.Error(w, "Registration failed", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{"user_id": userID})
}

// handleLogin обрабатывает запросы на вход пользователя
func handleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru") // Уточните ваш домен
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	requestsTotal.WithLabelValues("/api/login", r.Method).Inc()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type reqBody struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		AppID    int32  `json:"app_id"` // AppID пока не используется в логине, но может понадобиться
	}

	var req reqBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	token, err := authClient.Login(r.Context(), req.Email, req.Password, req.AppID)
	if err != nil {
		log.Printf("Login failed for %s: %v", req.Email, err)
		http.Error(w, "Login failed", http.StatusUnauthorized)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		HttpOnly: true,
		Secure:   true, // true для HTTPS
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})

	json.NewEncoder(w).Encode(map[string]string{"token": token})
}
