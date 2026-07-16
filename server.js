require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const fetch = require('node-fetch');
const moment = require('moment-timezone');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


// 🔥 DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com")
    ? { rejectUnauthorized: false }
    : false
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
    jornada INTEGER,
    orden INTEGER NOT NULL,
    liga TEXT
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

initDB().catch(err => {
  console.error("🔥 ERROR INIT DB:", err);
});

// 🔒 BLOQUEO
async function jornadaBloqueada(jornada) {

  const result = await pool.query(
    `SELECT MIN(fecha) as fecha 
    FROM partidos 
    WHERE jornada = $1`,
    [jornada]
  );

  if (!result.rows[0].fecha) return false;

  const fechaPartido = moment.tz(
    result.rows[0].fecha,
    "America/Mexico_City"
  );

 const limite = fechaPartido
  .clone()
  .subtract(1, 'day')
  .hour(22)
  .minute(0)
  .second(0);

  const ahora = moment.tz("America/Mexico_City");

  return ahora.isAfter(limite);
}

async function obtenerCampeon(jornada) {

  // 🔍 verificar si ya terminaron los partidos
  const partidos = await pool.query(`
    SELECT COUNT(*) FILTER (
      WHERE goles_local IS NULL
      OR goles_visitante IS NULL
    ) AS pendientes
    FROM partidos
    WHERE jornada = $1
  `, [jornada]);

  // 🥇 Si aún hay partidos pendientes → líderes
  if (parseInt(partidos.rows[0].pendientes) > 0) {

    const tabla = await fetchTabla(jornada);

    if (!tabla.length) return [];

    const maxPuntos = tabla[0].puntos;

    const lideres = tabla.filter(
      u => u.puntos === maxPuntos
    );

    lideres.forEach(l => {
      l.estado = "lider";
    });

    return lideres;
  }

  // 🏆 Jornada terminada → campeones
  const tabla = await fetchTabla(jornada);

  if (!tabla.length) return [];

  const maxPuntos = tabla[0].puntos;

  const campeones = tabla.filter(
    u => u.puntos === maxPuntos
  );

  for (const c of campeones) {

    await pool.query(`
      INSERT INTO campeones
      (jornada, nombre, puntos)
      VALUES ($1,$2,$3)
      ON CONFLICT (jornada,nombre)
      DO NOTHING
    `, [
      jornada,
      c.nombre,
      c.puntos
    ]);

    c.estado = "campeon";
  }

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

  const result = await pool.query(`
    SELECT 
      id,
      local,
      visitante,
      TO_CHAR(fecha, 'YYYY-MM-DD HH24:MI') as fecha,
      logo_local,
      logo_visitante,
      goles_local,
      goles_visitante,
      jornada,
      liga
    FROM partidos
    WHERE jornada = $1
    ORDER BY orden
  `, [jornada]);

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
 let { nombre, telefono, jornada, pronosticos } = req.body;

nombre = nombre.trim();
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
    `INSERT INTO users(nombre, telefono)
      VALUES($1, $2)
      RETURNING id`,
      [nombre, telefono]
  );
  userId = newUser.rows[0].id;
} else {
  userId = user.rows[0].id;
}

// 🔥 validar si ya mandó EXACTfAMENTE lo mismo
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
    (
      user_id,
      partido_id,
      goles_local,
      goles_visitante,
      jornada,
      envio_id,
      telefono
    )
    VALUES($1,$2,$3,$4,$5,$6,$7)
