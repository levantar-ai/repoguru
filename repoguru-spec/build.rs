fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Use protobuf-src to provide a bundled protoc binary
    std::env::set_var("PROTOC", protobuf_src::protoc());
    tonic_build::compile_protos("proto/repoanalyze.proto")?;
    Ok(())
}
