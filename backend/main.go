package main

import (
	grpcclient "backend/grpcClient"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
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

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
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
	ID                string         `json:"id"`        // Уникальный ID сервиса
	ProjectID         int64          `json:"projectId"` // ID проекта, к которому относится сервис
	Name              string         `json:"name"`      // Имя сервиса (может быть произвольным)
	Type              string         `json:"type"`      // Тип сервиса (backend, frontend, redis, etc.)
	Status            string         `json:"status"`    // Статус сервиса
	Volume            string         `json:"volume"`    // Объем
	Version           string         `json:"version"`   // Версия
	Path              string         `json:"path"`      // Относительный путь в репозитории (например, "backend", "frontend/src")
	PositionX         float64        `json:"positionX"` // Координата X на канвасе
	PositionY         float64        `json:"positionY"` // Координата Y на канвасе
	K8sDeploymentName sql.NullString `json:"k8sDeploymentName"`
	K8sNamespace      sql.NullString `json:"k8sNamespace"`
	K8sServiceName    sql.NullString `json:"k8sServiceName"`
	K8sNodePort       sql.NullInt32  `json:"k8sNodePort"` // Используем sql.NullInt32 для int полей, которые могут быть NULL
	K8sReplicas       sql.NullInt32  `json:"k8sReplicas"`
}

// Инициализация Prometheus метрик при запуске приложения
func init() {
	prometheus.MustRegister(requestsTotal)
}