`, [
    userId,
    p.partido_id,
    goles_local,
    goles_visitante,
    jornada,
    envioId,
    telefono
]);
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

app.post('/recordatorio/enviado', async (req, res) => {

  const { id } = req.body;

  try {

    await pool.query(
      `
      UPDATE users
      SET
        recordatorio_enviado = TRUE,
        fecha_recordatorio = NOW()
      WHERE id = $1
      `,
      [id]
    );

    res.json({ ok: true });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'No se pudo actualizar'
    });

  }

});


app.delete('/admin/partido/:id', async (req, res) => {

  try {

    const id = req.params.id;

    await pool.query(
      `DELETE FROM partidos WHERE id = $1`,
      [id]
    );

    res.json({ ok: true });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Error eliminando partido'
    });

  }

});

app.put('/admin/partido/:id', async (req, res) => {

  try {

    const { id } = req.params;

    const {
      local,
      visitante,
      fecha,
      jornada,
      liga,
      logo_local,
      logo_visitante
    } = req.body;

    const fechaMexico =
      fecha.replace('T', ' ') + ':00';

    await pool.query(`
      UPDATE partidos
      SET
        local = $1,
        visitante = $2,
        fecha = $3,
        jornada = $4,
        liga = $5,
        logo_local = $6,
        logo_visitante = $7
      WHERE id = $8
    `, [
      local,
      visitante,
      fechaMexico,
      jornada,
      liga,
      logo_local,
      logo_visitante,
      id
    ]);

    res.json({ ok: true });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'Error actualizando partido'
    });

  }

});



// 🔥 TABLA
function calcularPuntos(p, pr) {
  if (p.goles_local === pr.goles_local && p.goles_visitante === pr.goles_visitante) return 2;

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
    ORDER BY pr.envio_id, pr.partido_id`, 
    [jornada]);

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

    // 🟢 2 pts
    if (row.goles_local === row.pr_local && row.goles_visitante === row.pr_visitante) {
      tabla[row.envio_id].puntos += 2;
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

app.get('/admin/participantes', async (req, res) => {

  try {

    const { jornada } = req.query;

    const result = await pool.query(`
  SELECT DISTINCT ON (pr.envio_id)
     u.nombre,
     pr.telefono,
     pr.fecha_envio,
     pr.envio_id
  FROM predicciones pr
  JOIN users u
    ON pr.user_id = u.id
  WHERE pr.jornada = $1
  ORDER BY pr.envio_id, pr.fecha_envio DESC
    `, [jornada]);

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Error participantes"
    });

  }

});

// 📝 Jugadores con quiniela de una jornada
app.get('/admin/jugadores', async (req, res) => {

    try{

        const { jornada } = req.query;

        const result = await pool.query(`

            SELECT

                MIN(u.id) AS id,

                u.nombre,

                p.envio_id

                MIN(p.fecha_envio) AS fecha_envio

            FROM predicciones p

            INNER JOIN users u
                ON u.id = p.user_id

            WHERE p.jornada = $1

            GROUP BY
                u.nombre,
                p.envio_id

            ORDER BY
                u.nombre,
                MIN(p.fecha_envio)

        `,[jornada]);

        res.json(result.rows);

    }catch(err){

        console.error(err);

        res.status(500).json({
            error:err.message
        });

    }

});



