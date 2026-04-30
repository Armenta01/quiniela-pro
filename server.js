console.log("🔥 ARRANCANDO SERVER...");
const express = require('express');
const path = require('path');
const app = express();
const db = require('./database');


app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔍 LOG
app.use((req, res, next) => {
  console.log("👉", req.method, req.url);
  next();
});


// 🔥 OBTENER JORNADAS
app.get('/jornadas', (req, res) => {
  try {
    const rows = db.prepare("SELECT DISTINCT jornada FROM partidos ORDER BY jornada ASC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});


// 🔥 PARTIDOS
app.get('/partidos', (req, res) => {
  try {
    const jornada = req.query.jornada;

    const rows = jornada
      ? db.prepare("SELECT * FROM partidos WHERE jornada = ?").all(jornada)
      : db.prepare("SELECT * FROM partidos").all();

    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});


// 🔥 CREAR PARTIDOS
app.post('/partidos', (req, res) => {
  try {
    const { local, visitante, fecha, logo_local, logo_visitante, jornada, jornada_partido } = req.body;

    db.prepare(`
      INSERT INTO partidos 
      (local, visitante, fecha, logo_local, logo_visitante, goles_local, goles_visitante, jornada, jornada_partido)
      VALUES (?, ?, ?, ?, ?, null, null, ?, ?)
    `).run(local, visitante, fecha, logo_local, logo_visitante, jornada, jornada_partido);

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json(err);
  }
});


// 🔥 RESULTADOS
app.post('/resultado', (req, res) => {
  try {
    const { id, goles_local, goles_visitante } = req.body;

    db.prepare(
      "UPDATE partidos SET goles_local = ?, goles_visitante = ? WHERE id = ?"
    ).run(goles_local, goles_visitante, id);

    const partido = db.prepare("SELECT jornada FROM partidos WHERE id = ?").get(id);
    const jornada = partido.jornada;

    const row = db.prepare(
      "SELECT COUNT(*) as faltantes FROM partidos WHERE jornada = ? AND goles_local IS NULL"
    ).get(jornada);

    if (row.faltantes === 0) {

      console.log("🏁 Jornada terminada, cerrando...");

      const rows = db.prepare(`
        SELECT 
          users.nombre,
          predicciones.goles_local as pl,
          predicciones.goles_visitante as pv,
          partidos.goles_local as rl,
          partidos.goles_visitante as rv
        FROM predicciones
        JOIN users ON users.id = predicciones.user_id
        JOIN partidos ON partidos.id = predicciones.partido_id
        WHERE predicciones.jornada = ?
      `).all(jornada);

      let tabla = {};

      rows.forEach(r => {
        if (r.rl === null) return;

        if (!tabla[r.nombre]) tabla[r.nombre] = 0;

        const puntos =
          r.pl == r.rl && r.pv == r.rv ? 3 :
          (
            (r.pl > r.pv && r.rl > r.rv) ||
            (r.pl < r.pv && r.rl < r.rv) ||
            (r.pl == r.pv && r.rl == r.rv)
          ) ? 1 : 0;

        tabla[r.nombre] += puntos;
      });

      const ranking = Object.entries(tabla)
        .map(([nombre, puntos]) => ({ nombre, puntos }))
        .sort((a, b) => b.puntos - a.puntos);

      if (ranking.length > 0) {
        const campeon = ranking[0];

        db.prepare(
          "INSERT INTO campeones (jornada, nombre, puntos) VALUES (?, ?, ?)"
        ).run(jornada, campeon.nombre, campeon.puntos);
      }
    }

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json(err);
  }
});


// 🔥 PREDICCIONES
app.post('/predicciones', (req, res) => {
  try {
    const { nombre, predicciones, jornada } = req.body;

    if (!nombre || predicciones.length === 0) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const row = db.prepare(`
      SELECT 1
      FROM predicciones p
      JOIN users u ON u.id = p.user_id
      WHERE u.nombre = ? AND p.jornada = ?
      LIMIT 1
    `).get(nombre, jornada);

    if (row) {
      return res.status(403).json({
        error: "🚫 Este nombre ya envió quiniela en esta semana"
      });
    }

    let user = db.prepare("SELECT * FROM users WHERE nombre = ?").get(nombre);

    let user_id;

    if (user) {
      user_id = user.id;
    } else {
      const result = db.prepare("INSERT INTO users (nombre) VALUES (?)").run(nombre);
      user_id = result.lastInsertRowid;
    }

    const stmt = db.prepare(`
      INSERT INTO predicciones 
      (user_id, partido_id, goles_local, goles_visitante, jornada)
      VALUES (?, ?, ?, ?, ?)
    `);

    predicciones.forEach(p => {
      stmt.run(user_id, p.partido_id, p.goles_local, p.goles_visitante, jornada);
    });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json(err);
  }
});


app.get('/historial', (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM campeones ORDER BY jornada DESC").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});


// 🔥 STATIC
app.use(express.static('public'));

//fix render deploy 

// 🔥 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log("Servidor listo en puerto " + PORT);
});