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

// 🔥 INIT DB + ÍNDICES
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

  // ⚡ performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_partidos_jornada ON partidos(jornada);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_predicciones_jornada ON predicciones(jornada);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_nombre ON users(nombre);`);

  console.log("🔥 DB + índices listos");
}

initDB();


// 🔒 BLOQUEO
async function jornadaBloqueada(jornada) {
  const result = await pool.query(
    `SELECT MIN(fecha) as fecha FROM partidos WHERE jornada = $1`,
    [jornada]
  );

  if (!result.rows[0].fecha) return false;

  const limite = new Date(result.rows[0].fecha);
  limite.setDate(limite.getDate() - 1);

  return new Date() >= limite;
}

async function obtenerCampeon(jornada) {

  // 🔍 verificar si ya terminaron los partidos
  const partidos = await pool.query(`
    SELECT COUNT(*) FILTER (WHERE goles_local IS NULL OR goles_visitante IS NULL) AS pendientes
    FROM partidos
    WHERE jornada = $1
  `, [jornada]);

  if (parseInt(partidos.rows[0].pendientes) > 0) {
    return []; // aún no hay campeón
  }

  // 🏆 obtener tabla
  const tabla = await fetchTabla(jornada);

  if (!tabla.length) return [];

  // 🔥 obtener mayor puntaje
  const maxPuntos = tabla[0].puntos;

  // 🔥 traer TODOS los que empatan
  const campeones = tabla.filter(u => u.puntos === maxPuntos);

  return campeones;
}