var k8sClient *kubernetes.Clientset

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
	if err := addK8sColumnsToServicesTable(db); err != nil {
		log.Fatalf("Критическая ошибка при обновлении схемы БД: %v", err)
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

	router.Handle(
		"/api/projects/{project_id}/services/{service_id}",
		WithAuth(http.HandlerFunc(handleDeleteService)),
	).Methods("DELETE", "OPTIONS")

	// Маршруты для специфичных сервисов авторизации (связанных с project_id)
	router.Handle(
		"/api/projects/{project_id}/auth-services",
		WithAuth(http.HandlerFunc(handleCreateAuthService)),
	).Methods("POST", "OPTIONS")

	router.Handle("/api/projects/{project_id}/services", WithAuth(http.HandlerFunc(handleGetServicesByProjectID))).Methods("GET", "OPTIONS")
	// Маршруты для получения пользователей проекта
	router.Handle(
		"/api/projects/{project_id}/users",
		WithAuth(http.HandlerFunc(getUsersHandler)),
	).Methods("GET", "OPTIONS")

	router.Handle("/api/projects/{project_id}/pods", WithAuth(http.HandlerFunc(handleCreatePodAndService))).Methods("POST", "OPTIONS")

	router.Handle("/api/projects/{project_id}/deploys", WithAuth(http.HandlerFunc(handleCreateDeploymentAndService))).Methods("POST", "OPTIONS")

	router.Handle("/api/execute-task", WithAuth(http.HandlerFunc(handleExecuteTask))).Methods("POST", "OPTIONS")

	router.Handle("/api/projects/{projectId}/services/{serviceId}", WithAuth(http.HandlerFunc(handleGetServiceDetails))).Methods("GET", "OPTIONS")

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
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	requestsTotal.WithLabelValues("/api/create-service", r.Method).Inc()

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Проверка авторизации
	if r.Context().Value(userIDKey) == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Парсим тело запроса
	var req struct {
		ProjectID   int64     `json:"projectId"`
		ServiceType string    `json:"serviceType"`
		Position    *Position `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.ProjectID == 0 || req.ServiceType == "" {
		http.Error(w, "projectId and serviceType are required", http.StatusBadRequest)
		return
	}
	if req.Position == nil {
		req.Position = &Position{X: 0, Y: 0}
	}

	// Генерируем ID и имя
	serviceID := generateUUID()
	serviceName := fmt.Sprintf("%s-service-%s", req.ServiceType, serviceID[:4])
	servicePath := strings.ToLower(req.ServiceType)

	// Вставляем в базу данных
	if _, err := db.Exec(`
		INSERT INTO services
			(id, project_id, name, type, status, volume, version, path, position_x, position_y)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		serviceID, req.ProjectID, serviceName, req.ServiceType,
		"pending", "", "", servicePath, req.Position.X, req.Position.Y,
	); err != nil {
		log.Printf("DB insert failed: %v", err)
		http.Error(w, "Failed to create service", http.StatusInternalServerError)
		return
	}

	// Kubernetes
	cfg, err := rest.InClusterConfig()
	if err != nil {
		log.Printf("Failed to get k8s config: %v", err)
	} else {
		clientset, err := kubernetes.NewForConfig(cfg)
		if err != nil {
			log.Printf("Failed to create k8s client: %v", err)
		} else {
			nsName := fmt.Sprintf("project-%d", req.ProjectID)

			// Проверка наличия Namespace, если нет — создаём
			_, err := clientset.CoreV1().Namespaces().Get(context.TODO(), nsName, metav1.GetOptions{})
			if apierrors.IsNotFound(err) {
				_, err = clientset.CoreV1().Namespaces().Create(context.TODO(), &corev1.Namespace{
					ObjectMeta: metav1.ObjectMeta{
						Name: nsName,
					},
				}, metav1.CreateOptions{})
				if err != nil {
					log.Printf("Failed to create namespace %s: %v", nsName, err)
				} else {
					log.Printf("Namespace %s created", nsName)
				}
			} else if err != nil {
				log.Printf("Failed to get namespace %s: %v", nsName, err)
			}

			// Создание Pod в нужном namespace
			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      serviceName,
					Namespace: nsName,
					Labels:    map[string]string{"app": req.ServiceType},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  serviceName,
						Image: "nginx:latest",
					}},
					RestartPolicy: corev1.RestartPolicyAlways,
				},
			}
			_, err = clientset.CoreV1().Pods(nsName).Create(context.TODO(), pod, metav1.CreateOptions{})
			if err != nil {
				log.Printf("Failed to create pod %s in namespace %s: %v", serviceName, nsName, err)
			} else {
				log.Printf("Pod %s created in namespace %s", serviceName, nsName)
			}
		}
	}

	// Ответ
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message":   "Service created and nginx pod launched",
		"serviceId": serviceID,
		"name":      serviceName,
		"namespace": fmt.Sprintf("project-%d", req.ProjectID),
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
	query := `
		SELECT 
			id, project_id, name, type, status, volume, version, path, 
			position_x, position_y,
			k8s_deployment_name, k8s_namespace, k8s_service_name, 
			k8s_node_port, k8s_replicas
		FROM services
		WHERE project_id = $1;
	`

	rows, err := db.Query(query, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var services []Service

	for rows.Next() {
		var svc Service
		err := rows.Scan(
			&svc.ID,
			&svc.ProjectID,
			&svc.Name,
			&svc.Type,
			&svc.Status,
			&svc.Volume,
			&svc.Version,
			&svc.Path,
			&svc.PositionX,
			&svc.PositionY,
			&svc.K8sDeploymentName,
			&svc.K8sNamespace,
			&svc.K8sServiceName,
			&svc.K8sNodePort,
			&svc.K8sReplicas,
		)
		if err != nil {
			log.Printf("Ошибка при сканировании строки сервиса: %v", err)
			continue
		}
		services = append(services, svc)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return services, nil
}

func handleGetServicesByProjectID(w http.ResponseWriter, r *http.Request) {
	requestsTotal.WithLabelValues(r.URL.Path, r.Method).Inc() // Метрика Prometheus

	// Устанавливаем CORS заголовки (если не используете middleware для этого)
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000") // Замените на домен вашего фронтенда
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Credentials", "true")

	// Обработка OPTIONS запросов (preflight)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Извлекаем project_id из переменных URL
	vars := mux.Vars(r)
	projectIDStr, ok := vars["project_id"]
	if !ok {
		http.Error(w, "Project ID не указан", http.StatusBadRequest)
		return
	}

	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Неверный формат Project ID", http.StatusBadRequest)
		return
	}

	// Получаем services из базы данных
	services, err := getServicesByProjectID(projectID)
	if err != nil {
		log.Printf("Error getting services for project %d: %v", projectID, err)
		http.Error(w, "Ошибка сервера при получении сервисов", http.StatusInternalServerError)
		return
	}

	// Отправляем JSON-ответ
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
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

func handleDeleteService(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "DELETE, OPTIONS")

	requestsTotal.WithLabelValues(r.URL.Path, r.Method).Inc()

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

	vars := mux.Vars(r)
	serviceID, ok1 := vars["service_id"]
	projectIDStr, ok2 := vars["project_id"]

	if !ok1 || !ok2 {
		http.Error(w, "Missing project_id or service_id in URL", http.StatusBadRequest)
		return
	}

	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid project ID format", http.StatusBadRequest)
		return
	}

	// Получаем имя сервиса перед удалением
	var serviceName string
	err = db.QueryRow("SELECT name FROM services WHERE id = $1 AND project_id = $2", serviceID, projectID).Scan(&serviceName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "Service not found", http.StatusNotFound)
		} else {
			log.Printf("Error fetching service name: %v", err)
			http.Error(w, "Failed to query service", http.StatusInternalServerError)
		}
		return
	}

	// Удаляем из базы
	result, err := db.Exec("DELETE FROM services WHERE id = $1 AND project_id = $2", serviceID, projectID)
	if err != nil {
		log.Printf("Error deleting service %s from project %d: %v", serviceID, projectID, err)
		http.Error(w, "Failed to delete service", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Printf("Error checking affected rows: %v", err)
		http.Error(w, "Failed to confirm deletion", http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "Service not found in this project or already deleted", http.StatusNotFound)
		return
	}

	// Удаляем Pod в Kubernetes
	cfg, err := rest.InClusterConfig()
	if err != nil {
		log.Printf("Failed to get in-cluster config: %v", err)
	} else {
		clientset, err := kubernetes.NewForConfig(cfg)
		if err != nil {
			log.Printf("Failed to create Kubernetes client: %v", err)
		} else {
			ns := fmt.Sprintf("project-%d", projectID)
			err := clientset.CoreV1().Pods(ns).Delete(context.TODO(), serviceName, metav1.DeleteOptions{})
			if err != nil {
				if apierrors.IsNotFound(err) {
					log.Printf("Pod %s already deleted in namespace %s", serviceName, ns)
				} else {
					log.Printf("Failed to delete pod %s in namespace %s: %v", serviceName, ns, err)
				}
			} else {
				log.Printf("Pod %s successfully deleted from namespace %s", serviceName, ns)
			}
		}
	}

	// Ответ
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Service and related pod deleted successfully",
	})
}

