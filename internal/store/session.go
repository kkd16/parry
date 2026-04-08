package store

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
)

func Session() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	h := sha256.Sum256([]byte(cwd))
	return hex.EncodeToString(h[:])
}

func Workdir() string {
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}
	return cwd
}
