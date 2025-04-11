package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
)

type FileNode struct {
	Name     string     `json:"name"`
	Type     string     `json:"type"` // "file" or "folder"
	Children []FileNode `json:"children,omitempty"`
}

func main() {
	http.HandleFunc("/api/structure", handleStructure)
	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleStructure(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET")

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