type CreatePodRequest struct {
	Namespace     string            `json:"namespace"`     // куда создавать
	PodName       string            `json:"podName"`       // имя Pod
	Image         string            `json:"image"`         // образ контейнера
	Env           map[string]string `json:"env,omitempty"` // переменные окружения
	Command       []string          `json:"command,omitempty"`
	Args          []string          `json:"args,omitempty"`
	Labels        map[string]string `json:"labels,omitempty"`
	ContainerPort int32             `json:"containerPort"`
}

type CreatePodResponse struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Phase     string `json:"phase"`
}

func homeDir() string {
	if h, err := os.UserHomeDir(); err == nil {
		return h
	}
	return ""
}

func initK8sClient() (*kubernetes.Clientset, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		kubeconfig := filepath.Join(homeDir(), ".kube", "config")
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, err
		}
	}
	return kubernetes.NewForConfig(config)
}

func mapToEnvVars(m map[string]string) []corev1.EnvVar {
	env := make([]corev1.EnvVar, 0, len(m))
	for k, v := range m {
		env = append(env, corev1.EnvVar{Name: k, Value: v})
	}
	return env
}

func createPodAndServiceFromRequest(req *CreatePodRequest) (*corev1.Pod, *corev1.Service, error) {
	clientset, err := initK8sClient()
	if err != nil {
		return nil, nil, err
	}

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      req.PodName,
			Namespace: req.Namespace,
			Labels:    req.Labels,
		},
		Spec: corev1.PodSpec{
			Containers: []corev1.Container{
				{
					Name:    req.PodName,
					Image:   req.Image,
					Command: req.Command,
					Args:    req.Args,
					Env:     mapToEnvVars(req.Env),
					Ports: []corev1.ContainerPort{
						{
							ContainerPort: req.ContainerPort,
						},
					},
				},
			},
			RestartPolicy: corev1.RestartPolicyAlways,
		},
	}

	pod, err = clientset.CoreV1().Pods(req.Namespace).Create(context.Background(), pod, metav1.CreateOptions{})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create pod: %w", err)
	}

	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      req.PodName + "-svc",
			Namespace: req.Namespace,
			Labels:    req.Labels,
		},
		Spec: corev1.ServiceSpec{
			Selector: req.Labels,
			Ports: []corev1.ServicePort{
				{
					Port:       req.ContainerPort,
					TargetPort: intstr.FromInt(int(req.ContainerPort)),
					Protocol:   corev1.ProtocolTCP,
				},
			},
			Type: corev1.ServiceTypeNodePort,
		},
	}

	svc, err = clientset.CoreV1().Services(req.Namespace).Create(context.Background(), svc, metav1.CreateOptions{})
	if err != nil {
		return pod, nil, fmt.Errorf("failed to create service: %w", err)
	}

	return pod, svc, nil
}