// 📝 Obtener pronósticos de un jugador
app.get('/admin/pronosticos', async (req, res) => {

  try {

    const { jornada, envio_id } = req.query;

    const result = await pool.query(`
      SELECT
        p.id AS partido_id,
        p.local,
        p.visitante,
        pr.goles_local,
        pr.goles_visitante
      FROM predicciones pr
      INNER JOIN partidos p
        ON pr.partido_id = p.id
      WHERE
        pr.envio_id = $1
        AND pr.jornada = $2
      ORDER BY p.orden
    `, [envio_id, jornada]);

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});

// 📝 Guardar cambios de pronósticos
app.post('/admin/editar-pronosticos', async (req, res) => {
  console.log(req.body);

    const { envio_id, jornada, pronosticos } = req.body;

    const client = await pool.connect();

try{

    const primerPartido = await client.query(`
    SELECT fecha
    FROM partidos
    WHERE jornada = $1
    ORDER BY fecha ASC
    LIMIT 1
`, [jornada]);

if (primerPartido.rows.length > 0) {

    const inicio = new Date(primerPartido.rows[0].fecha);

    console.log("Hora servidor:", new Date());
    console.log("Fecha partido:", inicio);
    console.log("Valor BD:", primerPartido.rows[0].fecha);

    if (new Date() >= inicio) {

        return res.status(403).json({
            ok: false,
            error: "La jornada ya inició. La edición está bloqueada."
        });

    }

}

        await client.query('BEGIN');

        for(const p of pronosticos){
          console.log(p);

            await client.query(`
                UPDATE predicciones
                SET
                  goles_local = $1,
                  goles_visitante = $2
                WHERE
                  envio_id = $3
                  AND partido_id = $4
            `,[
                p.goles_local,
                p.goles_visitante,
                envio_id,
                p.partido_id
            ]);

        }

        await client.query('COMMIT');

        res.json({
            ok:true
        });

    }catch(err){

        await client.query('ROLLBACK');

        console.error(err);

        res.status(500).json({
            ok:false,
            error:err.message
        });

    }finally{

        client.release();

    }

});

app.get('/admin/estado-edicion', async (req, res) => {

    try{

        const { jornada } = req.query;

        const result = await pool.query(`
            SELECT fecha
            FROM partidos
            WHERE jornada = $1
            ORDER BY fecha ASC
            LIMIT 1
        `,[jornada]);

        if(result.rows.length === 0){

            return res.json({
                abierta:true
            });

        }

        const primerPartido =
            new Date(result.rows[0].fecha);

        const ahora =
            new Date();

        res.json({

            abierta: ahora < primerPartido,

            fechaPrimerPartido: primerPartido

        });

    }catch(err){

        console.error(err);

        res.status(500).json({
            error:err.message
        });

    }

});

// 🏆 TOP 4
app.get('/top4', async (req, res) => {
  const { jornada } = req.query;
  const tabla = await fetchTabla(jornada);
  res.json(tabla.slice(0, 4));
});

app.get('/campeon', async (req, res) => {
  try {

    const { jornada } = req.query;

    const campeones = await obtenerCampeon(jornada);

    res.json(campeones);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo campeón" });
  }
});

app.get('/historial-campeones', async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT jornada, nombre, puntos
      FROM campeones
      ORDER BY jornada DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error obteniendo historial'
    });
  }
});

app.get('/ranking-historico', async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        nombre,
        COUNT(*) AS titulos
      FROM campeones
      GROUP BY nombre
      ORDER BY titulos DESC, nombre ASC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Error ranking'
    });
  }
});

app.get('/bolsa', async (req, res) => {
  try {

    const { jornada } = req.query;

    const result = await pool.query(`
      SELECT COUNT(DISTINCT envio_id) AS participantes
      FROM predicciones
      WHERE jornada = $1
    `, [jornada]);

    const participantes =
  parseInt(result.rows[0].participantes || 0);

const recaudado = participantes * 50;

const administracion = recaudado * 0.20;

const bolsaPremios = recaudado * 0.80;

let primerLugar = 0;
let segundoLugar = 0;

// 👥 Hasta 200 participantes: un solo premio
if (participantes <= 750) {

  primerLugar = bolsaPremios;
  segundoLugar = 0;

}

// 👥 Desde 201 participantes: dos premios
else {

  primerLugar = bolsaPremios * 0.65;
  segundoLugar = bolsaPremios * 0.35;

}

// Revisar si todos los partidos ya tienen resultado
const pendientes = await pool.query(`
  SELECT COUNT(*) AS pendientes
  FROM partidos
  WHERE jornada = $1
    AND (
      goles_local IS NULL
      OR goles_visitante IS NULL
    )
`, [jornada]);

let campeones = [];

if (parseInt(pendientes.rows[0].pendientes) === 0) {
  campeones = await obtenerCampeon(jornada);
}

    res.json({
  participantes,
  recaudado,
  administracion,
  bolsaPremios,
  primerLugar,
  segundoLugar,

  jornadaTerminada:
    parseInt(pendientes.rows[0].pendientes) === 0,

  campeones
});

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
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

    // 🔥 FECHA DEL PARTIDO EN MÉXICO
    const fechaPartido = moment.tz(
  r.rows[0].fecha,
  "America/Mexico_City"
);

// Día anterior a las 22:00
const limite = fechaPartido
  .clone()
  .subtract(1, 'day')
  .hour(22)
  .minute(0)
  .second(0);

    // 🔥 HORA ACTUAL MÉXICO
    const ahora = moment.tz("America/Mexico_City");

    // 🔥 COMPARACIÓN REAL
    const bloqueada = ahora.isAfter(limite);

    res.json({
      bloqueada,
      limite: limite.format(),
      ahora: ahora.format()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'error limite' });
  }
});

