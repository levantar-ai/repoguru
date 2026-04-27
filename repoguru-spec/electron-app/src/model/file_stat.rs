use gix::ObjectId;

/// Row layout for `tables/file_stats.bin` (§6.4.2).
/// Total size: 20+20+4+4+1+4+20+20+4+4+1+4+4 = 110 bytes
pub const FILE_STAT_ROW_SIZE: usize = 110;

#[derive(Debug, Clone)]
pub struct FileStat {
    pub commit_oid: ObjectId,   // 20
    pub parent_oid: ObjectId,   // 20
    pub author_id: u32,         // 4
    pub path_id: u32,           // 4
    pub change_kind: u8,        // 1
    pub old_path_id: u32,       // 4
    pub old_blob_oid: ObjectId, // 20
    pub new_blob_oid: ObjectId, // 20
    pub old_mode: u32,          // 4
    pub new_mode: u32,          // 4
    pub is_binary: u8,          // 1
    pub insertions: u32,        // 4
    pub deletions: u32,         // 4
}

impl FileStat {
    pub fn to_bytes(&self) -> [u8; FILE_STAT_ROW_SIZE] {
        let mut buf = [0u8; FILE_STAT_ROW_SIZE];
        let mut pos = 0;

        buf[pos..pos + 20].copy_from_slice(self.commit_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 20].copy_from_slice(self.parent_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 4].copy_from_slice(&self.author_id.to_le_bytes());
        pos += 4;
        buf[pos..pos + 4].copy_from_slice(&self.path_id.to_le_bytes());
        pos += 4;
        buf[pos] = self.change_kind;
        pos += 1;
        buf[pos..pos + 4].copy_from_slice(&self.old_path_id.to_le_bytes());
        pos += 4;
        buf[pos..pos + 20].copy_from_slice(self.old_blob_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 20].copy_from_slice(self.new_blob_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 4].copy_from_slice(&self.old_mode.to_le_bytes());
        pos += 4;
        buf[pos..pos + 4].copy_from_slice(&self.new_mode.to_le_bytes());
        pos += 4;
        buf[pos] = self.is_binary;
        pos += 1;
        buf[pos..pos + 4].copy_from_slice(&self.insertions.to_le_bytes());
        pos += 4;
        buf[pos..pos + 4].copy_from_slice(&self.deletions.to_le_bytes());

        buf
    }

    pub fn from_bytes(data: &[u8; FILE_STAT_ROW_SIZE]) -> Self {
        let mut pos = 0;

        let commit_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let parent_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let author_id = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let path_id = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let change_kind = data[pos];
        pos += 1;
        let old_path_id = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let old_blob_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let new_blob_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let old_mode = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let new_mode = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let is_binary = data[pos];
        pos += 1;
        let insertions = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let deletions = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));

        FileStat {
            commit_oid,
            parent_oid,
            author_id,
            path_id,
            change_kind,
            old_path_id,
            old_blob_oid,
            new_blob_oid,
            old_mode,
            new_mode,
            is_binary,
            insertions,
            deletions,
        }
    }
}
