.PHONY: build frontend test lint lint-go lint-frontend lint-fix clean update

BINARY := parry
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -ldflags "-X main.version=$(VERSION)"

build: frontend
	@echo "=== Building $(BINARY) ==="
	@echo "1) Compiling Go binary ($(VERSION))"
	@go build $(LDFLAGS) -o $(BINARY) ./cmd/parry
	@echo "   ✓ Done → ./$(BINARY)"
	@echo "✓ Build complete"

frontend:
	@echo "=== Building frontend ==="
	@echo "1) npm ci"
	@cd frontend && npm ci
	@echo "   ✓ Done"
	@echo "2) npm run build"
	@cd frontend && npm run build
	@echo "   ✓ Done"
	@echo "✓ Frontend build complete"

test:
	@echo "=== Running Go tests ==="
	@echo "1) go test ./... -race -count=1"
	@go test ./... -race -count=1
	@echo "✓ Tests passed"

lint:
	@echo "=== Linting ==="
	@FAIL=0; \
	$(MAKE) lint-go || FAIL=1; \
	$(MAKE) lint-frontend || FAIL=1; \
	if [ $$FAIL -ne 0 ]; then \
		echo "✗ Lint failed"; \
		exit 1; \
	fi; \
	echo "✓ Lint clean"

lint-go:
	@echo "1) Go (golangci-lint)"
	@golangci-lint run ./...
	@echo "   ✓ Done"

lint-frontend:
	@echo "2) Frontend (npm run lint)"
	@cd frontend && npm ci && npm run lint
	@echo "   ✓ Done"

lint-fix:
	@echo "=== Lint fix ==="
	@echo "1) golangci-lint --fix"
	@golangci-lint run --fix ./...
	@echo "   ✓ Done"
	@echo "✓ Lint fix complete"

clean:
	@echo "=== Cleaning ==="
	@echo "1) Removing $(BINARY)"
	@rm -f $(BINARY)
	@echo "   ✓ Done"
	@echo "2) go clean -testcache"
	@go clean -testcache
	@echo "   ✓ Done"
	@echo "✓ Clean complete"

update:
	@echo "=== Updating all dependencies ==="
	@echo "1) Go"
	@go get -u ./... && go mod tidy
	@echo "   ✓ Done"
	@echo "2) Frontend"
	@cd frontend && npx -y npm-check-updates -u --target minor && npm install
	@echo "   ✓ Done"
	@echo "✓ All dependencies updated"