app.post('/reset', async (req, res) => {

  const { password } = req.body;

  // 🔐 contraseña segura (cámbiala tú)
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Contraseña incorrecta" });
  }

  try {

    await pool.query('DELETE FROM predicciones');
    await pool.query('DELETE FROM partidos');

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al resetear" });
  }
});

app.post('/admin/partidos', async (req, res) => {
  let {
    local,
    visitante,
    fecha,
    jornada,
    liga,
    logo_local,
    logo_visitante
  } = req.body;

  local = local.trim();
  visitante = visitante.trim();
  liga = liga ? liga.trim() : null;

  // FIX HORARIO MEXICO
  const fechaMexico = fecha.replace('T', ' ') + ':00';

  try {

    // Obtener el siguiente orden de la jornada
const ordenResult = await pool.query(
  `
  SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente
  FROM partidos
  WHERE jornada = $1
  `,
  [jornada]
);

const orden = Number(ordenResult.rows[0].siguiente);

if (!Number.isInteger(orden) || orden <= 0) {
  throw new Error("No se pudo calcular el orden del partido.");
}

    await pool.query(`
  INSERT INTO partidos
  (
    local,
    visitante,
    fecha,
    jornada,
    orden,
    liga,
    logo_local,
    logo_visitante
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
`, [
  local,
  visitante,
  fechaMexico,
  jornada,
  orden,
  liga || null,
  logo_local || null,
  logo_visitante || null
]);

    res.json({ ok: true });

  } catch (err) {
    console.error("🔥 ERROR REAL:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/backup', async (req, res) => {
  try {

    const users = await pool.query(`SELECT * FROM users`);
    const partidos = await pool.query(`SELECT * FROM partidos`);
    const predicciones = await pool.query(`SELECT * FROM predicciones`);

    const backup = {
      fecha: new Date(),
      users: users.rows,
      partidos: partidos.rows,
      predicciones: predicciones.rows
    };

    res.json(backup);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.get('/exportar-excel', async (req, res) => {

  const jornada = req.query.jornada || 1;

  try {

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Quinielas El Inge";
    workbook.company = "Quinielas El Inge";
    workbook.subject = `Semana ${jornada}`;
    workbook.title = `Resultados Semana ${jornada}`;

    const sheet = workbook.addWorksheet(`Semana ${jornada}`);
    sheet.properties.defaultRowHeight = 22;

    // =========================================
// CONFIGURACIÓN DE LA HOJA
// =========================================

sheet.views = [
  {
    state: "frozen",
    xSplit: 1,
    ySplit: 10
  }
];

sheet.pageSetup = {
  orientation: "landscape",
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  margins: {
    left: 0.25,
    right: 0.25,
    top: 0.35,
    bottom: 0.35,
    header: 0.2,
    footer: 0.2
  }
};





    // 🔥 obtener datos directo DB
   const partidosResult = await pool.query(`
    SELECT *
    FROM partidos
    WHERE jornada = $1
    ORDER BY
      COALESCE(orden, 999),
      id
`, [jornada]);

    const partidos = partidosResult.rows;

    const sinOrden = partidosResult.rows.filter(p => p.orden == null);

if (sinOrden.length > 0) {

    return res.status(400).json({
        error: true,
        mensaje:
            `La jornada ${jornada} tiene ${sinOrden.length} partidos sin orden asignado.`
    });
}

    const tabla = await fetchTabla(jornada);

    if (!tabla || tabla.length === 0) {
      return res.status(400).send("No hay datos para exportar");
    }

    // =========================================
// DATOS DE PREMIOS
// =========================================

const bolsaResult = await pool.query(`
SELECT COUNT(DISTINCT envio_id) AS participantes
FROM predicciones
WHERE jornada = $1
`, [jornada]);

const participantes = parseInt(
  bolsaResult.rows[0].participantes || 0
);

const recaudado = participantes * 50;

const bolsaPremios = recaudado * 0.80;

let premioPrimerLugar = 0;

if (participantes <= 750) {
  premioPrimerLugar = bolsaPremios;
} else {
  premioPrimerLugar = bolsaPremios * 0.65;
}

    // =========================================
// ENCABEZADO
// =========================================

// Espacio superior
sheet.addRow([]);
sheet.addRow([]);

// Título
sheet.mergeCells("A3:K3");

const titulo = sheet.getCell("A3");

titulo.value = `🏆 PREMIOS SEMANA ${jornada}`;

titulo.font = {
  bold: true,
  size: 18,
  color: { argb: "FFFFFFFF" }
};

titulo.alignment = {
  horizontal: "center",
  vertical: "middle"
};

titulo.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E78" }
};

titulo.border = {
  top: { style: "medium" },
  bottom: { style: "medium" },
  left: { style: "medium" },
  right: { style: "medium" }
};

// Premio
sheet.mergeCells("C5:I7");

const premio = sheet.getCell("C5");

premio.value = [
  "🥇 Primer Lugar",
  `$${premioPrimerLugar.toLocaleString()} MXN`,
  participantes <= 750
    ? "Premio único"
    : "1° Lugar"
].join("\n");


premio.font = {
  bold: true,
  size: 15,
  color: { argb: "FFFFFFFF" }
};

premio.alignment = {
  horizontal: "center",
  vertical: "middle",
  wrapText: true
};

sheet.getRow(5).height = 28;
sheet.getRow(6).height = 28;

premio.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: {
    argb: "FF4F81BD"
  }
};

premio.border = {
  top: { style: "medium" },
  bottom: { style: "medium" },
  left: { style: "medium" },
  right: { style: "medium" }
};
sheet.getRow(5).height = 26;
sheet.getRow(6).height = 26;
sheet.getRow(7).height = 26;

// Separación antes de la tabla
sheet.addRow([]);
sheet.addRow([]);




    // =========================================
// ENCABEZADOS
// =========================================

// =========================================
// CABECERA DE 3 FILAS (COMO TU PLANTILLA)
// =========================================

const filaLocal = ["Jugador"];
const filaResultado = [""];
const filaVisitante = [""];

partidos.forEach(p => {

    filaLocal.push(p.local);

    filaResultado.push(
        (p.goles_local != null && p.goles_visitante != null)
            ? `${p.goles_local}-${p.goles_visitante}`
            : "⏳"
    );

    filaVisitante.push(p.visitante);

});

filaLocal.push("Puntos");
filaResultado.push("");
filaVisitante.push("");

const rowLocal = sheet.insertRow(9, filaLocal);
const rowResultado = sheet.insertRow(10, filaResultado);
const rowVisitante = sheet.insertRow(11, filaVisitante);

// Ancho columnas
sheet.getColumn(1).width = 22;

for (let i = 2; i < filaLocal.length; i++) {
    sheet.getColumn(i).width = 16;
}

sheet.getColumn(filaLocal.length).width = 10;
// =========================================
// ESTILO CABECERA
// =========================================

[rowLocal, rowResultado, rowVisitante].forEach(row => {

    row.height = 22;

    row.eachCell((cell) => {

        cell.font = {
            bold: true,
            color: { argb: "FFFFFFFF" },
            name: "Arial",
            size: 10
        };

        cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true
        };

        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
                argb: "FF1A1A1A"
            }
        };

        cell.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
        };

    });

});

// Resultado oficial en amarillo
rowResultado.eachCell((cell, colNumber) => {

    if (colNumber === 1 || colNumber === filaResultado.length)
        return;

    cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
            argb: "FFFFEB3B"
        }
    };

    cell.font = {
        bold: true,
        color: {
            argb: "FF000000"
        },
        size: 16
    };

});