// 🔥 JORNADAS
app.get('/jornadas', async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT jornada FROM partidos ORDER BY jornada`
  );
  res.json(result.rows);
});


// 🔥 PARTIDOS
app.get('/partidos', async (req, res) => {
  const { jornada } = req.query;

  const result = await pool.query(
    `SELECT * FROM partidos WHERE jornada = $1 ORDER BY fecha`,
    [jornada]
  );

  res.json(result.rows);
});

app.get('/check-user', async (req, res) => {
  const { nombre, jornada } = req.query;

  const r = await pool.query(
    `SELECT COUNT(*) FROM users WHERE nombre=$1`,
    [nombre]
  );

  res.json({
    existe: parseInt(r.rows[0].count) > 0
  });
});



// 🔥 GUARDAR PRONÓSTICOS (FIX PRINCIPAL)
app.post('/guardar', async (req, res) => {
  const { nombre, jornada, pronosticos } = req.body;
  const envioId = Date.now().toString() + "_" + Math.random().toString(36).substring(2,8);
  
  try {
    if (!nombre || nombre.length < 2) {
      return res.status(400).json({ error: "Nombre inválido" });
    }

    if (await jornadaBloqueada(jornada)) {
      return res.status(403).json({ error: "Jornada cerrada" });
    }

    let user = await pool.query(
      `SELECT id FROM users WHERE nombre = $1`,
      [nombre]
    );

    let userId;

    if (user.rows.length === 0) {
      const newUser = await pool.query(
        `INSERT INTO users(nombre) VALUES($1) RETURNING id`,
        [nombre]
      );
      userId = newUser.rows[0].id;
    } else {
      userId = user.rows[0].id;
    }
// 🔥 validar si ya mandó EXACTAMENTE lo mismo
const existentes = await pool.query(
  `SELECT envio_id
   FROM predicciones pr
   JOIN users u ON pr.user_id = u.id
   WHERE u.nombre = $1 AND pr.jornada = $2
   GROUP BY envio_id`,
  [nombre, jornada]
);

for (let envio of existentes.rows) {
  const rows = await pool.query(
    `SELECT goles_local, goles_visitante 
     FROM predicciones 
     WHERE envio_id = $1`,
    [envio.envio_id]
  );

  const viejo = JSON.stringify(
    rows.rows.map(x => ({
      local: x.goles_local,
      visitante: x.goles_visitante
    }))
  );

  const nuevo = JSON.stringify(pronosticos);

  if (viejo === nuevo) {
    return res.status(400).json({ error: "Ya enviaste esta misma quiniela" });
  }
}

// convertir lista actual a string para comparar
const nuevo = JSON.stringify(pronosticos);

const viejo = JSON.stringify(
  existentes.rows.map(x => ({
    local: x.goles_local,
    visitante: x.goles_visitante
  }))
);

if (nuevo === viejo) {
  return res.status(400).json({ error: "Ya enviaste esta misma quiniela" });
}

    // 🔥 FIX AQUÍ (error de integer "")
    for (let p of pronosticos) {

  const goles_local = p.local === "" ? null : parseInt(p.local);
  const goles_visitante = p.visitante === "" ? null : parseInt(p.visitante);

  await pool.query(`
    INSERT INTO predicciones
    (user_id, partido_id, goles_local, goles_visitante, jornada, envio_id)
    VALUES($1,$2,$3,$4,$5,$6)
  `, [userId, p.partido_id, goles_local, goles_visitante, jornada, envioId]);
}

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post('/admin/resultado', async (req, res) => {
  try {
    const { partido_id, goles_local, goles_visitante } = req.body;

    await pool.query(
      `UPDATE partidos 
       SET goles_local = $1, goles_visitante = $2
       WHERE id = $3`,
      [goles_local, goles_visitante, partido_id]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar resultado' });
  }
});


// 🔥 TABLA
function calcularPuntos(p, pr) {
  if (p.goles_local === pr.goles_local && p.goles_visitante === pr.goles_visitante) return 3;

  if (
    (p.goles_local > p.goles_visitante && pr.goles_local > pr.goles_visitante) ||
    (p.goles_local < p.goles_visitante && pr.goles_local < pr.goles_visitante) ||
    (p.goles_local === p.goles_visitante && pr.goles_local === pr.goles_visitante)
  ) return 1;

  return 0;
}

async function limpiarSemanaCiclo(jornada) {

  const MAX_SEMANAS = 20;

  if (jornada <= MAX_SEMANAS) return;

  const semanaEliminar = jornada - MAX_SEMANAS;

  console.log("🧹 Eliminando semana:", semanaEliminar);

  await pool.query(`DELETE FROM predicciones WHERE jornada = $1`, [semanaEliminar]);

  await pool.query(`DELETE FROM partidos WHERE jornada = $1`, [semanaEliminar]);

  // ❗ NO borres campeones (historial)
}

async function fetchTabla(jornada) {
  const result = await pool.query(`
    SELECT pr.envio_id, u.nombre,
           p.goles_local, p.goles_visitante,
           pr.goles_local AS pr_local,
           pr.goles_visitante AS pr_visitante
    FROM predicciones pr
    JOIN partidos p ON pr.partido_id = p.id
    JOIN users u ON pr.user_id = u.id
    WHERE pr.jornada = $1
    ORDER BY pr.envio_id
  `, [jornada]);

  const tabla = {};

  result.rows.forEach(row => {
    if (!tabla[row.envio_id]) {
      tabla[row.envio_id] = {
        nombre: row.nombre,
        puntos: 0,
        detalles: [],
        picks: []
      };
    }

    // ⚪ SIN RESULTADO
    if (row.goles_local == null || row.goles_visitante == null) {
      tabla[row.envio_id].detalles.push("gris");
      tabla[row.envio_id].picks.push(`${row.pr_local}-${row.pr_visitante}`);
      return;
    }

    // 🟢 3 pts
    if (row.goles_local === row.pr_local && row.goles_visitante === row.pr_visitante) {
      tabla[row.envio_id].puntos += 3;
      tabla[row.envio_id].detalles.push("verde");
    tabla[row.envio_id].picks.push(`${row.pr_local}-${row.pr_visitante}`);
    }

    // 🟡 1 pt
    else if (
      (row.goles_local > row.goles_visitante && row.pr_local > row.pr_visitante) ||
      (row.goles_local < row.goles_visitante && row.pr_local < row.pr_visitante) ||
      (row.goles_local === row.goles_visitante && row.pr_local === row.pr_visitante)
    ) {
      tabla[row.envio_id].puntos += 1;
      tabla[row.envio_id].detalles.push("amarillo");
      tabla[row.envio_id].picks.push(`${row.pr_local}-${row.pr_visitante}`);
    }

    // 🔴 0 pts
    else {
      tabla[row.envio_id].detalles.push("rojo");
      tabla[row.envio_id].picks.push(`${row.pr_local}-${row.pr_visitante}`);
    }
  });

return Object.values(tabla)
  .sort((a, b) => b.puntos - a.puntos);
}


app.get('/tabla', async (req, res) => {
  const { jornada } = req.query;
  const tabla = await fetchTabla(jornada);
  res.json(tabla);
});


// 🏆 TOP 4
app.get('/top4', async (req, res) => {
  const { jornada } = req.query;
  const tabla = await fetchTabla(jornada);
  res.json(tabla.slice(0, 4));
});


// 🏆 CAMPEÓN (FIX duplicado)
app.post('/admin/cerrar-jornada', async (req, res) => {
  const { jornada } = req.body;

  const existe = await pool.query(
    `SELECT 1 FROM campeones WHERE jornada = $1`,
    [jornada]
  );

  if (existe.rows.length > 0) {
    return res.json({ msg: "Ya existe campeón" });
  }

  const tabla = await fetchTabla(jornada);

  if (tabla.length === 0) return res.json({});

  const ganador = tabla[0];

  await pool.query(`
    INSERT INTO campeones(jornada, nombre, puntos)
    VALUES($1,$2,$3)
  `, [jornada, ganador.nombre, ganador.puntos]);

  res.json(ganador);
});


// 🔥 RESULTADOS ADMIN (FIX integer)
app.post('/admin/resultados', async (req, res) => {
  const { resultados } = req.body;

  for (let r of resultados) {

    const gl = r.local === "" ? null : parseInt(r.local);
    const gv = r.visitante === "" ? null : parseInt(r.visitante);

    await pool.query(`
      UPDATE partidos
      SET goles_local = $1, goles_visitante = $2
      WHERE id = $3
    `, [gl, gv, r.partido_id]);
  }

  res.json({ ok: true });
});


// 🔥 LÍMITE
app.get('/limite', async (req, res) => {
  try {
    const { jornada } = req.query;

    // 🔥 traer el primer partido de la jornada
    const r = await pool.query(`
      SELECT fecha 
      FROM partidos 
      WHERE jornada = $1
      ORDER BY fecha ASC
      LIMIT 1
    `, [jornada]);

    if (r.rows.length === 0) {
      return res.json({ bloqueada: false });
    }

    const fechaPartido = new Date(r.rows[0].fecha);

    // 🔥 restar 1 día
    const limite = new Date(fechaPartido);
    limite.setDate(limite.getDate() - 1);

    const ahora = new Date();

    // 🔥 comparación real
    const bloqueada = ahora >= limite;

    res.json({
      bloqueada,
      limite,
      ahora
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'error limite' });
  }
});

app.post('/reset', async (req, res) => {
  try {

    await pool.query('DELETE FROM predicciones');
    await pool.query('DELETE FROM partidos');

    // 🔥 OPCIONAL (si quieres borrar historial)
    // await pool.query('DELETE FROM campeones');

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al resetear" });
  }
});

app.post('/admin/partidos', async (req, res) => {
 const { local, visitante, fecha, jornada, liga, logo_local, logo_visitante } = req.body;
  try {
    await pool.query(`
  INSERT INTO partidos
  (local, visitante, fecha, jornada, liga, logo_local, logo_visitante)
  VALUES ($1,$2,$3,$4,$5,$6,$7)
`, [local, visitante, fecha, jornada, liga, logo_local, logo_visitante]);
    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error" });
  }
});


// 🚀 SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🔥 SERVIDOR PRO corriendo en ${PORT}`);
});