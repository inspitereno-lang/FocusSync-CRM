import Database from "@tauri-apps/plugin-sql";
import bcrypt from "bcryptjs";

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  try {
    if (!dbInstance) {
      console.log("Loading FocusSync SQLite database...");
      dbInstance = await Database.load("sqlite:focussync.db");
      console.log("Database loaded successfully.");
    }
    return dbInstance;
  } catch (error) {
    console.error("CRITICAL: Failed to load database!", error);
    throw error;
  }
}

export async function initDb() {
  try {
    const db = await getDb();
    // 0. Enable WAL mode for high concurrency
    await db.execute("PRAGMA journal_mode=WAL");
    
    // 1. Create Base Tables if they don't exist
    await db.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL, department TEXT NOT NULL, avatar TEXT NOT NULL, initials TEXT NOT NULL, password TEXT NOT NULL, focusScore INTEGER DEFAULT 0, todayHours REAL DEFAULT 0, currentTask TEXT DEFAULT '')");
    await db.execute("CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL, focus_time INTEGER DEFAULT 0, priority TEXT NOT NULL, assignee_email TEXT)");
    await db.execute("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, login_time DATETIME DEFAULT CURRENT_TIMESTAMP, logout_time DATETIME, last_ping DATETIME DEFAULT CURRENT_TIMESTAMP, total_minutes INTEGER DEFAULT 0)");
    await db.execute("CREATE TABLE IF NOT EXISTS proctoring_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, event_type TEXT NOT NULL, start_time DATETIME DEFAULT CURRENT_TIMESTAMP, end_time DATETIME, duration_seconds INTEGER DEFAULT 0)");
    await db.execute("CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, user_name TEXT NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL, time DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT NOT NULL, synced INTEGER DEFAULT 0)");
    await db.execute("CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, receiver_id TEXT NOT NULL, content TEXT NOT NULL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, is_read INTEGER DEFAULT 0, synced INTEGER DEFAULT 0)");

    // 2. Migration Helper with logging
    const addColumn = async (table: string, column: string, type: string, defaultVal?: string) => {
      try {
        const info = await db.select<any[]>(`PRAGMA table_info(${table})`);
        const exists = info.some(c => c.name === column);
        if (!exists) {
          console.log(`Adding column ${column} to ${table}...`);
          await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defaultVal ? ` DEFAULT ${defaultVal}` : ''}`);
        }
      } catch (e) {
        console.error(`Migration failed for ${table}.${column}:`, e);
      }
    };

    // Ensure columns exist (Migrations)
    await addColumn('users', 'manager_id', 'TEXT');
    await addColumn('users', 'last_cloud_sync', 'DATETIME');
    await addColumn('users', 'updated_at', "DATETIME", "'2026-01-01 00:00:00'");
    await addColumn('users', 'synced', "INTEGER", "0");
    
    await addColumn('users', 'is_deleted', "INTEGER", "0");
    
    await addColumn('tasks', 'subtasks', "TEXT", "'[]'");
    await addColumn('tasks', 'started_at', "DATETIME");
    await addColumn('tasks', 'is_running', "INTEGER", "0");
    await addColumn('tasks', 'created_at', "DATETIME", "'2026-01-01 00:00:00'");
    await addColumn('tasks', 'updated_at', "DATETIME", "'2026-01-01 00:00:00'");
    await addColumn('tasks', 'last_cloud_sync', 'DATETIME');
    await addColumn('tasks', 'synced', "INTEGER", "0");
    await addColumn('tasks', 'description', "TEXT");
    await addColumn('tasks', 'owner_email', "TEXT");
    await addColumn('tasks', 'due_date', "DATETIME");
    await addColumn('tasks', 'is_deleted', "INTEGER", "0");
    await addColumn('tasks', 'completion_notes', "TEXT");
    await addColumn('tasks', 'has_issue', "INTEGER", "0");
    await addColumn('tasks', 'issue_description', "TEXT");

    await addColumn('sessions', 'synced', "INTEGER", "0");
    await addColumn('sessions', 'last_cloud_sync', 'DATETIME');
    await addColumn('sessions', 'updated_at', "DATETIME", "'2026-01-01 00:00:00'");
    await addColumn('sessions', 'total_keystrokes', "INTEGER", "0");
    await addColumn('sessions', 'face_missing_duration', "INTEGER", "0");
    await addColumn('sessions', 'integrity_score', "INTEGER", "100");

    await addColumn('proctoring_events', 'synced', "INTEGER", "0");
    await addColumn('proctoring_events', 'last_cloud_sync', 'DATETIME');
    await addColumn('proctoring_events', 'updated_at', "DATETIME", "'2026-01-01 00:00:00'");

    await addColumn('activities', 'synced', "INTEGER", "0");
    await addColumn('activities', 'last_cloud_sync', 'DATETIME');

    // 3. (Optional) Manual Seed Check - Create Initial Admin if empty
    const usersResult = await db.select<any[]>("SELECT id FROM users LIMIT 1");
    if (usersResult.length === 0) {
      console.log("Database is empty. Seeding initial System Admin...");
      await db.execute(`
        INSERT INTO users (id, name, email, role, status, department, avatar, initials, password)
        VALUES 
        ('adm-001', 'System Admin', 'admin@focussync.com', 'admin', 'active', 'IT', '#f59e0b', 'SA', '${bcrypt.hashSync("admin123", 10)}')
      `);
    }
    // 4. Seed Initial Activities for Manager Dashboard continuity
    const activityResult = await db.select<any[]>("SELECT id FROM activities LIMIT 1");
    if (activityResult.length === 0) {
      console.log("Seeding initial activities...");
      await db.execute(`
        INSERT INTO activities (id, user_name, user_id, action, time, status)
        VALUES 
        ('act-1', 'Sarah Chen', 'sarah@focussync.com', 'completed API Integration module', datetime('now', '-2 minutes'), 'online'),
        ('act-2', 'Marcus Johnson', 'marcus@focussync.com', 'started Dashboard v2', datetime('now', '-5 minutes'), 'online'),
        ('act-3', 'David Kim', 'david@focussync.com', 'pushed 14 commits', datetime('now', '-12 minutes'), 'online'),
        ('act-4', 'Jordan Rivera', 'jordan@focussync.com', 'finished API Documentation', datetime('now', '-15 minutes'), 'online'),
        ('act-5', 'Aisha Patel', 'aisha@focussync.com', 'scheduled client meeting', datetime('now', '-18 minutes'), 'away'),
        ('act-6', 'Lisa Wong', 'lisa@focussync.com', 'signed off', datetime('now', '-45 minutes'), 'offline')
      `);
    }
  } catch (error) {
    console.error("Failed to initialize database", error);
  }
}
export async function resilientExecute(sql: string, params: any[] = [], retries = 5): Promise<any> {
  const db = await getDb();
  try {
    return await db.execute(sql, params);
  } catch (error: any) {
    const msg = String(error);
    if (msg.includes("database is locked") && retries > 0) {
      console.warn(`DB Locked. Retrying in 500ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return resilientExecute(sql, params, retries - 1);
    }
    throw error;
  }
}