// Jugador (azul)
// Jugador (azul)
for (let i = 9; i <= 11; i++) {

    const c = sheet.getCell(`A${i}`);

    c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
            argb: "FF2F5597"
        }
    };

    c.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11
    };

    c.alignment = {
        horizontal: "center",
        vertical: "middle"
    };

}

// Puntos (verde)
// Puntos (verde)
const ultimaColumna = sheet.columnCount;

for (let i = 9; i <= 11; i++) {

    const c = sheet.getRow(i).getCell(ultimaColumna);

    c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
            argb: "FF70AD47"
        }
    };

    c.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11
    };

    c.alignment = {
        horizontal: "center",
        vertical: "middle"
    };

}
    // 🔥 FILAS
    tabla.forEach(u => {

      const fila = [u.nombre, ...u.picks, u.puntos];
      const row = sheet.addRow(fila);

      row.eachCell(cell => {

    cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } }
    };

});
      
      const maxPuntos = tabla[0].puntos;

if (u.puntos === maxPuntos) {

    row.getCell(row.cellCount).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
            argb: "FFFFD700"
        }
    };

    row.getCell(row.cellCount).font = {
        bold: true,
        color: {
            argb: "FF000000"
        }
    };

}

      row.getCell(1).alignment = {
    horizontal: "left",
    vertical: "middle"
};

