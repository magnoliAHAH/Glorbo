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
	userID := raw.(string)

	var req struct {
		RepoName    string    `json:"repoName"`    // Имя репозитория (для привязки к проекту)
		ServiceType string    `json:"serviceType"` // Тип сервиса (backend, redis, etc.)
		Position    *Position `json:"position"`    // Желаемая позиция на канвасе
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.RepoName == "" || req.ServiceType == "" {
		http.Error(w, "repoName and serviceType are required", http.StatusBadRequest)
		return
	}
	if req.Position == nil {
		req.Position = &Position{X: 0, Y: 0} // Устанавливаем дефолтную позицию, если не указана
	}

	// Находим project_id по имени репозитория и userID
	var projectID int64
	err := db.QueryRow("SELECT id FROM projects WHERE name = $1 AND user_id = $2", req.RepoName, userID).Scan(&projectID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Project not found for this user and repository name", http.StatusNotFound) // ВОТ ЗДЕСЬ ВОЗНИКАЕТ 404
			return
		}
		log.Printf("Database error fetching project ID for repo %s and user %s: %v", req.RepoName, userID, err)
		http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
		return
	}

	// Генерируем уникальный ID для нового сервиса
	serviceID := generateUUID()
	serviceName := fmt.Sprintf("%s-service-%s", req.ServiceType, serviceID[:4]) // Пример имени сервиса
	// Определяем путь для сервиса. Это может быть подпапка с именем типа сервиса,
	// или просто корень репозитория, если это "главный" сервис.
	// Пока что просто используем тип сервиса в нижнем регистре.
	servicePath := strings.ToLower(req.ServiceType)

	// Вставляем новый сервис в БД
	_, err = db.Exec(`
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
	})
}

// handleUpdateNodePosition обновляет позицию узла (сервиса) в БД
func handleUpdateNodePosition(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	requestsTotal.WithLabelValues("/api/update-node-position", r.Method).Inc()
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
	// userID := raw.(string) // Может быть использован для проверки прав на изменение узла

	var req struct {
		RepoName string   `json:"repoName"` // Имя репозитория (для контекста)
		NodeID   string   `json:"nodeId"`   // ID узла, чья позиция обновляется
		Position Position `json:"position"` // Новая позиция
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.NodeID == "" {
		http.Error(w, "Node ID is required", http.StatusBadRequest)
		return
	}

	// Обновляем позицию сервиса в БД по его ID
	result, err := db.Exec(`
		UPDATE services
		SET position_x = $1, position_y = $2
		WHERE id = $3
	`, req.Position.X, req.Position.Y, req.NodeID)

	if err != nil {
		log.Printf("Failed to update position for service %s: %v", req.NodeID, err)
		http.Error(w, fmt.Sprintf("Failed to update node position: %v", err), http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Service not found with the provided ID or no changes made", http.StatusNotFound)
		return
	}

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

// --- Остальные функции (без существенных изменений, только CORS и методы) ---

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

// handleCreateAuthService создает новый сервис авторизации (приложение) для проекта
func handleCreateAuthService(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	requestsTotal.WithLabelValues("/api/authService", r.Method).Inc()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	raw := r.Context().Value(userIDKey)
	if raw == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	// userID := raw.(string) // В текущей реализации не используется, но может понадобиться для проверки прав

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, "App name is required", http.StatusBadRequest)
		return
	}

	// Получаем project_id из URL-пути
	vars := mux.Vars(r)
	projectIDStr, ok := vars["project_id"]
	if !ok || projectIDStr == "" {
		http.Error(w, "Missing project_id in URL", http.StatusBadRequest)
		return
	}

	secret := generateSecret()

	// Создаём запись в базе данных
	if err := createAuthServiceDB(req.Name, secret, projectIDStr); err != nil { // Переименовал, чтобы не конфликтовать
		log.Printf("Failed to create auth service in DB: %v", err)
		http.Error(w, "Failed to create auth service", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "created",
		"secret": secret,
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
		projects, err := getProjectsByUser(userID)
		if err != nil {
			log.Printf("Failed to fetch projects for user %s: %v", userID, err)
			http.Error(w, "Failed to fetch projects", http.StatusInternalServerError)
			return
		}
		if len(projects) == 0 {
			// Возвращаем пустой массив или сообщение, но не ошибку 404, если проектов нет
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode([]Project{}) // Возвращаем пустой JSON-массив
			return
		}
		json.NewEncoder(w).Encode(projects)

	case http.MethodPost:
		var req struct {
			Name string `json:"name"`
			URL  string `json:"url"` // Теперь ожидаем URL репозитория
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid input", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			http.Error(w, "Project name is required", http.StatusBadRequest)
			return
		}
		if req.URL == "" {
			http.Error(w, "Project URL is required", http.StatusBadRequest)
			return
		}

		// Проверяем, существует ли уже проект с таким URL для этого пользователя
		var count int
		err := db.QueryRow("SELECT COUNT(*) FROM projects WHERE user_id = $1 AND url = $2", userID, req.URL).Scan(&count)
		if err != nil {
			log.Printf("Database error checking existing project for user %s, URL %s: %v", userID, req.URL, err)
			http.Error(w, "Database error checking existing project", http.StatusInternalServerError)
			return
		}
		if count > 0 {
			http.Error(w, "Project with this URL already exists for this user", http.StatusConflict)
			return
		}

		if err := createProject(userID, req.Name, req.URL); err != nil {
			log.Printf("Failed to create project for user %s: %v", userID, err)
			http.Error(w, "Failed to create project", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "created", "message": "Project created successfully"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// createProject создает новую запись о проекте в БД
func createProject(userID, name, url string) error {
	_, err := db.Exec("INSERT INTO projects (user_id, name, url) VALUES ($1, $2, $3)", userID, name, url)
	return err
}

// getProjectsByUser извлекает список проектов для данного пользователя
func getProjectsByUser(userID string) ([]Project, error) {
	rows, err := db.Query("SELECT id, user_id, name, url FROM projects WHERE user_id = $1", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		// Изменил Scan для соответствия структуре Project (добавил URL)
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.URL); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, nil
}

// getUsersHandler обрабатывает запрос на получение списка пользователей для конкретного проекта
func getUsersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

	requestsTotal.WithLabelValues("/api/projects/{project_id}/users", r.Method).Inc()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	vars := mux.Vars(r)
	projectIDStr, ok := vars["project_id"]
	if !ok || projectIDStr == "" {
		http.Error(w, "Missing project_id in URL", http.StatusBadRequest)
		return
	}

	projectID, err := strconv.Atoi(projectIDStr)
	if err != nil {
		http.Error(w, "Invalid project_id", http.StatusBadRequest)
		return
	}

	users, err := getUsersByProjectID(int32(projectID))
	if err != nil {
		log.Printf("Error fetching users for project %d: %v", projectID, err)
		http.Error(w, fmt.Sprintf("Error fetching users: %v", err), http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(w).Encode(users); err != nil {
		http.Error(w, fmt.Sprintf("Error encoding response: %v", err), http.StatusInternalServerError)
		return
	}
}

// getUsersByProjectID извлекает список пользователей, связанных с проектом через app_id
func getUsersByProjectID(projectID int32) ([]User, error) {
	rows, err := db.Query(`
		SELECT u.id, u.email, u.app_id
		FROM users u
		JOIN apps a ON u.app_id = a.id
		WHERE a.project_id = $1
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.AppID); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

// createAuthServiceDB создает новую запись приложения (auth-сервиса) в БД
func createAuthServiceDB(name, secret, projectID string) error {
	projectIDInt, err := strconv.ParseInt(projectID, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid project ID: %w", err)
	}
	_, err = db.Exec("INSERT INTO apps (name, secret, project_id) VALUES ($1, $2, $3)", name, secret, projectIDInt)
	return err
}

// generateSecret генерирует криптографически стойкий случайный секрет
func generateSecret() string {
	b := make([]byte, 32) // 32 байта = 256 бит
	if _, err := rand.Read(b); err != nil {
		log.Fatalf("Failed to generate secret: %v", err)
	}
	return hex.EncodeToString(b)
}
