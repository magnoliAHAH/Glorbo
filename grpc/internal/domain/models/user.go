package models

// model of user can be import to any package

type User struct {
	ID       int64
	Email    string
	PassHash []byte
}