row.getCell(1).font = {
    bold: false,
    size: 16
};

// Tamaño de la columna Puntos
const puntosCell = row.getCell(row.cellCount);

puntosCell.font = {
    name: "Arial",
    bold: true,
    size: 14,
    color: { argb: "FF000000" }
};



      row.height = 24;

      row.eachCell(cell => {

    cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true
    };

});


      u.detalles.forEach((d, i) => {

        const cell = row.getCell(i + 2);

        let color = {
          verde: "FF22C55E",
          amarillo: "FFEAB308",
          rojo: "FFEF4444",
          gris: "FF9CA3AF"
        }[d] || "FFFFFFFF";

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color }
        };

        cell.font = {
    name: "Arial",
    bold: true,
    size: 14,
    color: { argb: "FF000000" }
};
      });

    });

    // =========================================
// BORDE EXTERIOR DE LA TABLA
// =========================================


    const primeraFilaTabla = 9;
const ultimaFilaTabla = sheet.rowCount;

for (let fila = primeraFilaTabla; fila <= ultimaFilaTabla; fila++) {

    const izquierda = sheet.getRow(fila).getCell(1);

    izquierda.border = {
        ...izquierda.border,
        left: { style: "medium", color: { argb: "FF000000" } }
    };

    const derecha = sheet.getRow(fila).getCell(sheet.columnCount);

    derecha.border = {
        ...derecha.border,
        right: { style: "medium", color: { argb: "FF000000" } }
    };

}

for (let col = 1; col <= sheet.columnCount; col++) {

    const arriba = sheet.getRow(primeraFilaTabla).getCell(col);

    arriba.border = {
        ...arriba.border,
        top: { style: "medium", color: { argb: "FF000000" } }
    };

    const abajo = sheet.getRow(ultimaFilaTabla).getCell(col);

    abajo.border = {
        ...abajo.border,
        bottom: { style: "medium", color: { argb: "FF000000" } }
    };

}

    // 🔥 HEADERS HTTP (ANTES de enviar)
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=quiniela-semana-${jornada}.xlsx`
    );

    // 🔥 CLAVE: usar buffer (NO stream directo)
    const buffer = await workbook.xlsx.writeBuffer();

    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error al generar Excel");
  }
});

app.post('/admin/login', (req, res) => {

  const user = (req.body.user || "").trim();
  const password = (req.body.password || "").trim();

  const ADMIN_USER = (process.env.ADMIN_USER || "").trim();
  const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();

  if (
    user === ADMIN_USER &&
    password === ADMIN_PASSWORD
  ) {
    return res.json({ ok: true });
  }

  res.status(401).json({ error: "Usuario Incorrecto" });

});


app.get('/jornada-actual', async (req, res) => {
  try {
    const result = await pool.query(`
  SELECT DISTINCT jornada
  FROM partidos
  ORDER BY jornada DESC
  LIMIT 1
