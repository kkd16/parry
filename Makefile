.PHONY: build frontend test lint lint-go lint-frontend lint-fix clean update

BINARY := parry
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -ldflags "-X main.version=$(VERSION)"

build: frontend
	go build $(LDFLAGS) -o $(BINARY) ./cmd/parry

frontend:
	cd frontend && npm ci && npm run build

test:
	go test ./... -race -count=1

lint: lint-go lint-frontend

lint-go:
	golangci-lint run ./...

lint-frontend:
	cd frontend && npm ci && npm run lint

lint-fix:
	golangci-lint run --fix ./...

clean:
	rm -f $(BINARY)
	go clean -testcache

update:
	@echo "=== Updating all dependencies ==="
	@echo "1) Go"
	@go get -u ./... && go mod tidy
	@echo "   ✓ Done"
	@echo "2) Frontend"
	@cd frontend && npx -y npm-check-updates -u --target minor && npm install
	@echo "   ✓ Done"
	@echo "✓ All dependencies updated"
