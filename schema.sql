-- Stok barang (dipakai bersama)
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT DEFAULT '',
  qty REAL DEFAULT 1,
  in_date TEXT NOT NULL,
  out_date TEXT,
  note TEXT DEFAULT '',
  created_by TEXT
);

-- Kebiasaan harian
CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'check',
  target REAL DEFAULT 1,
  unit TEXT DEFAULT ''
);

-- Catatan harian per user
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  habit_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  UNIQUE(habit_id, email, date)
);

-- Meal plan mingguan
CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  slot TEXT NOT NULL DEFAULT 'siang',
  name TEXT NOT NULL,
  calories INTEGER DEFAULT 0,
  recipe_id INTEGER DEFAULT 0,
  note TEXT DEFAULT '',
  done INTEGER DEFAULT 0,
  created_by TEXT
);

-- Resep masak (owner='*' = terlihat semua user)
CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  categories TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  serves INTEGER DEFAULT 1,
  calories_per_serve INTEGER DEFAULT 0,
  created_by TEXT
);

-- Tracker umum bawaan
INSERT INTO habits (owner, name, kind, target, unit)
SELECT '*', 'Minum air', 'count', 8, 'gelas'
WHERE NOT EXISTS (SELECT 1 FROM habits WHERE owner = '*' AND name = 'Minum air');
