# RepoGuru — top-level Makefile.
#
# Wraps every component (cli / web / desktop / shared / reports) behind
# stable phony targets. CI/CD pipelines should invoke these instead of
# the underlying tools, so the matrix can stay platform-agnostic.
#
# Quick start:
#   make help        # see every target
#   make setup       # install deps (pnpm + cargo fetch)
#   make build       # build everything
#   make ci          # lint + typecheck + test + build, all components
#   make report TARGET=uk-gov     # run the State-of-Code pipeline

SHELL        := /usr/bin/env bash
.SHELLFLAGS  := -eu -o pipefail -c
.DEFAULT_GOAL := help

PNPM         ?= pnpm
CARGO        ?= cargo
PYTHON       ?= python3

CLI_BIN          := cli/target/release/repoanalyze
REPORT_TARGET    ?= uk-gov

# ──────────────────────────── Help ────────────────────────────

.PHONY: help
help: ## Show this help
	@printf "\033[1mRepoGuru build targets\033[0m\n\n"
	@awk 'BEGIN {FS = ":.*?## "} \
	     /^# ──+ / { sub(/^# ──+ /, ""); sub(/ ──+$$/, ""); printf "\n\033[1m%s\033[0m\n", $$0 } \
	     /^[a-zA-Z][a-zA-Z0-9_-]*:.*?## / { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' \
	     $(MAKEFILE_LIST)
	@printf "\n  Variables: \033[36mPNPM\033[0m=$(PNPM)  \033[36mCARGO\033[0m=$(CARGO)  \033[36mPYTHON\033[0m=$(PYTHON)\n"
	@printf "             \033[36mREPORT_TARGET\033[0m=$(REPORT_TARGET)  (override: \"make report TARGET=foo\" via REPORT_TARGET)\n\n"

# ──────────────────────────── Setup ────────────────────────────

.PHONY: setup
setup: ## Install all dependencies (pnpm install + cargo fetch)
	$(PNPM) install
	cd cli  && $(CARGO) fetch
	cd spec && $(CARGO) fetch

# ──────────────────────────── Build ────────────────────────────

.PHONY: build build-cli build-shared build-web build-desktop
build: build-cli build-shared build-web build-desktop ## Build everything

build-cli: ## Build the Rust CLI release binary
	cd cli && $(CARGO) build --release --bin repoanalyze

build-shared: ## Compile all shared TypeScript packages (shared/*)
	$(PNPM) -r --filter './shared/*' run build

build-web: build-shared ## Build the web app (Vite production bundle)
	$(PNPM) --filter repoguru build

build-desktop: build-shared ## Build the Electron renderer (no packaging)
	$(PNPM) --filter repoguru-desktop run build:renderer

# ──────────────────────────── Package (release artefacts) ────────────────────────────

.PHONY: package-desktop package-desktop-mac package-desktop-win package-desktop-linux
# `build:renderer` runs `tsc && vite build` which (via vite-plugin-electron)
# emits BOTH dist/ (renderer) and dist-electron/ (main + preload) — both
# are required by electron-builder's app.asar packaging.
package-desktop: build-shared ## Package Electron desktop for the current OS
	$(PNPM) --filter repoguru-desktop run build:renderer
	$(PNPM) --filter repoguru-desktop package

package-desktop-mac: build-shared ## macOS .dmg / .pkg bundle
	$(PNPM) --filter repoguru-desktop run build:renderer
	$(PNPM) --filter repoguru-desktop package:mac

package-desktop-win: build-shared ## Windows .exe installer
	$(PNPM) --filter repoguru-desktop run build:renderer
	$(PNPM) --filter repoguru-desktop package:win

package-desktop-linux: build-shared ## Linux AppImage / .deb
	$(PNPM) --filter repoguru-desktop run build:renderer
	$(PNPM) --filter repoguru-desktop package:linux

# ──────────────────────────── Test ────────────────────────────

.PHONY: test test-cli test-shared test-web test-desktop
test: test-cli test-shared test-web test-desktop ## Run every test suite

test-cli: ## cargo test (release)
	cd cli && $(CARGO) test --release

