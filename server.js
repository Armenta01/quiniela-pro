const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🔥 INIT DB
async function initDB() {
  // 🔥 TABLAS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      nombre TEXT UNIQUE NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS partidos (
      id SERIAL PRIMARY KEY,
      local TEXT,
      visitante TEXT,
      fecha TIMESTAMP,
      logo_local TEXT,
      logo_visitante TEXT,
      goles_local INTEGER,
      goles_visitante INTEGER,
      jornada INTEGER
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS predicciones (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE,
      goles_local INTEGER,
      goles_visitante INTEGER,
      jornada INTEGER
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campeones (
      id SERIAL PRIMARY KEY,
      jornada INTEGER,
      nombre TEXT,
      puntos INTEGER
    );
  `);

  // ⚡ ÍNDICES (rendimiento PRO)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_partidos_jornada ON partidos(jornada);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_predicciones_jornada ON predicciones(jornada);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_nombre ON users(nombre);
  `);

  console.log("🔥 DB + índices listos");
}

initDB();


// 🔒 VALIDAR BLOQUEO (1 día antes del primer partido)
async function jornadaBloqueada(jornada) {
  const result = await pool.query(`
    SELECT MIN(fecha) as fecha FROM partidos WHERE jornada = $1
  `, [jornada]);

  if (!result.rows[0].fecha) return false;

  const limite = new Date(result.rows[0].fecha);
  limite.setDate(limite.getDate() - 1);

  return new Date() >= limite;
}


// 🔥 JORNADAS
app.get('/jornadas', async (req, res) => {
  const result = await pool.query(`
    SELECT DISTINCT jornada FROM partidos ORDER BY jornada
  `);
  res.json(result.rows);
});


// 🔥 PARTIDOS
app.get('/partidos', async (req, res) => {
  const { jornada } = req.query;

  const result = await pool.query(`
    SELECT * FROM partidos WHERE jornada = $1 ORDER BY fecha
  `, [jornada]);

  res.json(result.rows);
});


// 🔥 GUARDAR PRONÓSTICOS
app.post('/guardar', async (req, res) => {
  const { nombre, jornada, pronosticos } = req.body;

  try {
    if (await jornadaBloqueada(jornada)) {
      return res.status(400).json({ error: "Jornada bloqueada" });
    }

    // usuario único
    let user = await pool.query(
      `SELECT * FROM users WHERE nombre = $1`,
      [nombre]
    );

    if (user.rows.length === 0) {
      user = await pool.query(
        `INSERT INTO users(nombre) VALUES($1) RETURNING *`,
        [nombre]
      );
    }

    const userId = user.rows[0].id;

    // borrar previos
    await pool.query(`
      DELETE FROM predicciones WHERE user_id = $1 AND jornada = $2
    `, [userId, jornada]);

    // insertar
    for (let p of pronosticos) {
      await pool.query(`
        INSERT INTO predicciones(user_id, partido_id, goles_local, goles_visitante, jornada)
        VALUES($1,$2,$3,$4,$5)
      `, [userId, p.partido_id, p.local, p.visitante, jornada]);
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando" });
  }
});


// 🔥 TABLA GENERAL
function calcularPuntos(p, pr) {
  if (p.goles_local === pr.goles_local && p.goles_visitante === pr.goles_visitante) return 3;

  if (
    (p.goles_local > p.goles_visitante && pr.goles_local > pr.goles_visitante) ||
    (p.goles_local < p.goles_visitante && pr.goles_local < pr.goles_visitante) ||
    (p.goles_local === p.goles_visitante && pr.goles_local === pr.goles_visitante)
  ) return 1;

  return 0;
}

app.get('/tabla', async (req, res) => {
  const { jornada } = req.query;

  const result = await pool.query(`
    SELECT u.nombre, p.*, pr.goles_local as pr_local, pr.goles_visitante as pr_visitante
    FROM predicciones pr
    JOIN partidos p ON pr.partido_id = p.id
    JOIN users u ON pr.user_id = u.id
    WHERE pr.jornada = $1
  `, [jornada]);

  const tabla = {};

  result.rows.forEach(row => {
    if (!tabla[row.nombre]) tabla[row.nombre] = 0;

    tabla[row.nombre] += calcularPuntos(row, {
      goles_local: row.pr_local,
      goles_visitante: row.pr_visitante
    });
  });

  const ordenado = Object.entries(tabla)
    .map(([nombre, puntos]) => ({ nombre, puntos }))
    .sort((a, b) => b.puntos - a.puntos);

  res.json(ordenado);
});


// 🏆 TOP 4
app.get('/top4', async (req, res) => {
  const { jornada } = req.query;

  const tabla = await fetchTabla(jornada);
  res.json(tabla.slice(0, 4));
});


// 🧠 helper
async function fetchTabla(jornada) {
  const result = await pool.query(`
    SELECT u.nombre, p.*, pr.goles_local as pr_local, pr.goles_visitante as pr_visitante
    FROM predicciones pr
    JOIN partidos p ON pr.partido_id = p.id
    JOIN users u ON pr.user_id = u.id
    WHERE pr.jornada = $1
  `, [jornada]);

  const tabla = {};

  result.rows.forEach(row => {
    if (!tabla[row.nombre]) tabla[row.nombre] = 0;

    tabla[row.nombre] += calcularPuntos(row, {
      goles_local: row.pr_local,
      goles_visitante: row.pr_visitante
    });
  });

  return Object.entries(tabla)
    .map(([nombre, puntos]) => ({ nombre, puntos }))
    .sort((a, b) => b.puntos - a.puntos);
}


// 🏆 GENERAR CAMPEÓN AUTOMÁTICO
app.post('/admin/cerrar-jornada', async (req, res) => {
  const { jornada } = req.body;

  const tabla = await fetchTabla(jornada);

  if (tabla.length === 0) return res.json({});

  const ganador = tabla[0];

  await pool.query(`
    INSERT INTO campeones(jornada, nombre, puntos)
    VALUES($1,$2,$3)
  `, [jornada, ganador.nombre, ganador.puntos]);

  res.json(ganador);
});


// 🔥 RESULTADOS ADMIN
app.post('/admin/resultados', async (req, res) => {
  const { resultados } = req.body;

  for (let r of resultados) {
    await pool.query(`
      UPDATE partidos
      SET goles_local = $1, goles_visitante = $2
      WHERE id = $3
    `, [r.local, r.visitante, r.partido_id]);
  }

  res.json({ ok: true });
});


// 🔥 LÍMITE (para frontend)
app.get('/limite', async (req, res) => {
  const { jornada } = req.query;

  const bloqueada = await jornadaBloqueada(jornada);
  res.json({ bloqueada });
});


// 🚀 PORT
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🔥 SERVIDOR PRO corriendo en ${PORT}`);
});