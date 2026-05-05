use gix::ObjectId;

/// Kind of change detected between two trees (§6.4.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum ChangeKind {
    Add = 1,
    Modify = 2,
    Delete = 3,
    Rename = 4,
    Copy = 5,
    TypeChange = 6,
}

/// A raw change detected by tree delta (§8.1).
///
/// Paths are byte strings stored as lossy UTF-8.
/// At this stage, renames appear as separate Delete + Add pairs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawChange {
    /// Full path relative to repo root (e.g., "src/main.rs").
    pub path: String,
    /// OID of the old blob (zero for adds).
    pub old_oid: ObjectId,
    /// OID of the new blob (zero for deletes).
    pub new_oid: ObjectId,
    /// File mode of the old entry (0 for adds).
    pub old_mode: u32,
    /// File mode of the new entry (0 for deletes).
    pub new_mode: u32,
    /// The kind of change.
    pub kind: ChangeKind,
}