func handleCreatePodAndService(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CreatePodRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	pod, svc, err := createPodAndServiceFromRequest(&req)
	if err != nil {
		http.Error(w, "Failed to create pod or service: "+err.Error(), http.StatusInternalServerError)
		return
	}

	resp := struct {
		PodName     string `json:"podName"`
		Namespace   string `json:"namespace"`
		PodPhase    string `json:"podPhase"`
		ServiceName string `json:"serviceName"`
		NodePort    int32  `json:"nodePort,omitempty"`
	}{
		PodName:     pod.Name,
		Namespace:   pod.Namespace,
		PodPhase:    string(pod.Status.Phase),
		ServiceName: svc.Name,
		NodePort:    0,
	}

	if len(svc.Spec.Ports) > 0 {
		resp.NodePort = svc.Spec.Ports[0].NodePort
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

type TaskRequest struct {
	ProjectID int64             `json:"project_id"`
	TaskType  string            `json:"task_type"`
	Params    map[string]string `json:"params"`
}

func int32Ptr(i int32) *int32 { return &i }

func handleExecuteTask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(userIDKey).(string)

	var req TaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	log.Printf("User %s requested task: %s for project %d with params: %+v", userID, req.TaskType, req.ProjectID, req.Params)

	switch req.TaskType {
	case "build":
		repoURL := req.Params["repo_url"]
		branch := req.Params["branch"]
		path := req.Params["path"]
		imageName := req.Params["image_name"]
		tag := req.Params["tag"]

		if repoURL == "" || branch == "" || path == "" || imageName == "" || tag == "" {
			http.Error(w, "Missing one or more required parameters: repo_url, branch, path, image_name, tag", http.StatusBadRequest)
			return
		}

		jobName := fmt.Sprintf("kaniko-build-%d-%d", req.ProjectID, time.Now().Unix())
		fullImage := fmt.Sprintf("registry.registry.svc.cluster.local:5000/%s:%s", imageName, tag)

		// Создаем Kubernetes client
		config, err := rest.InClusterConfig()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get Kubernetes config: %v", err), http.StatusInternalServerError)
			return
		}
		clientset, err := kubernetes.NewForConfig(config)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create Kubernetes client: %v", err), http.StatusInternalServerError)
			return
		}

		// Git volume mount path (общий путь в init-контейнере и основном контейнере)
		sharedVolumeName := "build-source"
		sharedVolumePath := "/workspace"

		job := &batchv1.Job{
			ObjectMeta: metav1.ObjectMeta{
				Name: jobName,
			},
			Spec: batchv1.JobSpec{
				BackoffLimit: int32Ptr(0),
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						RestartPolicy: corev1.RestartPolicyNever,
						InitContainers: []corev1.Container{
							{
								Name:    "clone-repo",
								Image:   "alpine/git",
								Command: []string{"sh", "-c"},
								Args: []string{
									fmt.Sprintf("git clone --depth 1 --branch %s %s %s && ls -la %s", branch, repoURL, sharedVolumePath, sharedVolumePath),
								},
								VolumeMounts: []corev1.VolumeMount{
									{
										Name:      sharedVolumeName,
										MountPath: sharedVolumePath,
									},
								},
							},
						},
						Containers: []corev1.Container{
							{
								Name:  "kaniko",
								Image: "gcr.io/kaniko-project/executor:latest",
								Args: []string{
									fmt.Sprintf("--context=%s/%s", sharedVolumePath, path),
									"--dockerfile=Dockerfile",
									fmt.Sprintf("--destination=%s", fullImage),
									"--insecure",
									"--insecure-pull",
									"--insecure-registry=registry.registry.svc.cluster.local:5000",
								},
								VolumeMounts: []corev1.VolumeMount{
									{
										Name:      sharedVolumeName,
										MountPath: sharedVolumePath,
									},
								},
							},
						},
						Volumes: []corev1.Volume{
							{
								Name: sharedVolumeName,
								VolumeSource: corev1.VolumeSource{
									EmptyDir: &corev1.EmptyDirVolumeSource{},
								},
							},
						},
					},
				},
			},
		}

		_, err = clientset.BatchV1().Jobs("default").Create(context.Background(), job, metav1.CreateOptions{})
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create Kaniko build job: %v", err), http.StatusInternalServerError)
			return
		}

		w.Write([]byte(fmt.Sprintf("✅ Kaniko build job создан: %s\n📦 Образ будет загружен в: %s", jobName, fullImage)))

	default:
		http.Error(w, "Unknown task_type", http.StatusBadRequest)
	}
}

