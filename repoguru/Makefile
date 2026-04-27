.PHONY: dev build lint format test typecheck ci clean

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

format:
	npm run format

format-check:
	npm run format:check

test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

typecheck:
	npm run typecheck

ci: lint typecheck test build

clean:
	rm -rf dist node_modules/.tmp coverage
