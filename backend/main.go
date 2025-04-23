package main

import (
	grpcclient "backend/grpcClient"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"path", "method"},
	)
	authClient *grpcclient.Client
)

type FileNode struct {
	Name     string     `json:"name"`
	Type     string     `json:"type"` // "file" or "folder"
	Children []FileNode `json:"children,omitempty"`
}

func init() {
	prometheus.MustRegister(requestsTotal)
}

func main() {
	ctx := context.Background()
	logger := slog.Default()
	client, err := grpcclient.New(ctx, logger, "grpcauth:44044", 2*time.Second, 3)
	if err != nil {
		log.Fatalf("failsed to init gRPC client: %v", err)
	}
	authClient = client

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/api/structure", handleStructure)

	http.Handle("/api/projects", WithAuth(http.HandlerFunc(handleProjects)))

	http.HandleFunc("/api/register", handleRegister)
	http.HandleFunc("/api/login", handleLogin)

	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleStructure(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET")
	requestsTotal.WithLabelValues("/api/structure", r.Method).Inc()
	// Обработка OPTIONS запросов
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}
	repo := r.URL.Query().Get("repo")
	if repo == "" {
		http.Error(w, "Missing 'repo' query param", http.StatusBadRequest)
		return
	}

	tmpDir, err := os.MkdirTemp("", "repo-*")
	if err != nil {
		http.Error(w, "Could not create temp dir", http.StatusInternalServerError)
		return
	}
	defer os.RemoveAll(tmpDir)

	// Clone
	cmd := exec.Command("git", "clone", "--depth=1", repo, tmpDir)
	if err := cmd.Run(); err != nil {
		http.Error(w, "Failed to clone repo", http.StatusInternalServerError)
		return
	}

	rootName := filepath.Base(tmpDir)
	structure, err := scanDir(tmpDir)
	if err != nil {
		http.Error(w, "Failed to scan repo", http.StatusInternalServerError)
		return
	}
	structure.Name = rootName

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(structure)
}

func WithAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "https://supreme-roulette.work.gd")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		cookie, err := r.Cookie("token")
		if err != nil {
			http.Error(w, "Unauthorized: no token cookie", http.StatusUnauthorized)
			return
		}

		tokenString := cookie.Value
		if tokenString == "" {
			http.Error(w, "Unauthorized: empty token", http.StatusUnauthorized)
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte("test-secret"), nil
		})
		if err != nil || !token.Valid {
			http.Error(w, "Unauthorized: invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "Unauthorized: invalid claims", http.StatusUnauthorized)
			return
		}

		userID, ok := claims["sub"].(string)
		if !ok {
			http.Error(w, "Unauthorized: no user ID in claims", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "userID", userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func scanDir(path string) (FileNode, error) {

	node := FileNode{
		Name: filepath.Base(path),
		Type: "folder",
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return node, err
	}

	for _, entry := range entries {
		// Пропускаем .git
		if entry.Name() == ".git" {
			continue
		}

		fullPath := filepath.Join(path, entry.Name())
		if entry.IsDir() {
			child, err := scanDir(fullPath)
			if err != nil {
				continue
			}
			node.Children = append(node.Children, child)
		} else {
			node.Children = append(node.Children, FileNode{
				Name: entry.Name(),
				Type: "file",
			})
		}
	}

	return node, nil
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	requestsTotal.WithLabelValues("/api/register", r.Method).Inc()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type reqBody struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var req reqBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	userID, err := authClient.Register(r.Context(), req.Email, req.Password)
	if err != nil {
		http.Error(w, "Registration failed", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{"user_id": userID})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	requestsTotal.WithLabelValues("/api/login", r.Method).Inc()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type reqBody struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		AppID    int32  `json:"app_id"`
	}

	var req reqBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	token, err := authClient.Login(r.Context(), req.Email, req.Password, req.AppID)
	if err != nil {
		http.Error(w, "Login failed", http.StatusUnauthorized)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})

	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func handleProjects(w http.ResponseWriter, r *http.Request) {
	// Получаем userID из контекста
	userID := r.Context().Value("userID").(string)

	// Логика для получения проектов пользователя
	// Например, вы можете проверить, что пользователь имеет доступ к своим проектам
	// Используем userID для фильтрации проектов, связанных с этим пользователем

	// Пример получения проектов
	projects := []string{"project1", "project2"} // Пример проектов

	// Возвращаем список проектов в формате JSON
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"user_id": "%s", "projects": %v}`, userID, projects)
}
