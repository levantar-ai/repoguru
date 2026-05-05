# syntax=docker/dockerfile:1.6
# Multi-stage build for repoanalyze Rust binary
# Produces a minimal runtime image (~10MB) with just the binary

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM rust:1.83-slim-bookworm AS builder

# Install protobuf compiler (required for tonic-build/prost)
RUN apt-get update && apt-get install -y --no-install-recommends \
    protobuf-compiler \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Cache dependencies: copy manifests first, build a dummy binary,
# then replace with real source. This layer is cached unless Cargo.toml/lock change.
COPY Cargo.toml Cargo.lock ./
COPY build.rs ./
COPY proto/ ./proto/

# Stub out src so cargo can fetch/compile deps
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release --locked 2>/dev/null || true
RUN rm -f target/release/repoanalyze target/release/deps/repoanalyze*

# Build real binary
COPY src/ ./src/
RUN cargo build --release --locked

# Strip debug symbols to reduce binary size
RUN strip target/release/repoanalyze

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# git is needed at runtime — gix shells out to git for certain operations
# (pack negotiation, credential helpers, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 10001 repoanalyze && \
    useradd --uid 10001 --gid repoanalyze --shell /bin/bash --create-home repoanalyze

WORKDIR /workspace

COPY --from=builder /build/target/release/repoanalyze /usr/local/bin/repoanalyze

# Drop root
USER repoanalyze

# gRPC server mode: expose default port (actual port is OS-assigned with --listen [::1]:0)
EXPOSE 50051

ENTRYPOINT ["/usr/local/bin/repoanalyze"]
CMD ["--help"]

# ─── Labels (OCI image spec) ──────────────────────────────────────────────────
LABEL org.opencontainers.image.title="repoanalyze" \
      org.opencontainers.image.description="Fast git repository analysis tool" \
      org.opencontainers.image.source="https://github.com/your-org/repoguru-spec" \
      org.opencontainers.image.licenses="MIT"
