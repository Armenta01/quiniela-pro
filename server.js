const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔥 CONEXIÓN POSTGRES (Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🔥 CREAR TABLAS AUTOMÁTICO
async function initDB() {
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

  console.log("🔥 DB lista en Postgres");
}

initDB();


// 🔥 OBTENER JORNADAS
app.get('/jornadas', async (req, res) => {
  const result = await pool.query(`
    SELECT DISTINCT jornada FROM partidos ORDER BY jornada
  `);
  res.json(result.rows);
});


// 🔥 PARTIDOS POR JORNADA
app.get('/partidos', async (req, res) => {
  const { jornada } = req.query;

  const result = await pool.query(
    `SELECT * FROM partidos WHERE jornada = $1 ORDER BY fecha`,
    [jornada]
  );

  res.json(result.rows);
});


// 🔥 GUARDAR PRONÓSTICOS
app.post('/guardar', async (req, res) => {
  const { nombre, jornada, pronosticos } = req.body;

  try {
    // Usuario
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

    // Limpiar anteriores
    await pool.query(
      `DELETE FROM predicciones WHERE user_id = $1 AND jornada = $2`,
      [userId, jornada]
    );

    // Insertar nuevos
    for (let p of pronosticos) {
      await pool.query(`
        INSERT INTO predicciones(user_id, partido_id, goles_local, goles_visitante, jornada)
        VALUES($1,$2,$3,$4,$5)
      `, [userId, p.partido_id, p.local, p.visitante, jornada]);
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error guardando' });
  }
});


// 🔥 TABLA DE POSICIONES
app.get('/tabla', async (req, res) => {
  const { jornada } = req.query;

  const result = await pool.query(`
    SELECT u.nombre,
    SUM(
      CASE 
        WHEN p.goles_local = pr.goles_local 
         AND p.goles_visitante = pr.goles_visitante THEN 3
        WHEN (p.goles_local > p.goles_visitante AND pr.goles_local > pr.goles_visitante)
          OR (p.goles_local < p.goles_visitante AND pr.goles_local < pr.goles_visitante)
          OR (p.goles_local = p.goles_visitante AND pr.goles_local = pr.goles_visitante)
        THEN 1
        ELSE 0
      END
    ) AS puntos
    FROM predicciones pr
    JOIN partidos p ON pr.partido_id = p.id
    JOIN users u ON pr.user_id = u.id
    WHERE pr.jornada = $1
    GROUP BY u.nombre
    ORDER BY puntos DESC
  `, [jornada]);

  res.json(result.rows);
});


// 🔥 CAMPEÓN
app.get('/campeon', async (req, res) => {
  const { jornada } = req.query;

  const result = await pool.query(`
    SELECT * FROM campeones WHERE jornada = $1
  `, [jornada]);

  res.json(result.rows[0] || {});
});


// 🔥 GUARDAR RESULTADOS (ADMIN)
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


// 🔥 PUERTO (IMPORTANTE EN RENDER)
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🔥 Servidor listo en puerto ${PORT}`);
});