test-shared: ## Smoke + unit tests in shared/ (best-effort)
	@for pkg in shared/*/; do \
	  if [ -f "$$pkg/package.json" ] && jq -e '.scripts.test' "$$pkg/package.json" >/dev/null 2>&1; then \
	    echo "→ $$pkg"; (cd "$$pkg" && $(PNPM) test); \
	  fi; \
	done

test-web: ## vitest in web/
	$(PNPM) --filter repoguru test

test-desktop: ## vitest in desktop/ (no-op if no test script)
	@if jq -e '.scripts.test' desktop/package.json >/dev/null 2>&1; then \
	  $(PNPM) --filter repoguru-desktop test; \
	else echo '(no test script in desktop/)'; fi

# ──────────────────────────── Lint + format ────────────────────────────

.PHONY: lint lint-cli lint-web format format-check
lint: lint-cli lint-web ## Lint every component
# Note: desktop/ has no eslint config of its own — its renderer reuses
# shared/ui components which ARE linted via web/. Wire it up if desktop
# grows desktop-specific renderer code worth its own rules.

lint-cli: ## cargo clippy (deny warnings)
	cd cli && $(CARGO) clippy --release --all-targets -- -D warnings

lint-web: ## eslint web/
	$(PNPM) --filter repoguru lint

format: ## Auto-format code in place
	$(PNPM) --filter repoguru format
	cd cli && $(CARGO) fmt

format-check: ## Verify formatting without changing files
	$(PNPM) --filter repoguru format:check
	cd cli && $(CARGO) fmt --check

# ──────────────────────────── Typecheck ────────────────────────────

.PHONY: typecheck typecheck-shared typecheck-web typecheck-desktop
typecheck: typecheck-shared typecheck-web typecheck-desktop ## tsc --noEmit everywhere

typecheck-shared: ## tsc on shared/*
	$(PNPM) -r --filter './shared/*' run typecheck

typecheck-web: ## tsc on web/
	$(PNPM) --filter repoguru typecheck

typecheck-desktop: ## tsc on desktop/
	$(PNPM) --filter repoguru-desktop typecheck

# ──────────────────────────── Dev workflow ────────────────────────────

.PHONY: dev-web dev-desktop
dev-web: ## Start the web dev server (vite)
	$(PNPM) --filter repoguru dev

dev-desktop: ## Start the desktop dev (vite + electron)
	$(PNPM) --filter repoguru-desktop electron:dev

# ──────────────────────────── Reports pipeline ────────────────────────────

# Build the binary on demand if the report target is requested.
$(CLI_BIN):
	$(MAKE) build-cli

.PHONY: report report-render report-pdf report-status report-init
report: $(CLI_BIN) ## Run the full State-of-Code pipeline. Usage: make report REPORT_TARGET=<slug>
	bash reports/state-of-code/scripts/run_all.sh $(REPORT_TARGET)

report-render: ## Re-render HTML only (skip enumerate / scan / viewmodels). Usage: make report-render REPORT_TARGET=<slug>
	SKIP_ENUM=1 SKIP_TECHDETECT=1 SKIP_VIEWMODELS=1 \
	  bash reports/state-of-code/scripts/run_all.sh $(REPORT_TARGET)

report-pdf: ## Print the report HTML to a PDF (requires Playwright)
	@if [ -f /tmp/to-pdf.mjs ]; then node /tmp/to-pdf.mjs; \
	else echo 'PDF helper missing — open the HTML in a browser and File → Print → Save as PDF'; fi

report-status: ## Snapshot the current scan progress
	bash reports/state-of-code/scripts/status.sh $(REPORT_TARGET)

report-init: ## Scaffold a new target. Usage: make report-init REPORT_TARGET=<slug>
	bash reports/state-of-code/scripts/init.sh $(REPORT_TARGET)

# ──────────────────────────── Security + compliance ────────────────────────────

.PHONY: audit audit-pnpm audit-cargo license-check size smoke-cli
audit: audit-pnpm audit-cargo ## Full security audit (pnpm + cargo)

audit-pnpm: ## pnpm audit (npm vulnerabilities) — gates on `critical` only
	# Electron's release cadence vs. our pin means a steady tail of moderate/high
	# advisories will always be open against `desktop > electron`. We track those
	# via dependabot's auto-PRs (which themselves run CI). Gating CI on `critical`
	# keeps the bar real: a CVE that's actively exploited in the wild fails fast,
	# but the slow-burn of "Electron <X.Y.Z" advisories doesn't block main.
	#
	# Reduce to `--audit-level=high` once Electron is on the latest LTS major.
	$(PNPM) audit --audit-level=critical

audit-cargo: ## cargo audit (Rust advisories)
	@if ! cargo audit --version >/dev/null 2>&1; then \
	  echo "cargo-audit not installed — install with 'cargo install cargo-audit'"; \
	  exit 1; \
	fi
	cd cli  && cargo audit
	cd spec && cargo audit

license-check: ## Verify web app license compliance (no GPL/AGPL/SSPL)
	$(PNPM) --filter repoguru run license:check

size: build-web ## Verify web bundle stays under size-limit budget
	cd web && $(PNPM) run size

smoke-cli: $(CLI_BIN) ## Quick functional smoke test of the CLI on this repo
	@echo '── repoanalyze --version ──'
	@$(CLI_BIN) --version
	@echo '── detect-tech on this repo (just keys) ──'
	@$(CLI_BIN) detect-tech --repo $$PWD --format json | jq 'keys'
	@echo '── report-card on this repo ──'
	@$(CLI_BIN) report-card --repo $$PWD | jq '{overall_grade, overall_score}'

# ──────────────────────────── CI aggregates ────────────────────────────

.PHONY: ci ci-cli ci-shared ci-web ci-desktop ci-preflight
ci: ci-cli ci-shared ci-web ci-desktop ## Full CI: lint + typecheck + test + build for every component

ci-preflight: format-check typecheck ## Fast pre-flight (format + typecheck — fail fast)

ci-cli: lint-cli test-cli build-cli smoke-cli ## CI for cli/ — clippy + tests + build + smoke

ci-shared: typecheck-shared build-shared ## CI for shared/* — typecheck + build

ci-web: typecheck-web lint-web test-web build-web ## CI for web/ — typecheck + lint + test + build

ci-desktop: typecheck-desktop build-desktop ## CI for desktop/ — typecheck + build (no separate lint: see lint target)

# ──────────────────────────── Clean ────────────────────────────

.PHONY: clean clean-cli clean-web clean-desktop clean-shared clean-reports
clean: clean-cli clean-web clean-desktop clean-shared ## Remove every build artefact

clean-cli: ## cargo clean
	cd cli && $(CARGO) clean

clean-web: ## web/dist + .vite + tsbuildinfo
	rm -rf web/dist web/.vite web/*.tsbuildinfo

clean-desktop: ## desktop/dist + dist-electron + release
	rm -rf desktop/dist desktop/dist-electron desktop/release desktop/*.tsbuildinfo

clean-shared: ## shared/*/dist + tsbuildinfo
	@for d in shared/*/; do rm -rf "$$d/dist" "$$d"/*.tsbuildinfo; done

clean-reports: ## Render output for the current target ($(REPORT_TARGET))
	rm -rf $$HOME/.repoguru-reports/state-of-code/$(REPORT_TARGET)/site

# ──────────────────────────── Diagnostics ────────────────────────────

.PHONY: doctor versions paths
doctor: ## Verify every required tool is installed
	@echo "── pnpm ──";          $(PNPM)   --version
	@echo "── cargo ──";         $(CARGO)  --version
	@echo "── python3 ──";       $(PYTHON) --version
	@echo "── git ──";           git       --version
	@echo "── jq ──";            jq        --version 2>/dev/null || echo '(missing — used by reports)'
	@echo "── gh (optional) ──"; gh --version 2>/dev/null | head -1 || echo '(missing — needed for stage 1 enumeration)'

versions: ## Print versions of the published artefacts
	@echo "cli:     $$($(CLI_BIN) --version 2>/dev/null || echo 'not built')"
	@echo "web:     $$(jq -r '.version' web/package.json)"
	@echo "desktop: $$(jq -r '.version' desktop/package.json)"

paths: ## Print the canonical paths for every component
	@echo "cli/      = Rust CLI ($(CLI_BIN))"
	@echo "desktop/  = Electron app"
	@echo "web/      = browser app"
	@echo "shared/   = TypeScript packages (@repoguru/*)"
	@echo "spec/     = reference Rust impl + design docs"
	@echo "reports/  = State-of-Code pipeline"
