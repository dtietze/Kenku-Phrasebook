pub const CREATE_PHRASES: &str = "
    CREATE TABLE IF NOT EXISTS phrases (
        id TEXT PRIMARY KEY,
        text TEXT,
        source TEXT NOT NULL CHECK(source IN ('entered', 'recorded')),
        recording_path TEXT,
        speaker TEXT,
        language TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    )
";

pub const CREATE_TAGS: &str = "
    CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
    )
";

pub const CREATE_PHRASE_TAGS: &str = "
    CREATE TABLE IF NOT EXISTS phrase_tags (
        phrase_id TEXT NOT NULL REFERENCES phrases(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (phrase_id, tag_id)
    )
";

pub const CREATE_PHRASE_EMBEDDINGS: &str = "
    CREATE TABLE IF NOT EXISTS phrase_embeddings (
        phrase_id TEXT PRIMARY KEY REFERENCES phrases(id) ON DELETE CASCADE,
        embedding TEXT NOT NULL
    )
";

pub const CREATE_SCHEMA_VERSION: &str = "
    CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
    )
";