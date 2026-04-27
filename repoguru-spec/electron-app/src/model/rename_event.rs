use gix::ObjectId;

/// Row layout for `tables/rename_events.bin` (§6.4.3).
/// Total size: 20+20+4+4+2+1 = 51 bytes
pub const RENAME_EVENT_ROW_SIZE: usize = 51;

#[derive(Debug, Clone)]
pub struct RenameEvent {
    pub commit_oid: ObjectId, // 20
    pub parent_oid: ObjectId, // 20
    pub old_path_id: u32,     // 4
    pub new_path_id: u32,     // 4
    pub score: u16,           // 2
    pub is_copy: u8,          // 1
}

impl RenameEvent {
    pub fn to_bytes(&self) -> [u8; RENAME_EVENT_ROW_SIZE] {
        let mut buf = [0u8; RENAME_EVENT_ROW_SIZE];
        let mut pos = 0;

        buf[pos..pos + 20].copy_from_slice(self.commit_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 20].copy_from_slice(self.parent_oid.as_bytes());
        pos += 20;
        buf[pos..pos + 4].copy_from_slice(&self.old_path_id.to_le_bytes());
        pos += 4;
        buf[pos..pos + 4].copy_from_slice(&self.new_path_id.to_le_bytes());
        pos += 4;
        buf[pos..pos + 2].copy_from_slice(&self.score.to_le_bytes());
        pos += 2;
        buf[pos] = self.is_copy;

        buf
    }

    pub fn from_bytes(data: &[u8; RENAME_EVENT_ROW_SIZE]) -> Self {
        let mut pos = 0;

        let commit_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let parent_oid = ObjectId::from_bytes_or_panic(&data[pos..pos + 20]);
        pos += 20;
        let old_path_id = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let new_path_id = u32::from_le_bytes(data[pos..pos + 4].try_into().expect("4 bytes"));
        pos += 4;
        let score = u16::from_le_bytes(data[pos..pos + 2].try_into().expect("2 bytes"));
        pos += 2;
        let is_copy = data[pos];

        RenameEvent {
            commit_oid,
            parent_oid,
            old_path_id,
            new_path_id,
            score,
            is_copy,
        }
    }
}
