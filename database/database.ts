
import * as SQLite from 'expo-sqlite';

export async function initializeDatabase(
  db: SQLite.SQLiteDatabase
) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      totalPages INTEGER NOT NULL,
      currentPage INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Quero ler',
      coverUri TEXT
    );
  `);

  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(books)'
  );

  const hasCoverUri = columns.some(
    (column) => column.name === 'coverUri'
  );

  if (!hasCoverUri) {
    await db.execAsync(`
      ALTER TABLE books ADD COLUMN coverUri TEXT;
    `);
  }

  const bookColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(books)'
  );

  if (!bookColumns.some((column) => column.name === 'fileUri')) {
    await db.execAsync('ALTER TABLE books ADD COLUMN fileUri TEXT');
  }
  if (!bookColumns.some((column) => column.name === 'fileType')) {
    await db.execAsync('ALTER TABLE books ADD COLUMN fileType TEXT');
  }
  if (!bookColumns.some((column) => column.name === 'readerPosition')) {
    await db.execAsync('ALTER TABLE books ADD COLUMN readerPosition TEXT');
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS readerBookmarks (
      bookId INTEGER NOT NULL,
      position TEXT NOT NULL,
      currentPage INTEGER NOT NULL,
      label TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (bookId, position),
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS readerHighlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookId INTEGER NOT NULL,
      format TEXT NOT NULL,
      page INTEGER NOT NULL,
      anchor TEXT NOT NULL,
      quote TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );
  `);

  if (!bookColumns.some((column) => column.name === 'startedAt')) {
    await db.execAsync('ALTER TABLE books ADD COLUMN startedAt TEXT');
  }

  if (!bookColumns.some((column) => column.name === 'completedAt')) {
    await db.execAsync('ALTER TABLE books ADD COLUMN completedAt TEXT');
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookId INTEGER NOT NULL,
      content TEXT NOT NULL,
      referenceType TEXT,
      referenceValue TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );
  `);

  const reflectionColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(reflections)'
  );
  if (!reflectionColumns.some((column) => column.name === 'referenceType')) {
    await db.execAsync('ALTER TABLE reflections ADD COLUMN referenceType TEXT');
  }
  if (!reflectionColumns.some((column) => column.name === 'referenceValue')) {
    await db.execAsync('ALTER TABLE reflections ADD COLUMN referenceValue TEXT');
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS readingActivities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookId INTEGER NOT NULL,
      fromPage INTEGER NOT NULL,
      toPage INTEGER NOT NULL,
      pagesRead INTEGER NOT NULL DEFAULT 0,
      durationMinutes INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS localProfile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      displayName TEXT NOT NULL DEFAULT 'Leitor Bentora'
    );
    INSERT OR IGNORE INTO localProfile (id, displayName) VALUES (1, 'Leitor Bentora');
  `);
}