type CreateDeploymentRequest struct {
	ProjectID      int64             `json:"projectId"`      // ID проекта для БД
	ServiceType    string            `json:"serviceType"`    // Тип сервиса (например, "frontend")
	DeploymentName string            `json:"deploymentName"` // Имя для Deployment (будет также использоваться для Pods/Service селектора)
	Namespace      string            `json:"namespace"`
	Image          string            `json:"image"`
	ContainerPort  int32             `json:"containerPort"`
	Env            map[string]string `json:"env,omitempty"`
	Command        []string          `json:"command,omitempty"`
	Args           []string          `json:"args,omitempty"`
	Labels         map[string]string `json:"labels,omitempty"`   // Дополнительные лейблы
	Replicas       *int32            `json:"replicas,omitempty"` // Количество реплик

	// Дополнительные поля для сохранения в БД (как в вашей таблице 'services')
	Position *Position `json:"position,omitempty"`
	Version  string    `json:"version,omitempty"`
	Volume   string    `json:"volume,omitempty"`
	Path     string    `json:"path,omitempty"`
}

func createDeploymentAndServiceK8s(req *CreateDeploymentRequest) (*appsv1.Deployment, *corev1.Service, error) {
	clientset, err := initK8sClient()
	if err != nil {
		return nil, nil, err
	}

	// Установка количества реплик по умолчанию, если не указано
	replicas := int32(1)
	if req.Replicas != nil {
		replicas = *req.Replicas
	}

	// Имя Deployment
	deploymentName := req.DeploymentName
	if deploymentName == "" { // Fallback, если имя не предоставлено
		deploymentName = fmt.Sprintf("%s-deployment-%s", req.ServiceType, generateUUID()[:4])
	}

	// Используем лейблы из запроса. Если их нет, создаем дефолтные.
	// Эти лейблы будут использоваться для селектора Deployment и Service,
	// а также для Pod'ов, управляемых Deployment'ом.
	podLabels := make(map[string]string)
	if req.Labels != nil {
		for k, v := range req.Labels {
			podLabels[k] = v
		}
	}
	// Важный лейбл для селектора Deployment и Service
	podLabels["app"] = deploymentName // Например, app: my-frontend-deployment

	// Проверка наличия Namespace, если нет — создаём
	_, err = clientset.CoreV1().Namespaces().Get(context.TODO(), req.Namespace, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		log.Printf("Namespace %s не найден, создаю...", req.Namespace)
		_, err = clientset.CoreV1().Namespaces().Create(context.TODO(), &corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{Name: req.Namespace},
		}, metav1.CreateOptions{})
		if err != nil {
			return nil, nil, fmt.Errorf("ошибка создания Namespace %s: %v", req.Namespace, err)
		}
		log.Printf("Namespace %s создан.", req.Namespace)
	} else if err != nil {
		return nil, nil, fmt.Errorf("ошибка получения Namespace %s: %v", req.Namespace, err)
	}

	// --- Создание Deployment ---
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      deploymentName,
			Namespace: req.Namespace,
			Labels:    podLabels, // Лейблы для самого Deployment
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas, // Желаемое количество реплик
			Selector: &metav1.LabelSelector{
				MatchLabels: podLabels, // Селектор Deployment'а должен соответствовать лейблам Pod'ов
			},
			Template: corev1.PodTemplateSpec{ // Шаблон Pod'а, который Deployment будет создавать
				ObjectMeta: metav1.ObjectMeta{
					Labels: podLabels, // Лейблы для каждого Pod'а
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  deploymentName, // Имя контейнера внутри Pod'а (можно использовать имя Deployment)
							Image: req.Image,
							Ports: []corev1.ContainerPort{
								{ContainerPort: req.ContainerPort},
							},
							Env:     mapToEnvVars(req.Env),
							Command: req.Command,
							Args:    req.Args,
						},
					},
					RestartPolicy: corev1.RestartPolicyAlways,
				},
			},
			Strategy: appsv1.DeploymentStrategy{
				Type: appsv1.RollingUpdateDeploymentStrategyType, // Стратегия обновления
			},
			MinReadySeconds: 5, // Pod считается "готовым" через 5 секунд
		},
	}

	createdDeployment, err := clientset.AppsV1().Deployments(req.Namespace).Create(context.TODO(), deployment, metav1.CreateOptions{})
	if err != nil {
		return nil, nil, fmt.Errorf("ошибка создания Deployment %s: %v", deploymentName, err)
	}
	log.Printf("Deployment %s создан в Namespace %s с %d репликами", deploymentName, req.Namespace, replicas)

	// --- Создание Service для экспозиции Deployment ---
	serviceName := fmt.Sprintf("%s-svc", deploymentName) // Имя Service на основе имени Deployment
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      serviceName,
			Namespace: req.Namespace,
			Labels:    podLabels, // Лейблы для Service
		},
		Spec: corev1.ServiceSpec{
			Selector: podLabels, // Селектор Service должен соответствовать лейблам Pod'ов
			Ports: []corev1.ServicePort{
				{
					Protocol:   corev1.ProtocolTCP,
					Port:       req.ContainerPort,                      // Порт, который будет слушать Service
					TargetPort: intstr.FromInt(int(req.ContainerPort)), // Порт контейнера, куда направлять трафик
					NodePort:   0,                                      // Kubernetes автоматически назначит NodePort в диапазоне 30000-32767
				},
			},
			Type: corev1.ServiceTypeNodePort, // Тип Service для внешнего доступа через IP нод
		},
	}

	createdService, err := clientset.CoreV1().Services(req.Namespace).Create(context.TODO(), service, metav1.CreateOptions{})
	if err != nil {
		// Если Service не создался, желательно удалить созданный Deployment
		_ = clientset.AppsV1().Deployments(req.Namespace).Delete(context.TODO(), deploymentName, metav1.DeleteOptions{})
		return createdDeployment, nil, fmt.Errorf("ошибка создания Service %s: %v", serviceName, err)
	}
	log.Printf("Service %s создан в Namespace %s (NodePort)", serviceName, req.Namespace)

	return createdDeployment, createdService, nil
}