`);

    if (result.rows.length === 0) {
      return res.json({ jornada: 1 });
    }

    res.json({ jornada: result.rows[0].jornada });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo jornada" });
  }
});

app.get('/salon-fama', async (req, res) => {

  try {

    const resultado = await pool.query(`
      SELECT
        nombre,
        COUNT(*) AS titulos
      FROM campeones
      GROUP BY nombre
      ORDER BY titulos DESC, nombre ASC
    `);

    res.json(resultado.rows);

  } catch (err) {

    console.error(err);
    res.status(500).json({
      error: err.message
    });

  }

});

app.get('/estadisticas', async (req, res) => {
  try {

    const usuarios = await pool.query(`
      SELECT COUNT(*) total
      FROM users
    `);

    const quinielas = await pool.query(`
      SELECT COUNT(*) total
      FROM predicciones
    `);

    const campeones = await pool.query(`
      SELECT COUNT(*) total
      FROM campeones
    `);

    const record = await pool.query(`
      SELECT nombre, puntos
      FROM campeones
      ORDER BY puntos DESC
      LIMIT 1
    `);

    const ultimoCampeon = await pool.query(`
  SELECT nombre
  FROM campeones
  ORDER BY jornada DESC
  LIMIT 1
`);

const reyQuiniela = await pool.query(`
  SELECT nombre, COUNT(*) titulos
  FROM campeones
  GROUP BY nombre
  ORDER BY titulos DESC
  LIMIT 1
`);

const mejorRacha = await pool.query(`
  SELECT nombre, COUNT(*) racha
  FROM campeones
  GROUP BY nombre
  ORDER BY racha DESC
  LIMIT 1
`);

    res.json({
  usuarios: parseInt(usuarios.rows[0].total),
  quinielas: parseInt(quinielas.rows[0].total),
  campeones: parseInt(campeones.rows[0].total),

  recordNombre: record.rows[0]?.nombre || "-",
  recordPuntos: record.rows[0]?.puntos || 0,

  ultimoCampeon:
    ultimoCampeon.rows[0]?.nombre || "-",

  reyQuiniela:
    reyQuiniela.rows[0]?.nombre || "-",

  titulos:
    reyQuiniela.rows[0]?.titulos || 0,

  rachaNombre:
    mejorRacha.rows[0]?.nombre || "-",

  racha:
    mejorRacha.rows[0]?.racha || 0
});


  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 📲 Usuarios que aún no han enviado su quiniela
app.get('/recordatorios', async (req, res) => {

  try {

    const { jornada } = req.query;

    const result = await pool.query(`
      SELECT
        u.id,
        u.nombre,
        u.telefono,
        u.recordatorio_enviado,
        u.fecha_recordatorio
      FROM users u
      WHERE u.telefono IS NOT NULL
        AND TRIM(u.telefono) <> ''
        AND NOT EXISTS (

          SELECT 1
          FROM predicciones p
          WHERE p.user_id = u.id
            AND p.jornada = $1

        )

      ORDER BY u.nombre
    `, [jornada]);

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});

app.post('/recordatorios/reiniciar', async (req, res) => {

  try {

    await pool.query(`
     UPDATE users
    SET recordatorio_enviado = FALSE,
    fecha_recordatorio = NULL
    `);

    res.json({
      ok: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: 'No se pudieron reiniciar'
    });

  }

});

// 🚀 SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🔥 SERVIDOR PRO corriendo en ${PORT}`);
});