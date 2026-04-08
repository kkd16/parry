package paths

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/kkd16/parry/configs"
	"github.com/kkd16/parry/internal/policy"
)

func Dir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("finding home directory: %w", err)
	}
	return filepath.Join(home, ".parry"), nil
}

func PolicyFile() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "policy.yaml"), nil
}

func DBFile() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "parry.db"), nil
}

func LoadPolicy() (*policy.Engine, error) {
	engine := policy.NewEngine()
	path, err := PolicyFile()
	if err != nil {
		return nil, err
	}
	if err := engine.Load(path); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return engine, engine.LoadBytes(configs.DefaultPolicy)
		}
		return nil, err
	}
	return engine, nil
}
