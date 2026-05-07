fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Honour an explicit PROTOC env var if present (CI installs protoc via
    // `arduino/setup-protoc` to skip the slow + fragile protobuf-src C++
    // build, especially on Windows MSVC). Fall back to the bundled protoc
    // for local dev where nothing's been pre-installed.
    if std::env::var_os("PROTOC").is_none() {
        std::env::set_var("PROTOC", protobuf_src::protoc());
    }
    tonic_build::compile_protos("proto/repoanalyze.proto")?;
    Ok(())
}
