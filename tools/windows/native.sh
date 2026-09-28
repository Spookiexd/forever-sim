#!/usr/bin/env bash
# Native Windows build without make, for Git Bash. Mirrors the makefile recipes
# (proto, test, dist/forever, host) with the same commands, so it stays a thin wrapper.
#
#   tools/windows/native.sh proto   # Go + TS protos and the go-to-ts constants
#   tools/windows/native.sh test    # go test --tags=with_db ./sim/... (needs proto)
#   tools/windows/native.sh ui      # vitest + type-check (needs proto)
#   tools/windows/native.sh build   # wasm + workers + vite bundle + assets into dist/forever
#   tools/windows/native.sh host    # serve dist/ at http://localhost:8080/forever/
#   tools/windows/native.sh smoke   # headless load of every page (needs host running)
#   tools/windows/native.sh all     # proto, test, build
#
# Toolchain: Go >= 1.25 and protoc on PATH, or set GO_HOME / PROTOC_HOME. protoc-gen-go is
# installed on first use. Node >= 22 with `npm ci` already run.
set -euo pipefail
cd "$(dirname "$0")/../.."

[ -n "${GO_HOME:-}" ] && export PATH="$GO_HOME/bin:$PATH"
[ -n "${PROTOC_HOME:-}" ] && export PATH="$PROTOC_HOME/bin:$PATH"
export PATH="$(go env GOPATH)/bin:$PATH"

proto() {
	command -v protoc-gen-go >/dev/null || go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	local inc=()
	if [ -n "${PROTOC_HOME:-}" ]; then inc=(-I="$PROTOC_HOME/include"); fi
	protoc -I=./proto "${inc[@]}" \
		--go_opt=Mgoogle/protobuf/descriptor.proto=google.golang.org/protobuf/types/descriptorpb \
		--go_out=./sim/core ./proto/*.proto
	mkdir -p ui/generated/proto
	npx protoc --ts_opt generate_dependencies --ts_out ui/generated/proto --proto_path proto proto/api.proto
	npx protoc --ts_out ui/generated/proto --proto_path proto proto/test.proto
	npx protoc --ts_out ui/generated/proto --proto_path proto proto/ui.proto
	go run ./tools/database/gen_db -gen=go-to-ts
	# `make test` depends on binary_dist/dist.go; sim/web embeds it.
	mkdir -p binary_dist/forever
	touch binary_dist/forever/embedded
	cp sim/web/dist.go.tmpl binary_dist/dist.go
}

test_go() { GOARCH=amd64 go test --tags=with_db ./sim/...; }

test_ui() {
	node_modules/typescript/bin/tsc --noEmit
	npx vitest run
}

build() {
	mkdir -p dist/forever
	GOWASM=satconv,signext GOOS=js GOARCH=wasm go build -ldflags "-w -s" -o ./dist/forever/lib.wasm ./sim/wasm/
	gzip -9 -f -n dist/forever/lib.wasm
	npx tsx vite.build-workers.mts
	npx vite build
	cp -r assets dist/forever/
	rm -rf dist/forever/assets/db_inputs
}

host() { npx http-server dist -p "${PORT:-8080}" -s; }

smoke() { SITE_URL="http://localhost:${PORT:-8080}/forever/" node tools/smoke/check_pages.mjs; }

case "${1:-}" in
proto) proto ;;
test) test_go ;;
ui) test_ui ;;
build) build ;;
host) host ;;
smoke) smoke ;;
all) proto && test_go && build ;;
*)
	sed -n '2,15p' "$0"
	exit 1
	;;
esac