func handleCreateDeploymentAndService(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	// requestsTotal.WithLabelValues("/api/create-deployment-service", r.Method).Inc() // Раскомментируйте, если используете Prometheus

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Проверка авторизации
	if r.Context().Value(userIDKey) == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CreateDeploymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Invalid request body for CreateDeployment: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Проверки обязательных полей
	if req.ProjectID == 0 || req.ServiceType == "" || req.DeploymentName == "" || req.Image == "" || req.Namespace == "" || req.ContainerPort == 0 {
		log.Printf("Missing required fields for CreateDeployment: ProjectID=%d, ServiceType=%s, DeploymentName=%s, Image=%s, Namespace=%s, ContainerPort=%d",
			req.ProjectID, req.ServiceType, req.DeploymentName, req.Image, req.Namespace, req.ContainerPort)
		http.Error(w, "projectId, serviceType, deploymentName, image, namespace, and containerPort are required", http.StatusBadRequest)
		return
	}

	// Если количество реплик не указано, устанавливаем по умолчанию 1
	if req.Replicas == nil {
		defaultReplicas := int32(1)
		req.Replicas = &defaultReplicas
	}

	// Установка Position по умолчанию, если не предоставлена
	if req.Position == nil {
		req.Position = &Position{X: 0, Y: 0}
	}

	// --- Создание Deployment и Service в Kubernetes ---
	deployment, svc, err := createDeploymentAndServiceK8s(&req) // Используем новую функцию
	if err != nil {
		log.Printf("Failed to create deployment or service in Kubernetes: %v", err)
		http.Error(w, "Failed to create deployment or service in Kubernetes: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// --- Логика сохранения в базу данных ---
	// Генерируем ID сервиса для БД (отдельно от K8s имён), чтобы иметь уникальный ID для фронтенда
	serviceID := generateUUID()

	// Вставляем или обновляем запись в таблице services
	// Имя сервиса для БД берем из req.DeploymentName
	_, err = db.Exec(`
        INSERT INTO services
            (id, project_id, name, type, status, volume, version, path, position_x, position_y,
             k8s_deployment_name, k8s_namespace, k8s_service_name, k8s_node_port, k8s_replicas)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            name = EXCLUDED.name,
            type = EXCLUDED.type,
            status = EXCLUDED.status,
            volume = EXCLUDED.volume,
            version = EXCLUDED.version,
            path = EXCLUDED.path,
            position_x = EXCLUDED.position_x,
            position_y = EXCLUDED.position_y,
            k8s_deployment_name = EXCLUDED.k8s_deployment_name,
            k8s_namespace = EXCLUDED.k8s_namespace,
            k8s_service_name = EXCLUDED.k8s_service_name,
            k8s_node_port = EXCLUDED.k8s_node_port,
            k8s_replicas = EXCLUDED.k8s_replicas;`, // Добавлена ON CONFLICT для обновления существующих записей
		serviceID,
		req.ProjectID,
		req.DeploymentName, // Имя сервиса для отображения (берем из DeploymentName запроса)
		req.ServiceType,
		"Running", // Статус после успешного деплоя
		req.Volume,
		req.Version,
		req.Path,
		req.Position.X,
		req.Position.Y,
		deployment.Name, // Имя K8s Deployment
		req.Namespace,   // Namespace Deployment и Service
		svc.Name,        // Имя K8s Service
		func() int32 { // Получаем NodePort из Service, если он есть
			if len(svc.Spec.Ports) > 0 && svc.Spec.Ports[0].NodePort != 0 {
				return svc.Spec.Ports[0].NodePort
			}
			return 0
		}(),
		*req.Replicas, // Сохраняем количество реплик
	)
	if err != nil {
		log.Printf("DB insert/update failed for new K8s service %s (Deployment %s): %v", req.DeploymentName, deployment.Name, err)
		// В случае ошибки БД, рассмотрите возможность удаления созданных K8s ресурсов.
		http.Error(w, "Failed to save service info to database", http.StatusInternalServerError)
		return
	}
	log.Printf("Service %s (ID: %s, Deployment: %s) saved/updated in DB for ProjectID %d", req.DeploymentName, serviceID, deployment.Name, req.ProjectID)

	// --- Ответ фронтенду ---
	resp := struct {
		ServiceID      string `json:"serviceId"`      // ID сервиса из БД
		DeploymentName string `json:"deploymentName"` // Имя Deployment в K8s
		Namespace      string `json:"namespace"`
		ServiceK8sName string `json:"serviceK8sName"` // Имя Service в K8s
		NodePort       int32  `json:"nodePort,omitempty"`
		Replicas       int32  `json:"replicas"` // Количество реплик
	}{
		ServiceID:      serviceID,
		DeploymentName: deployment.Name,
		Namespace:      req.Namespace,
		ServiceK8sName: svc.Name,
		NodePort:       0, // Будет перезаписано, если есть
		Replicas:       *req.Replicas,
	}

	if len(svc.Spec.Ports) > 0 {
		resp.NodePort = svc.Spec.Ports[0].NodePort
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(resp)
}

func addK8sColumnsToServicesTable(db *sql.DB) error {
	log.Println("Проверка и добавление колонок Kubernetes в таблицу 'services'...")

	// Добавление колонки k8s_deployment_name (TEXT)
	query1 := `
		ALTER TABLE services
		ADD COLUMN IF NOT EXISTS k8s_deployment_name TEXT;
	`
	_, err := db.Exec(query1)
	if err != nil {
		return fmt.Errorf("ошибка при добавлении колонки 'k8s_deployment_name': %w", err)
	}
	log.Println("Колонка 'k8s_deployment_name' проверена/добавлена.")

	// Добавление колонки k8s_namespace (TEXT)
	query2 := `
		ALTER TABLE services
		ADD COLUMN IF NOT EXISTS k8s_namespace TEXT;
	`
	_, err = db.Exec(query2)
	if err != nil {
		return fmt.Errorf("ошибка при добавлении колонки 'k8s_namespace': %w", err)
	}
	log.Println("Колонка 'k8s_namespace' проверена/добавлена.")

	// Добавление колонки k8s_service_name (TEXT)
	query3 := `
		ALTER TABLE services
		ADD COLUMN IF NOT EXISTS k8s_service_name TEXT;
	`
	_, err = db.Exec(query3)
	if err != nil {
		return fmt.Errorf("ошибка при добавлении колонки 'k8s_service_name': %w", err)
	}
	log.Println("Колонка 'k8s_service_name' проверена/добавлена.")

	// Добавление колонки k8s_node_port (INTEGER)
	query4 := `
		ALTER TABLE services
		ADD COLUMN IF NOT EXISTS k8s_node_port INTEGER;
	`
	_, err = db.Exec(query4)
	if err != nil {
		return fmt.Errorf("ошибка при добавлении колонки 'k8s_node_port': %w", err)
	}
	log.Println("Колонка 'k8s_node_port' проверена/добавлена.")

	// Добавление колонки k8s_replicas (INTEGER)
	query5 := `
		ALTER TABLE services
		ADD COLUMN IF NOT EXISTS k8s_replicas INTEGER;
	`
	_, err = db.Exec(query5)
	if err != nil {
		return fmt.Errorf("ошибка при добавлении колонки 'k8s_replicas': %w", err)
	}
	log.Println("Колонка 'k8s_replicas' проверена/добавлена.")

	log.Println("Все необходимые колонки Kubernetes в таблице 'services' присутствуют.")
	return nil
}

func handleGetServiceDetails(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "https://mixail.ermin33.fvds.ru")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	if r.Method != http.MethodGet {
		http.Error(w, "Метод не разрешен", http.StatusMethodNotAllowed)
		return
	}

	// Извлекаем переменные пути из запроса
	vars := mux.Vars(r)
	projectIDStr := vars["projectId"]
	serviceID := vars["serviceId"]

	// Преобразуем projectIDStr в int
	projectID, err := strconv.Atoi(projectIDStr)
	if err != nil {
		log.Printf("Неверный project ID в URL: %v", err)
		http.Error(w, "Неверный project ID", http.StatusBadRequest)
		return
	}

	if db == nil {
		log.Println("Ошибка: Соединение с БД не установлено.")
		http.Error(w, "Ошибка сервера: Соединение с базой данных не установлено", http.StatusInternalServerError)
		return
	}

	// Выполняем SQL-запрос для получения всей строки сервиса
	query := `
		SELECT 
			id, project_id, name, type, status, volume, version, path, position_x, position_y, 
			k8s_deployment_name, k8s_namespace, k8s_service_name, k8s_node_port, k8s_replicas
		FROM services
		WHERE project_id = $1 AND id = $2;
	`
	var service Service
	err = db.QueryRow(query, projectID, serviceID).Scan(
		&service.ID,
		&service.ProjectID,
		&service.Name,
		&service.Type,
		&service.Status,
		&service.Volume,
		&service.Version,
		&service.Path,
		&service.PositionX,
		&service.PositionY,
		&service.K8sDeploymentName,
		&service.K8sNamespace,
		&service.K8sServiceName,
		&service.K8sNodePort,
		&service.K8sReplicas,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			log.Printf("Сервис не найден: ProjectID=%d, ServiceID=%s", projectID, serviceID)
			http.Error(w, "Сервис не найден", http.StatusNotFound)
		} else {
			log.Printf("Ошибка базы данных при получении сервиса: %v", err)
			http.Error(w, "Ошибка сервера при получении деталей сервиса", http.StatusInternalServerError)
		}
		return
	}

	// Отправляем найденные детали сервиса в формате JSON
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(service)
}
