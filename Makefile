.PHONY: build test lint clean

BINARY := parry
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -ldflags "-X main.version=$(VERSION)"

build:
	go build $(LDFLAGS) -o $(BINARY) ./cmd/parry

test:
	go test ./... -race -count=1

lint:
	golangci-lint run ./...

clean:
	rm -f $(BINARY)
	go clean -testcache
