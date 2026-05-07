fn main() -> Result<(), Box<dyn std::error::Error>> {
    // On non-Windows hosts where PROTOC isn't pre-set, fall back to the
    // bundled protoc from protobuf-src. On Windows protobuf-src is
    // excluded (it doesn't link), so we expect protoc to be on PATH —
    // CI installs it via arduino/setup-protoc; locally try
    // `winget install Google.Protobuf`. prost-build's protoc probe
    // walks PATH automatically when PROTOC is unset.
    if std::env::var_os("PROTOC").is_none() {
        #[cfg(not(target_os = "windows"))]
        std::env::set_var("PROTOC", protobuf_src::protoc());
    }
    tonic_build::compile_protos("proto/repoanalyze.proto")?;
    Ok(())
}
