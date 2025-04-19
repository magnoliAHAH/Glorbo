package storage

import "errors"

// work with bd
var (
	ErrUserExists   = errors.New("user alrady exists")
	ErrUserNotFound = errors.New("user not found")
	ErrAppNotFound  = errors.New("app bot found")
)
