use gix::ObjectId;

/// Row layout for `tables/commit_stats.bin` (§6.4.1).
/// Fixed-width, little-endian.
///
/// Total size: 20+20+20+20+4+4+8+8+4+1+1+4+8+8+4+4+4+8+8 = 160 bytes
pub const COMMIT_STAT_ROW_SIZE: usize = 160;

#[derive(Debug, Clone)]
pub struct CommitStat {
    pub commit_oid: ObjectId,      // 20
    pub parent_oid: ObjectId,      // 20
    pub tree_oid: ObjectId,        // 20
    pub parent_tree_oid: ObjectId, // 20
    pub author_id: u32,            // 4
    pub committer_id: u32,         // 4
    pub author_ts: i64,            // 8
    pub commit_ts: i64,            // 8
    pub message_len: u32,          // 4
    pub parents_count: u8,         // 1
    pub is_merge: u8,              // 1
    pub files_changed: u32,        // 4
    pub insertions: u64,           // 8
    pub deletions: u64,            // 8
    pub binary_files_changed: u32, // 4
    pub renames: u32,              // 4
    pub copies: u32,               // 4
    pub diff_time_ns: u64,         // 8
    pub diff_bytes_inflated: u64,  // 8
}

impl CommitStat {
    /// Serialize to fixed-width little-endian bytes.
    pub fn to_bytes(&self) -> [u8; COMMIT_STAT_ROW_SIZE] {
        let mut buf = [0u8; COMMIT_STAT_ROW_SIZE];
        let mut pos = 0;

        buf[pos..pos + 20].copy_from_slice(self.commit_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 20].copy_from_slice(self.parent_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 20].copy_from_slice(self.tree_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 20].copy_from_slice(self.parent_tree_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 4].copy_from_slice(&self.author_id.to_le_bytes());
        pos += 4;
        buf[pos..pos + 4].copy_from_slice(&self.committer_id.to_le_bytes());
        pos += 4;
        buf[pos..pos + 8].copy_from_slice(&self.author_ts.to_le_bytes());
        pos += 8;
        buf[pos..pos + 8].copy_from_slice(&self.commit_ts.to_le_bytes());
        pos += 8;
        buf[pos..pos + 4].copy_from_slice(&self.message_len.to_le_bytes());
        pos += 4;
        buf[pos] = self.parents_count;
        pos += 1;
        buf[pos] = self.is_merge;
        pos += 1;
        buf[pos..pos + 4].copy_from_slice(&self.files_changed.to_le_bytes());
        pos += 4;
        buf[pos..pos + 8].copy_from_slice(&self.insertions.to_le_bytes());
        pos += 8;
        buf[pos..pos + 8].copy_from_slice(&self.deletions.to_le_bytes());
        pos += 8;
        buf[pos..pos + 4].copy_from_slice(&self.binary_files_changed.to_le_bytes());
        pos += 4;
        buf[pos..pos + 4].copy_from_slice(&self.renames.to_le_bytes());
        pos += 4;
        buf[pos..pos + 4].copy_from_slice(&self.copies.to_le_bytes());
        pos += 4;
        buf[pos..pos + 8].copy_from_slice(&self.diff_time_ns.to_le_bytes());
        pos += 8;
        buf[pos..pos + 8].copy_from_slice(&self.diff_bytes_inflated.to_le_bytes());

        buf
    }

    /// Deserialize from fixed-width little-endian bytes.
    pub fn from_bytes(data: &[u8; COMMIT_STAT_ROW_SIZE]) -> Self {
        let mut pos = 0;

        let commit_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let parent_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let tree_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let parent_tree_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let author_id = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let committer_id = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let author_ts = i64::from_le_bytes(data[pos..pos + 8].try_into().expect("8 bytes"));
        pos += 8;
        let commit_ts = i64::from_le_bytes(data[pos..pos + 8].try_into().expect("8 bytes"));
        pos += 8;
        let message_len = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let parents_count = data[pos];
        pos += 1;
        let is_merge = data[pos];
        pos += 1;
        let files_changed = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let insertions = u64::from_le_bytes(data[pos..pos + 8].try_into().expect("8 bytes"));
        pos += 8;
        let deletions = u64::from_le_bytes(data[pos..pos + 8].try_into().expect("8 bytes"));
        pos += 8;
        let binary_files_changed =
            u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let renames = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let copies = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let diff_time_ns = u64::from_le_bytes(data[pos..pos + 8].try_into().expect("8 bytes"));
        pos += 8;
        let diff_bytes_inflated =
            u64::from_le_bytes(data[pos..pos + 8].try_into().expect("8 bytes"));

        CommitStat {
            commit_oid,
            parent_oid,
            tree_oid,
            parent_tree_oid,
            author_id,
            committer_id,
            author_ts,
            commit_ts,
            message_len,
            parents_count,
            is_merge,
            files_changed,
            insertions,
            deletions,
            binary_files_changed,
            renames,
            copies,
            diff_time_ns,
            diff_bytes_inflated,
        }
    }
}
