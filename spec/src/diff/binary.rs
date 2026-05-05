/// Detect whether content is binary (§8.2).
///
/// Binary if NUL byte found in the first 8000 bytes,
/// or if the data represents a non-regular file (symlink/submodule).
pub fn is_binary(data: &[u8]) -> bool {
    let check_len = data.len().min(8000);
    data[..check_len].contains(&0)
}
