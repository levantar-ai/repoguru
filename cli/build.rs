fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Honour an explicit PROTOC env var if present (CI installs protoc via
    // `arduino/setup-protoc`). On non-Windows hosts where PROTOC isn't set,
    // fall back to the bundled protoc from protobuf-src.
    //
    // On Windows protobuf-src is excluded in Cargo.toml (it doesn't link),
    // so PROTOC must be set externally — the CI matrix does that, and
    // local Windows dev should `winget install protobuf` or similar.
    if std::env::var_os("PROTOC").is_none() {
        #[cfg(not(target_os = "windows"))]
        std::env::set_var("PROTOC", protobuf_src::protoc());

        #[cfg(target_os = "windows")]
        return Err("PROTOC env var not set. Install protoc and set PROTOC=<path>. \
                    On CI we use arduino/setup-protoc; locally try `winget install Google.Protobuf`."
            .into());
    }
    tonic_build::compile_protos("proto/repoanalyze.proto")?;
    Ok(())
}
