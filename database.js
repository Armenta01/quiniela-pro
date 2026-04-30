const Database = require('better-sqlite3');
const db = new Database('quiniela.db');

module.exports = db;


// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS partidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local TEXT,
    visitante TEXT,
    fecha TEXT,
    logo_local TEXT,
    logo_visitante TEXT,
    goles_local INTEGER,
    goles_visitante INTEGER,
    jornada INTEGER
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS predicciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    partido_id INTEGER,
    goles_local INTEGER,
    goles_visitante INTEGER
  );
`);

module.exports = db;