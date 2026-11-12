require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool, types } = require('pg');
const enviosEnProceso = new Set();

// timestamp without time zone (OID 1114)
// Devolver SIEMPRE como texto
types.setTypeParser(1114, value => value);
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fetch = require('node-fetch');
const moment = require('moment-timezone');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  if (req.path.toLowerCase() === '/admin.html') {
    return res.redirect('/admin');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
// ==========================================
// 🖼️ PROXY PARA LOGOS DE EQUIPOS
// ==========================================

app.get("/proxy-logo", async (req, res) => {

    try {

        const url = req.query.url;

        if (!url) {
            return res.status(400).send("Falta la URL del logo");
        }

        const originalURL = new URL(url);

        if (!["http:", "https:"].includes(originalURL.protocol)) {
            return res.status(400).send("URL no válida");
        }

        // ==================================================
        // 1️⃣ URL original
        // 2️⃣ Fallback usando www.thesportsdb.com
        // ==================================================

        const urlsIntentar = [
            originalURL.href
        ];

        if (
            originalURL.hostname === "r2.thesportsdb.com"
        ) {

            const alternativa =
                new URL(originalURL.href);

            alternativa.hostname =
                "www.thesportsdb.com";

            urlsIntentar.push(
                alternativa.href
            );
        }

        let respuesta = null;
        let ultimoError = null;

        for (const logoURL of urlsIntentar) {

            try {

                console.log(
                    "🖼️ Intentando logo:",
                    logoURL
                );

                const r = await fetch(
                    logoURL,
                    {
                        headers: {
                            "User-Agent":
                                "Mozilla/5.0",
                            "Accept":
                                "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                        },
                        redirect: "follow",
                        timeout: 15000
                    }
                );

                if (r.ok) {

                    respuesta = r;

                    console.log(
                        "✅ Logo cargado:",
                        logoURL
                    );

                    break;
                }

                ultimoError =
                    new Error(
                        `HTTP ${r.status} ${r.statusText}`
                    );

                console.log(
                    "⚠️ Respuesta:",
                    r.status,
                    logoURL
                );

            } catch (error) {

                ultimoError = error;

                console.log(
                    "⚠️ Falló:",
                    logoURL,
                    error.message
                );
            }
        }

        // ==================================================
        // ❌ No se pudo cargar
        // ==================================================

        if (!respuesta) {

            console.error(
                "❌ TODOS LOS INTENTOS FALLARON:",
                ultimoError?.message
            );

            return res.status(502).send(
                "No se pudo descargar el logo"
            );
        }

        // ==================================================
        // 📦 Enviar imagen
        // ==================================================

        const contentType =
            respuesta.headers.get(
                "content-type"
            ) || "image/png";

        const buffer =
            await respuesta.buffer();

        res.setHeader(
            "Content-Type",
            contentType
        );

        res.setHeader(
            "Content-Length",
            buffer.length
        );

        res.setHeader(
            "Cache-Control",
            "public, max-age=86400"
        );

        res.setHeader(
            "Access-Control-Allow-Origin",
            "*"
        );

        res.setHeader(
            "Access-Control-Allow-Methods",
            "GET, OPTIONS"
        );

        res.send(buffer);

    } catch (error) {

        console.error(
            "❌ ERROR CRÍTICO PROXY LOGO:",
            error
        );

        res.status(500).send(
            "Error interno del proxy de logos"
        );
    }

});


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

app.set('trust proxy', 1);

app.use(session({
  store: new PgSession({
    pool,
    createTableIfMissing: true
  }),
  name: 'inge.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 4
  }
}));


 // 🔒 PROTEGER TODAS LAS RUTAS ADMINISTRATIVAS
app.use('/admin', (req, res, next) => {

  // Permitir iniciar sesión
  if (req.path === '/login' && req.method === 'POST') {
    return next();
  }

  // Exigir sesión administrativa
  return verificarAdmin(req, res, next);

});


/* ==========================================
   🎁 ADMINISTRADOR DE PROMOCIONES
   QUINIELAS EL INGE
========================================== */

// Consultar todas las promociones
app.get('/admin/promociones', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT *
      FROM promociones
      ORDER BY inicio DESC, id DESC
    `);

    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar promociones:', error);
    res.status(500).json({
      error: 'No se pudieron consultar las promociones'
    });
  }
});

// Crear promoción
app.post('/admin/promociones', async (req, res) => {
  try {
    const {
      nombre,
      tipo,
      descuento,
      cantidad_min,
      cantidad_paquete,
      precio_paquete,
      inicio,
      fin
    } = req.body;

    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({
        error: 'Escribe el nombre de la promoción'
      });
    }

    if (!['porcentaje', 'paquete'].includes(tipo)) {
      return res.status(400).json({
        error: 'Tipo de promoción no válido'
      });
    }

    const inicioFecha = new Date(inicio);
    const finFecha = new Date(fin);

    if (
      !inicio || !fin ||
      Number.isNaN(inicioFecha.getTime()) ||
      Number.isNaN(finFecha.getTime()) ||
      finFecha <= inicioFecha
    ) {
      return res.status(400).json({
        error: 'Las fechas de la promoción no son válidas'
      });
    }

    let descuentoFinal = 0;
    let cantidadMinima = 1;
    let cantidadPaquete = null;
    let precioPaquete = null;

    if (tipo === 'porcentaje') {
      descuentoFinal = Number(descuento);
      cantidadMinima = Number(cantidad_min);

      if (
        !Number.isFinite(descuentoFinal) ||
        descuentoFinal <= 0 ||
        descuentoFinal > 100 ||
        !Number.isInteger(cantidadMinima) ||
        cantidadMinima < 1
      ) {
        return res.status(400).json({
          error: 'Porcentaje o cantidad mínima no válidos'
        });
      }
    }

    if (tipo === 'paquete') {
      cantidadPaquete = Number(cantidad_paquete);
      precioPaquete = Number(precio_paquete);

      if (
        !Number.isInteger(cantidadPaquete) ||
        cantidadPaquete < 1 ||
        !Number.isFinite(precioPaquete) ||
        precioPaquete < 0
      ) {
        return res.status(400).json({
          error: 'Cantidad o precio del paquete no válidos'
        });
      }
    }

    const resultado = await pool.query(`
      INSERT INTO promociones (
        nombre, tipo, descuento, cantidad_min,
        cantidad_paquete, precio_paquete,
        inicio, fin, habilitada
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
      RETURNING *
    `, [
      String(nombre).trim(),
      tipo,
      descuentoFinal,
      cantidadMinima,
      cantidadPaquete,
      precioPaquete,
      inicioFecha.toISOString(),
      finFecha.toISOString()
    ]);

    res.status(201).json({
      mensaje: 'Promoción creada correctamente',
      promocion: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al crear promoción:', error);
    res.status(500).json({
      error: 'No se pudo crear la promoción'
    });
  }
});

// Activar o desactivar promoción
app.patch('/admin/promociones/:id/estado', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        error: 'Identificador no válido'
      });
    }

    if (typeof req.body.habilitada !== 'boolean') {
      return res.status(400).json({
        error: 'El estado debe ser verdadero o falso'
      });
    }

    const resultado = await pool.query(`
      UPDATE promociones
      SET habilitada = $1
      WHERE id = $2
      RETURNING *
    `, [req.body.habilitada, id]);

    if (!resultado.rows.length) {
      return res.status(404).json({
        error: 'Promoción no encontrada'
      });
    }

    res.json({
      mensaje: 'Estado actualizado correctamente',
      promocion: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al cambiar promoción:', error);
    res.status(500).json({
      error: 'No se pudo actualizar el estado'
    });
  }
});

// Eliminar promoción (desactivación permanente)
app.delete('/admin/promociones/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        error: 'Identificador no válido'
      });
    }

    const resultado = await pool.query(`
      UPDATE promociones
      SET habilitada = FALSE
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (!resultado.rows.length) {
      return res.status(404).json({
        error: 'Promoción no encontrada'
      });
    }

    res.json({
      mensaje: 'Promoción desactivada correctamente'
    });

  } catch (error) {
    console.error('Error al eliminar promoción:', error);
    res.status(500).json({
      error: 'No se pudo desactivar la promoción'
    });
  }
});


/* ==========================================
   🎁 CÁLCULO AUTOMÁTICO DE PROMOCIONES
   QUINIELAS EL INGE
========================================== */

const PRECIO_BASE_QUINIELA = 50;

async function calcularPrecioPromocional(cantidad, db = pool) {

  const cantidadQuinielas = Number(cantidad);

  if (
    !Number.isSafeInteger(cantidadQuinielas) ||
    cantidadQuinielas < 1 ||
    cantidadQuinielas > 1000
  ) {
    throw new Error("Cantidad de quinielas no válida");
  }

  const precioNormal =
    cantidadQuinielas * PRECIO_BASE_QUINIELA;

   const resultado = await db.query(`
    SELECT *
    FROM promociones
    WHERE habilitada = TRUE
      AND inicio <= NOW()
      AND fin > NOW()
    ORDER BY id DESC
  `);

  let mejorPrecio = precioNormal;
  let mejorPromocion = null;

  for (const promo of resultado.rows) {

    let precioCalculado = precioNormal;

    // =====================================
    // DESCUENTO POR PORCENTAJE
    // =====================================

    if (promo.tipo === "porcentaje") {

      const minimo = Number(promo.cantidad_min);
      const descuento = Number(promo.descuento);

      if (
        cantidadQuinielas >= minimo &&
        descuento > 0 &&
        descuento <= 100
      ) {

        precioCalculado =
          precioNormal * (1 - descuento / 100);

      }
    }

    // =====================================
    // PRECIO ESPECIAL POR PAQUETE
    // =====================================

    if (promo.tipo === "paquete") {

      const cantidadPaquete =
        Number(promo.cantidad_paquete);

      const precioPaquete =
        Number(promo.precio_paquete);

      if (
        Number.isInteger(cantidadPaquete) &&
        cantidadPaquete >= 1 &&
        Number.isFinite(precioPaquete) &&
        precioPaquete >= 0 &&
        cantidadQuinielas >= cantidadPaquete
      ) {

        const paquetesCompletos =
          Math.floor(cantidadQuinielas / cantidadPaquete);

        const quinielasRestantes =
          cantidadQuinielas % cantidadPaquete;

        precioCalculado =
          paquetesCompletos * precioPaquete +
          quinielasRestantes * PRECIO_BASE_QUINIELA;

      }
    }

    // Redondear a centavos
    precioCalculado =
      Math.round((precioCalculado + Number.EPSILON) * 100) / 100;

    // Elegir la promoción que más ahorre
    if (precioCalculado < mejorPrecio) {

      mejorPrecio = precioCalculado;

      mejorPromocion = {
        id: promo.id,
        nombre: promo.nombre,
        tipo: promo.tipo
      };

    }
  }

  return {
    cantidad: cantidadQuinielas,
    precio_unitario: PRECIO_BASE_QUINIELA,
    precio_normal: precioNormal,
    precio_final: mejorPrecio,
    ahorro: Math.round(
      (precioNormal - mejorPrecio) * 100
    ) / 100,
    promocion: mejorPromocion
  };
}


// ==========================================
// 🎁 CONSULTAR PRECIO PROMOCIONAL
// ==========================================

app.get("/promocion/precio", async (req, res) => {

  try {

    const cantidad = Number(req.query.cantidad);

    const resultado =
      await calcularPrecioPromocional(cantidad);

    res.set("Cache-Control", "no-store");

    res.json({
      ok: true,
      ...resultado
    });

  } catch (error) {

    console.error(
      "❌ Error calculando promoción:",
      error
    );

    if (error.message === "Cantidad de quinielas no válida") {
      return res.status(400).json({
        ok: false,
        error: error.message
      });
    }

    res.status(500).json({
      ok: false,
      error: "No fue posible calcular el precio"
    });

  }

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
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telefono TEXT;
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

  // 🔥 Agregar estado de pago si aún no existe
await pool.query(`
  ALTER TABLE predicciones
  ADD COLUMN IF NOT EXISTS estado_pago TEXT DEFAULT 'Pendiente';
`);

// 🏆 Columnas necesarias para las quinielas
await pool.query(`
  ALTER TABLE predicciones
  ADD COLUMN IF NOT EXISTS envio_id TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS fecha_envio TIMESTAMP;
`);

  // ⚡ performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_partidos_jornada ON partidos(jornada);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_predicciones_jornada ON predicciones(jornada);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_nombre ON users(nombre);`);


  // ==========================================
  // 🎁 PROMOCIONES - QUINIELAS EL INGE
  // ==========================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promociones (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL
        CHECK (tipo IN ('porcentaje', 'paquete')),

      descuento NUMERIC(5,2) DEFAULT 0,
      cantidad_min INTEGER DEFAULT 1,
      cantidad_paquete INTEGER,
      precio_paquete NUMERIC(10,2),

      inicio TIMESTAMPTZ NOT NULL,
      fin TIMESTAMPTZ NOT NULL,

      habilitada BOOLEAN DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ DEFAULT NOW(),

      CONSTRAINT promocion_fechas_validas
        CHECK (fin > inicio),

      CONSTRAINT promocion_descuento_valido
        CHECK (descuento >= 0 AND descuento <= 100),

      CONSTRAINT promocion_cantidad_valida
        CHECK (cantidad_min >= 1),

      CONSTRAINT promocion_paquete_valido
        CHECK (
          cantidad_paquete IS NULL
          OR cantidad_paquete >= 1
        ),

      CONSTRAINT promocion_precio_valido
        CHECK (
          precio_paquete IS NULL
          OR precio_paquete >= 0
        )
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_promociones_vigencia
    ON promociones (habilitada, inicio, fin);
  `);


  // ==========================================
  // 💰 REGISTRO DE IMPORTES POR COMPRA
  // ==========================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS compras_quinielas (
      id BIGSERIAL PRIMARY KEY,
      compra_id TEXT UNIQUE NOT NULL,
      jornada INTEGER NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      precio_normal NUMERIC(12,2) NOT NULL,
      precio_final NUMERIC(12,2) NOT NULL,
      ahorro NUMERIC(12,2) NOT NULL DEFAULT 0,
      promocion_id INTEGER REFERENCES promociones(id) ON DELETE SET NULL,
      promocion_nombre TEXT,
      fecha_compra TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS compras_quinielas_envios (
      compra_id TEXT NOT NULL
        REFERENCES compras_quinielas(compra_id) ON DELETE CASCADE,
      envio_id TEXT PRIMARY KEY NOT NULL
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_compras_quinielas_jornada
    ON compras_quinielas(jornada);
  `);


  console.log("🎁 Sistema de promociones preparado");

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
  "YYYY-MM-DD HH:mm:ss",
  "America/Mexico_City"
);

 const limite = fechaPartido
  .clone()
  .subtract(2, 'hours');

  const ahora = moment.tz("America/Mexico_City");

  const bloqueada = ahora.valueOf() >= limite.valueOf();
  return bloqueada;
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
  try {

    const { jornada } = req.query;

    const result = await pool.query(`
      SELECT
        id,
        local,
        visitante,
        fecha,
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

    result.rows.forEach(p => {
      p.fecha = moment
        .tz(p.fecha, "YYYY-MM-DD HH:mm:ss", "America/Mexico_City")
        .format("YYYY-MM-DD HH:mm");
    });

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo partidos"
    });
  }
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




app.post('/guardar', async (req, res) => {
  let { nombre, telefono, jornada, pronosticos } = req.body || {};

  // Validar el nombre antes de utilizar trim()
  if (typeof nombre !== "string" || nombre.trim().length < 2) {
    return res.status(400).json({
      ok: false,
      error: "Escribe un nombre válido."
    });
  }

  nombre = nombre.trim();

  const llaveEnvio = `${nombre.toLowerCase()}-${jornada}`;


if (enviosEnProceso.has(llaveEnvio)) {
  return res.status(429).json({
    error: "Tu quiniela ya se está procesando, espera un momento."
  });
}

enviosEnProceso.add(llaveEnvio);

  const envioId = Date.now().toString() + "_" + Math.random().toString(36).substring(2,8);

  const fechaEnvio = moment
  .tz("America/Mexico_City")
  .format("YYYY-MM-DD HH:mm:ss");
  
let client;

  try {
    
if (
  !Number.isInteger(Number(jornada)) ||
  Number(jornada) < 1 ||
  !Array.isArray(pronosticos)
) {
  return res.status(400).json({
    error: "La jornada o los pronósticos no son válidos."
  });
}

// Consultar los partidos registrados en la jornada
const partidosResult = await pool.query(
  `SELECT id FROM partidos WHERE jornada = $1`,
  [jornada]
);

const idsValidos = new Set(
  partidosResult.rows.map(p => Number(p.id))
);

// Verificar que se capturen todos los partidos
if (
  idsValidos.size === 0 ||
  pronosticos.length !== idsValidos.size
) {
  return res.status(400).json({
    error: "Debes completar todos los partidos de la jornada."
  });
}

const idsUsados = new Set();

for (const p of pronosticos) {
  if (!p || typeof p !== "object") {
    return res.status(400).json({
      error: "Pronóstico inválido."
    });
  }

  const partidoId = Number(p.partido_id);

  if (
    !idsValidos.has(partidoId) ||
    idsUsados.has(partidoId)
  ) {
    return res.status(400).json({
      error: "Hay partidos incorrectos o repetidos."
    });
  }

  if (
    p.local === "" || p.local == null ||
    p.visitante === "" || p.visitante == null
  ) {
    return res.status(400).json({
      error: "Debes llenar todos los marcadores."
    });
  }

  const gl = Number(p.local);
  const gv = Number(p.visitante);

  if (
    !Number.isInteger(gl) ||
    !Number.isInteger(gv) ||
    gl < 0 || gv < 0 ||
    gl > 20 || gv > 20
  ) {
    return res.status(400).json({
      error: "Los marcadores deben ser números entre 0 y 20."
    });
  }

  idsUsados.add(partidoId);
}

    if (await jornadaBloqueada(jornada)) {
      return res.status(403).json({ error: "Jornada cerrada" });
    }


client = await pool.connect();
await client.query("BEGIN");


   
const usuarioResult = await client.query(
  `INSERT INTO users (nombre, telefono)
   VALUES ($1, $2)
   ON CONFLICT (nombre) DO NOTHING
   RETURNING id`,
  [nombre, telefono]
);

let userId;

if (usuarioResult.rows.length > 0) {
  userId = usuarioResult.rows[0].id;
} else {
  const usuarioExistente = await client.query(
    `SELECT id FROM users WHERE nombre = $1`,
    [nombre]
  );

  userId = usuarioExistente.rows[0].id;
}
 

// 🔥 validar si ya mandó EXACTfAMENTE lo mismo
const existentes = await client.query(
  `SELECT envio_id
   FROM predicciones pr
   JOIN users u ON pr.user_id = u.id
   WHERE u.nombre = $1 AND pr.jornada = $2
   GROUP BY envio_id`,
  [nombre, jornada]
);

for (let envio of existentes.rows) {
  const rows = await client.query(
    `SELECT partido_id,
            goles_local,
            goles_visitante
     FROM predicciones
     WHERE envio_id = $1
     ORDER BY partido_id`,
    [envio.envio_id]
  );

 
const viejo = JSON.stringify(
  rows.rows
    .map(x => ({
      partido_id: Number(x.partido_id),
      local: Number(x.goles_local),
      visitante: Number(x.goles_visitante)
    }))
    .sort((a, b) => a.partido_id - b.partido_id)
);



const nuevo = JSON.stringify(
  [...pronosticos]
    .sort((a, b) => a.partido_id - b.partido_id)
    .map(x => ({
      partido_id: x.partido_id,
      local: x.local === "" ? null : parseInt(x.local),
      visitante: x.visitante === "" ? null : parseInt(x.visitante)
    }))
);


if (viejo === nuevo) {
  await client.query("ROLLBACK");

  return res.status(400).json({
    error: "Ya enviaste los mismos resultados, captura una quiniela distinta."
  });
}

}

    // 🔥 FIX AQUÍ (error de integer "")
    for (let p of pronosticos) {

  const goles_local = p.local === "" ? null : parseInt(p.local);
  const goles_visitante = p.visitante === "" ? null : parseInt(p.visitante);

 await client.query(`
    INSERT INTO predicciones
(
  user_id,
  partido_id,
  goles_local,
  goles_visitante,
  jornada,
  envio_id,
  telefono,
  estado_pago,
  fecha_envio
)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
`, [
    userId,
    p.partido_id,
    goles_local,
    goles_visitante,
    jornada,
    envioId,
    telefono,
    "Pendiente",
    fechaEnvio
]);
}


    // ==========================================
    // 🎁 REGISTRAR PRECIO DE QUINIELA INDIVIDUAL
    // ==========================================

    const precioCompra = await calcularPrecioPromocional(1, client);

    const compraId =
      Date.now().toString() +
      "_COMPRA_" +
      require("crypto").randomBytes(8).toString("hex");

    await client.query(`
      INSERT INTO compras_quinielas (
        compra_id,
        jornada,
        user_id,
        cantidad,
        precio_normal,
        precio_final,
        ahorro,
        promocion_id,
        promocion_nombre
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      compraId,
      Number(jornada),
      userId,
      1,
      precioCompra.precio_normal,
      precioCompra.precio_final,
      precioCompra.ahorro,
      precioCompra.promocion?.id ?? null,
      precioCompra.promocion?.nombre ?? null
    ]);

    await client.query(`
      INSERT INTO compras_quinielas_envios (
        compra_id,
        envio_id
      )
      VALUES ($1,$2)
    `, [
      compraId,
      envioId
    ]);


await client.query("COMMIT");


    res.json({
      ok: true,
      compra_id: compraId,
      cantidad: 1,
      precio_normal: precioCompra.precio_normal,
      total: precioCompra.precio_final,
      ahorro: precioCompra.ahorro,
      promocion: precioCompra.promocion,
      envio_id: envioId
    });

} catch (err) {

  if (client) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error al revertir transacción:", rollbackError);
    }
  }

  console.error("Error al guardar quiniela:", err);

  res.status(500).json({
    ok: false,
    error: "No se pudo guardar la quiniela. Intenta nuevamente."
  });

} finally {

  if (client) {
    client.release();
  }

  enviosEnProceso.delete(llaveEnvio);

}
});


// ==========================================
// 🏆 GUARDAR VARIAS QUINIELAS
// ==========================================
app.post("/guardar-multiples", async (req, res) => {
  const { nombre, telefono, jornada, quinielas } = req.body || {};

  const nombreLimpio = typeof nombre === "string" ? nombre.trim() : "";
  const telefonoLimpio = String(telefono ?? "").trim();
  const jornadaNumero = Number(jornada);

  if (
    nombreLimpio.length < 2 ||
    !/^\d{10}$/.test(telefonoLimpio) ||
    !Number.isInteger(jornadaNumero) ||
    jornadaNumero < 1 ||
    !Array.isArray(quinielas) ||
    quinielas.length === 0 ||
    quinielas.length > 1000
  ) {
    return res.status(400).json({
      ok: false,
      error: "Verifica tu nombre, teléfono, jornada y quinielas."
    });
  }

  const llaveEnvio = `${nombreLimpio.toLowerCase()}-${jornadaNumero}`;

  if (enviosEnProceso.has(llaveEnvio)) {
    return res.status(429).json({
      ok: false,
      error: "Ya estamos procesando tus quinielas."
    });
  }

  enviosEnProceso.add(llaveEnvio);

  let client;

  try {
    if (await jornadaBloqueada(jornadaNumero)) {
      return res.status(403).json({
        ok: false,
        error: "La jornada ya está cerrada."
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");

    const partidosResult = await client.query(
      `SELECT id FROM partidos
       WHERE jornada = $1
       ORDER BY id`,
      [jornadaNumero]
    );

    const idsValidos = partidosResult.rows.map(p => Number(p.id));

    if (!idsValidos.length) {
      throw new Error("La jornada no tiene partidos registrados.");
    }

    const firmas = new Set();
    const quinielasNormalizadas = [];

    for (const quiniela of quinielas) {
      if (!Array.isArray(quiniela) || quiniela.length !== idsValidos.length) {
        throw new Error("Cada quiniela debe incluir todos los partidos.");
      }

      const pronosticos = [];
      const idsUsados = new Set();

      for (const p of quiniela) {
        const partidoId = Number(p.partido_id);
        const local = p.local;
        const visitante = p.visitante;

        if (
          !idsValidos.includes(partidoId) ||
          idsUsados.has(partidoId)
        ) {
          throw new Error("Hay partidos incorrectos o repetidos.");
        }

        if (
          local === "" || local == null ||
          visitante === "" || visitante == null
        ) {
          throw new Error("Debes completar todos los marcadores.");
        }

        const gl = Number(local);
        const gv = Number(visitante);

        if (
          !Number.isInteger(gl) ||
          !Number.isInteger(gv) ||
          gl < 0 || gv < 0 ||
          gl > 20 || gv > 20
        ) {
          throw new Error("Los marcadores deben estar entre 0 y 20.");
        }

        idsUsados.add(partidoId);

        pronosticos.push({
          partido_id: partidoId,
          local: gl,
          visitante: gv
        });
      }

      pronosticos.sort((a, b) => a.partido_id - b.partido_id);

      const firma = JSON.stringify(pronosticos);

      if (firmas.has(firma)) {
        throw new Error("No puedes registrar quinielas idénticas.");
      }

      firmas.add(firma);
      quinielasNormalizadas.push(pronosticos);
    }

    const usuarioResult = await client.query(
      `INSERT INTO users (nombre, telefono)
       VALUES ($1, $2)
       ON CONFLICT (nombre)
       DO UPDATE SET telefono = EXCLUDED.telefono
       RETURNING id`,
      [nombreLimpio, telefonoLimpio]
    );

    const userId = usuarioResult.rows[0].id;

    const existentes = await client.query(
      `SELECT envio_id, partido_id, goles_local, goles_visitante
       FROM predicciones
       WHERE user_id = $1 AND jornada = $2
       ORDER BY envio_id, partido_id`,
      [userId, jornadaNumero]
    );

    const grupos = new Map();

    for (const p of existentes.rows) {
      if (!grupos.has(p.envio_id)) grupos.set(p.envio_id, []);

      grupos.get(p.envio_id).push({
        partido_id: Number(p.partido_id),
        local: p.goles_local,
        visitante: p.goles_visitante
      });
    }

    const firmasExistentes = new Set(
      [...grupos.values()].map(p => JSON.stringify(p))
    );

    for (const firma of firmas) {
      if (firmasExistentes.has(firma)) {
        throw new Error(
          "Una de estas quinielas ya fue registrada anteriormente."
        );
      }
    }

    const fechaEnvio = moment
      .tz("America/Mexico_City")
      .format("YYYY-MM-DD HH:mm:ss");

    const envios = [];


    // ==========================================
    // 🎁 PRECIO DEFINITIVO DE LA COMPRA
    // ==========================================

    const precioCompra = await calcularPrecioPromocional(
    quinielasNormalizadas.length,
    client
    );

    const compraId =
      Date.now().toString() +
      "_COMPRA_" +
      require("crypto").randomBytes(8).toString("hex");

    await client.query(`
      INSERT INTO compras_quinielas (
        compra_id,
        jornada,
        user_id,
        cantidad,
        precio_normal,
        precio_final,
        ahorro,
        promocion_id,
        promocion_nombre
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      compraId,
      jornadaNumero,
      userId,
      precioCompra.cantidad,
      precioCompra.precio_normal,
      precioCompra.precio_final,
      precioCompra.ahorro,
      precioCompra.promocion?.id ?? null,
      precioCompra.promocion?.nombre ?? null
    ]);


    for (const quiniela of quinielasNormalizadas) {
      const envioId =
        Date.now().toString() +
        "_MULTI_" +
        require("crypto").randomBytes(8).toString("hex");

      for (const p of quiniela) {
        await client.query(
          `INSERT INTO predicciones
           (user_id, partido_id, goles_local, goles_visitante,
            jornada, envio_id, telefono, estado_pago, fecha_envio)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            userId,
            p.partido_id,
            p.local,
            p.visitante,
            jornadaNumero,
            envioId,
            telefonoLimpio,
            "Pendiente",
            fechaEnvio
          ]
        );
      }

      envios.push(envioId);


      // Vincular esta quiniela con su compra
      await client.query(`
        INSERT INTO compras_quinielas_envios (
          compra_id,
          envio_id
        )
        VALUES ($1, $2)
      `, [
        compraId,
        envioId
      ]);

    }

    await client.query("COMMIT");

  
    return res.json({
      ok: true,
      compra_id: compraId,
      cantidad: envios.length,
      precio_normal: precioCompra.precio_normal,
      total: precioCompra.precio_final,
      ahorro: precioCompra.ahorro,
      promocion: precioCompra.promocion,
      envios
    });


  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Error al revertir:", rollbackError);
      }
    }

    console.error("Error guardando múltiples:", error);

    return res.status(
      error.message.startsWith("duplicate key") ? 409 : 400
    ).json({
      ok: false,
      error: error.message || "No se pudieron guardar las quinielas."
    });

  } finally {
    if (client) client.release();
    enviosEnProceso.delete(llaveEnvio);
  }
});


// ==========================================================
// 🔓 CAPTURA ADMINISTRATIVA DE QUINIELAS
// Permite registrar después del cierre público
// pero SOLO hasta que comience el primer partido.
// ==========================================================

app.post('/admin/guardar-quiniela', async (req, res) => {

  const {
    password,
    nombre,
    telefono,
    jornada,
    pronosticos
  } = req.body;

  try {

    // 🔐 VALIDAR CONTRASEÑA ADMIN
    if (password !== process.env.ADMIN_PASSWORD) {

      return res.status(403).json({
        ok: false,
        error: "Contraseña de administrador incorrecta."
      });

    }

    // 👤 VALIDAR NOMBRE
    if (!nombre || nombre.trim().length < 2) {

      return res.status(400).json({
        ok: false,
        error: "Escribe un nombre válido."
      });

    }

    // 📅 VALIDAR JORNADA
    if (!jornada) {

      return res.status(400).json({
        ok: false,
        error: "Jornada requerida."
      });

    }

    // 📝 VALIDAR PRONÓSTICOS
    if (!Array.isArray(pronosticos) || pronosticos.length === 0) {

      return res.status(400).json({
        ok: false,
        error: "No hay pronósticos para guardar."
      });

    }

    // ⚽ OBTENER PARTIDOS DE LA JORNADA
    const partidosResult = await pool.query(`
      SELECT
        id,
        fecha
      FROM partidos
      WHERE jornada = $1
      ORDER BY fecha ASC
    `, [jornada]);

    if (partidosResult.rows.length === 0) {

      return res.status(400).json({
        ok: false,
        error: "La jornada no tiene partidos."
      });

    }

    // ⏰ PRIMER PARTIDO
    const primerPartido = moment.tz(
      partidosResult.rows[0].fecha,
      "YYYY-MM-DD HH:mm:ss",
      "America/Mexico_City"
    );

    const ahora = moment.tz(
      "America/Mexico_City"
    );

    // 🔒 CERRAR EXACTAMENTE CUANDO COMIENZA
    if (ahora.isSameOrAfter(primerPartido)) {

      return res.status(403).json({

        ok: false,

        error:
          "Ya comenzó el primer partido. " +
          "La captura administrativa está cerrada.",

        fechaPrimerPartido:
          primerPartido.format("YYYY-MM-DD HH:mm:ss")

      });

    }

    // ✅ IDS DE PARTIDOS VÁLIDOS
    const idsValidos = new Set(
      partidosResult.rows.map(
        p => Number(p.id)
      )
    );

    // ✅ DEBE HABER UN PRONÓSTICO POR PARTIDO
    if (pronosticos.length !== partidosResult.rows.length) {

      return res.status(400).json({

        ok: false,

        error:
          "Debes capturar el marcador de todos los partidos."

      });

    }

    // 🔍 VALIDAR CADA PRONÓSTICO
    const idsUsados = new Set();

    for (const p of pronosticos) {

      const partidoId =
        Number(p.partido_id);

      if (!idsValidos.has(partidoId)) {

        return res.status(400).json({

          ok: false,

          error:
            "Uno de los partidos no pertenece a esta jornada."

        });

      }

      if (idsUsados.has(partidoId)) {

        return res.status(400).json({

          ok: false,

          error:
            "Hay un partido repetido en los pronósticos."

        });

      }

      idsUsados.add(partidoId);

      if (
        p.goles_local === "" ||
        p.goles_visitante === "" ||
        p.goles_local == null ||
        p.goles_visitante == null
      ) {

        return res.status(400).json({

          ok: false,

          error:
            "Debes capturar todos los marcadores."

        });

      }

      if (
        !Number.isInteger(
          Number(p.goles_local)
        ) ||
        !Number.isInteger(
          Number(p.goles_visitante)
        )
      ) {

        return res.status(400).json({

          ok: false,

          error:
            "Los marcadores deben ser números."

        });

      }

    }

    const nombreLimpio =
      nombre.trim();

    const telefonoLimpio =
      telefono
        ? telefono.trim()
        : null;

    // 👤 BUSCAR O CREAR USUARIO
    let user =
      await pool.query(
        `
        SELECT id
        FROM users
        WHERE nombre = $1
        LIMIT 1
        `,
        [nombreLimpio]
      );

    let userId;

    if (user.rows.length === 0) {

      const nuevoUsuario =
        await pool.query(
          `
          INSERT INTO users
          (
            nombre,
            telefono
          )
          VALUES
          ($1,$2)
          RETURNING id
          `,
          [
            nombreLimpio,
            telefonoLimpio
          ]
        );

      userId =
        nuevoUsuario.rows[0].id;

    } else {

      userId =
        user.rows[0].id;

    }

    // 🆔 ID ÚNICO DE LA QUINIELA
    const envioId =
      Date.now().toString() +
      "_ADMIN_" +
      Math.random()
        .toString(36)
        .substring(2, 8);

    // 📅 FECHA DE REGISTRO
    const fechaEnvio =
      moment
        .tz("America/Mexico_City")
        .format("YYYY-MM-DD HH:mm:ss");

    // 🔥 TRANSACCIÓN
    const client =
      await pool.connect();

    try {

      await client.query("BEGIN");

      for (const p of pronosticos) {

        const golesLocal =
          parseInt(
            p.goles_local,
            10
          );

        const golesVisitante =
          parseInt(
            p.goles_visitante,
            10
          );

        await client.query(
          `
          INSERT INTO predicciones
          (
            user_id,
            partido_id,
            goles_local,
            goles_visitante,
            jornada,
            envio_id,
            telefono,
            estado_pago,
            fecha_envio
          )
          VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          `,
          [
            userId,
            Number(p.partido_id),
            golesLocal,
            golesVisitante,
            jornada,
            envioId,
            telefonoLimpio,
            "Pendiente",
            fechaEnvio
          ]
        );

      }

      await client.query("COMMIT");

      return res.json({

        ok: true,

        envio_id: envioId,

        fechaEnvio,

        fechaPrimerPartido:
          primerPartido.format(
            "YYYY-MM-DD HH:mm:ss"
          )

      });

    } catch (error) {

      await client.query("ROLLBACK");

      throw error;

    } finally {

      client.release();

    }

  } catch (err) {

    console.error(
      "❌ ERROR CAPTURA ADMIN:",
      err
    );

    return res.status(500).json({

      ok: false,

      error:
        "Error interno al registrar la quiniela."

    });

  }

});

app.post('/admin/resultado', verificarAdmin, async (req, res) => {
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

app.post('/recordatorio/enviado', verificarAdmin, async (req, res) => {
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

app.post('/recordatorios/quitar', verificarAdmin, async (req, res) => {
    const { ids } = req.body;

    try{

        await pool.query(

            `
            UPDATE users
            SET ocultar_recordatorio = TRUE
            WHERE id = ANY($1)
            `,

            [ids]

        );

        res.json({ ok:true });

    }catch(err){

        console.error(err);

        res.status(500).json({
            error:"No fue posible quitar los participantes."
        });

    }

});

app.post('/recordatorios/eliminar', verificarAdmin, async (req, res) => {
    const { ids } = req.body;

    try{

        await pool.query(

            `
            DELETE FROM users
            WHERE id = ANY($1)
            `,

            [ids]

        );

        res.json({ ok:true });

    }catch(err){

        console.error(err);

        res.status(500).json({
            error:"No fue posible eliminar los participantes."
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

    const fechaMexico = moment
  .tz(fecha, "YYYY-MM-DDTHH:mm", "America/Mexico_City")
  .format("YYYY-MM-DD HH:mm:ss");

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


app.get("/tabla-imagen", async (req, res) => {

    const jornada = req.query.jornada || 1;

    try {

        const partidosResult = await pool.query(`
            SELECT *
            FROM partidos
            WHERE jornada = $1
            ORDER BY COALESCE(orden,999), id
        `,[jornada]);

        const partidos = partidosResult.rows;

        const tabla = await fetchTabla(jornada);

        const bolsaResult = await pool.query(`
            SELECT COUNT(DISTINCT envio_id) participantes
            FROM predicciones
            WHERE jornada = $1
        `,[jornada]);

        const participantes =
            parseInt(bolsaResult.rows[0].participantes || 0);

        
        // 💰 Calcular la recaudación real de todas las compras
        // Incluye pagadas y pendientes, con descuentos.

        const ingresosResult = await pool.query(`
            SELECT COALESCE(SUM(precio_final), 0) AS total
            FROM compras_quinielas
            WHERE jornada = $1
        `, [jornada]);

        // Quinielas antiguas o administrativas sin compra vinculada
        const anterioresResult = await pool.query(`
            SELECT COUNT(DISTINCT pr.envio_id) AS total
            FROM predicciones pr
            LEFT JOIN compras_quinielas_envios ce
                ON ce.envio_id = pr.envio_id
            WHERE pr.jornada = $1
              AND ce.envio_id IS NULL
        `, [jornada]);

        const totalCompras =
            Number(ingresosResult.rows[0].total) || 0;

        const totalAnteriores =
            Number(anterioresResult.rows[0].total) || 0;

        const recaudado = Math.round(
            (totalCompras + totalAnteriores * 50) * 100
        ) / 100;

        const bolsa = Math.round(recaudado * 0.80 * 100) / 100;


        const premio =
            participantes <= 750
                ? bolsa
                : bolsa * 0.65;

        res.json({

            jornada,

            premio,

            participantes,

            partidos,

            tabla

        });

    }

    catch(err){

        console.error(err);

        res.status(500).json({
            error:true
        });

    }

});


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
     TO_CHAR(pr.fecha_envio, 'DD/MM/YYYY HH24:MI:SS') AS fecha_envio,
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

                u.id,

                u.nombre,

                p.envio_id,

                MIN(p.fecha_envio) AS fecha_envio

            FROM predicciones p

            INNER JOIN users u
                ON u.id = p.user_id

            WHERE p.jornada = $1

            GROUP BY
                u.id,
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
  console.log("🚀 ENTRÓ A EDITAR PRONÓSTICOS");
  console.log(req.body);

    const { envio_id, jornada, pronosticos } = req.body;

    const client = await pool.connect();

try{

    const primerPartido = await client.query(`
    SELECT fecha::text AS fecha
    FROM partidos
    WHERE jornada = $1
    ORDER BY fecha ASC
    LIMIT 1
`, [jornada]);

if (primerPartido.rows.length > 0) {

  console.log(primerPartido.rows[0].fecha);
console.log(typeof primerPartido.rows[0].fecha);
console.log(primerPartido.rows[0].fecha instanceof Date);

const fechaBD = moment.tz(
    primerPartido.rows[0].fecha,
    "YYYY-MM-DD HH:mm:ss",
    "America/Mexico_City"
);

const ahora = moment.tz("America/Mexico_City");

console.log("Fecha México:", fechaBD.format());
console.log("Ahora México:", ahora.format());

if (ahora.isSameOrAfter(fechaBD)) {

    return res.status(403).json({
        ok:false,
        error:"La jornada ya inició."
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

app.post("/admin/cambiar-nombre", async (req, res) => {

    const { envio_id, nombre } = req.body;

    if (!envio_id || !nombre || !nombre.trim()) {
        return res.status(400).json({
            ok: false,
            error: "envio_id y nombre son requeridos."
        });
    }

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        // Obtener el usuario y teléfono actuales de ESTA quiniela
        const usuarioActual = await client.query(`
            SELECT
                pr.user_id,
                u.telefono
            FROM predicciones pr
            INNER JOIN users u
                ON u.id = pr.user_id
            WHERE pr.envio_id = $1
            LIMIT 1
        `, [envio_id]);

        if (usuarioActual.rows.length === 0) {
            throw new Error("Quiniela no encontrada.");
        }

        const telefonoActual = usuarioActual.rows[0].telefono;

        // Buscar si el nombre ya existe
const usuarioExistente = await client.query(`
    SELECT id
    FROM users
    WHERE nombre = $1
    LIMIT 1
`, [nombre.trim()]);

let nuevoUserId;

if (usuarioExistente.rows.length > 0) {

    // El nombre ya existe → reutilizamos ese usuario
    nuevoUserId = usuarioExistente.rows[0].id;

} else {

    // El nombre no existe → creamos uno nuevo
    const nuevoUsuario = await client.query(`
        INSERT INTO users (
            nombre,
            telefono
        )
        VALUES ($1, $2)
        RETURNING id
    `, [
        nombre.trim(),
        telefonoActual
    ]);

    nuevoUserId = nuevoUsuario.rows[0].id;
}

        // Cambiar solamente ESTA quiniela
        await client.query(`
            UPDATE predicciones
            SET user_id = $1
            WHERE envio_id = $2
        `, [
            nuevoUserId,
            envio_id
        ]);

        await client.query("COMMIT");

        res.json({
            ok: true,
            user_id: nuevoUserId
        });

    } catch (err) {

        await client.query("ROLLBACK");

        console.error("❌ ERROR CAMBIANDO NOMBRE:", err);

        res.status(500).json({
            ok: false,
            error: "No fue posible actualizar el nombre."
        });

    } finally {

        client.release();

    }

});

// =========================================
// ESTADO DE QUINIELAS
// =========================================

app.get("/admin/estado-quinielas", async (req, res) => {
    try {

        const jornada = parseInt(req.query.jornada);

        if (!jornada) {
            return res.status(400).json({
                ok: false,
                error: "Jornada requerida"
            });
        }

        
const resultado = await pool.query(`
    SELECT
        pr.envio_id,
        u.nombre,
        pr.telefono,
        MIN(pr.fecha_envio) AS fecha_envio,
        MIN(pr.estado_pago) AS estado_pago,

        
        MAX(c.compra_id) AS compra_id,
        MAX(c.cantidad) AS cantidad_compra,
        MAX(c.precio_normal) AS precio_normal_compra,
        MAX(c.precio_final) AS precio_final_compra,
        MAX(c.ahorro) AS ahorro_compra

    FROM predicciones pr

    JOIN users u
        ON u.id = pr.user_id

    LEFT JOIN compras_quinielas_envios ce
        ON ce.envio_id = pr.envio_id

    LEFT JOIN compras_quinielas c
        ON c.compra_id = ce.compra_id


    WHERE pr.jornada = $1

    GROUP BY
        pr.envio_id,
        u.nombre,
        pr.telefono

    ORDER BY fecha_envio DESC
`, [jornada]);


        res.json({
            ok: true,
            quinielas: resultado.rows
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            ok: false,
            error: "Error al obtener quinielas"
        });

    }
});

app.get('/admin/estado-edicion', async (req, res) => {

    try{

        const { jornada } = req.query;

        const result = await pool.query(`
            SELECT
                TO_CHAR(fecha, 'YYYY-MM-DD HH24:MI:SS') AS fecha
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

        const primerPartido = moment.tz(
            result.rows[0].fecha,
            "YYYY-MM-DD HH:mm:ss",
            "America/Mexico_City"
        );

        const ahora = moment.tz("America/Mexico_City");

        console.log("BD:", result.rows[0].fecha);
        console.log("Inicio:", primerPartido.format());
        console.log("Ahora:", ahora.format());
        console.log("Offset Inicio:", primerPartido.utcOffset());
        console.log("Offset Ahora:", ahora.utcOffset());
        console.log("Abierta:", ahora.isBefore(primerPartido));

        res.json({
            abierta: ahora.isBefore(primerPartido),
            fechaPrimerPartido: primerPartido.format()
        });

    }catch(err){

        console.error(err);

        res.status(500).json({
            error: err.message
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


    // 💰 Recaudación de todas las compras registradas
    // Incluye pagadas y pendientes, con descuentos aplicados.

    const ingresos = await pool.query(`
        SELECT
            COALESCE(SUM(precio_final), 0) AS total
        FROM compras_quinielas
        WHERE jornada = $1
    `, [jornada]);

    // Quinielas antiguas o administrativas
    // que no están vinculadas a una compra.
    const anteriores = await pool.query(`
        SELECT COUNT(DISTINCT pr.envio_id) AS total
        FROM predicciones pr
        LEFT JOIN compras_quinielas_envios ce
            ON ce.envio_id = pr.envio_id
        WHERE pr.jornada = $1
          AND ce.envio_id IS NULL
    `, [jornada]);

    const totalCompras = Number(ingresos.rows[0].total) || 0;

    const totalAnteriores =
        Number(anteriores.rows[0].total) || 0;

    const recaudado = Math.round(
        (totalCompras + totalAnteriores * 50) * 100
    ) / 100;

    const administracion = Math.round(
        recaudado * 0.20 * 100
    ) / 100;

    const bolsaPremios = Math.round(
        (recaudado - administracion) * 100
    ) / 100;


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
  "YYYY-MM-DD HH:mm:ss",
  "America/Mexico_City"
);

// 🔒 Cierre 3 horas antes del primer partido
const limite = fechaPartido
  .clone()
  .subtract(2, 'hours');

  

    // 🔥 HORA ACTUAL MÉXICO
    const ahora = moment.tz("America/Mexico_City");

    // 🔥 COMPARACIÓN REAL
    const bloqueada = ahora.valueOf() >= limite.valueOf();

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
  const fechaMexico = moment
  .tz(fecha, "YYYY-MM-DDTHH:mm", "America/Mexico_City")
  .format("YYYY-MM-DD HH:mm:ss");

console.log("Fecha recibida:", fecha);
console.log("Fecha México:", fechaMexico);
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

app.get('/backup', verificarAdmin, async (req, res) => {
  try {

    const users = await pool.query(`SELECT * FROM users`);
    const partidos = await pool.query(`SELECT * FROM partidos`);
    const predicciones = await pool.query(`SELECT * FROM predicciones`);

    const backup = {
      //fecha: new Date(),
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


/* ============================================
   PDF TABLA GENERAL - QUINIELAS EL INGE
   FORMATO CARTA VERTICAL
============================================ */

app.get('/admin/exportar-pdf', verificarAdmin, async (req, res) => {
  try {
    const jornada = Number(req.query.jornada);

    if (!Number.isInteger(jornada) || jornada < 1) {
      return res.status(400).send('Jornada no válida');
    }

    const resultadoPartidos = await pool.query(`
      SELECT id, local, visitante, logo_local, logo_visitante,
             goles_local, goles_visitante
      FROM partidos
      WHERE jornada = $1
      ORDER BY COALESCE(orden, 999), id
    `, [jornada]);

    const partidos = resultadoPartidos.rows;

    if (!partidos.length) {
      return res.status(404).send('No hay partidos registrados');
    }

    const resultadoPronosticos = await pool.query(`
      SELECT pr.envio_id, u.nombre, pr.partido_id,
             pr.goles_local, pr.goles_visitante
      FROM predicciones pr
      JOIN users u ON u.id = pr.user_id
      WHERE pr.jornada = $1
      ORDER BY pr.envio_id
    `, [jornada]);

    const participantes = new Map();

    for (const pr of resultadoPronosticos.rows) {
      if (!participantes.has(pr.envio_id)) {
        participantes.set(pr.envio_id, {
          nombre: pr.nombre,
          pronosticos: new Map(),
          puntos: 0
        });
      }

      participantes.get(pr.envio_id)
        .pronosticos.set(Number(pr.partido_id), pr);
    }

    const tabla = [...participantes.values()];

    // CALCULAR BOLSA DE PREMIOS

const cantidadQuinielas = participantes.size;
const porcentajePremios = 0.80;

// Compras registradas con sus descuentos
const comprasPDF = await pool.query(`
    SELECT COALESCE(SUM(precio_final), 0) AS total
    FROM compras_quinielas
    WHERE jornada = $1
`, [jornada]);

// Quinielas antiguas o administrativas
const anterioresPDF = await pool.query(`
    SELECT COUNT(DISTINCT pr.envio_id) AS total
    FROM predicciones pr
    LEFT JOIN compras_quinielas_envios ce
        ON ce.envio_id = pr.envio_id
    WHERE pr.jornada = $1
      AND ce.envio_id IS NULL
`, [jornada]);

const recaudadoPDF = Math.round((
    Number(comprasPDF.rows[0].total || 0) +
    Number(anterioresPDF.rows[0].total || 0) * 50
) * 100) / 100;

const bolsaPremiosPDF = Math.round(
    recaudadoPDF * porcentajePremios * 100
) / 100;



const bolsaFormateada = bolsaPremiosPDF.toLocaleString('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

    for (const jugador of tabla) {
      for (const partido of partidos) {
        const pr = jugador.pronosticos.get(Number(partido.id));

        if (!pr || partido.goles_local == null ||
            partido.goles_visitante == null) continue;

        jugador.puntos += calcularPuntos(partido, pr);
      }
    }

    tabla.sort((a, b) =>
      b.puntos - a.puntos ||
      a.nombre.localeCompare(b.nombre, 'es')
    );

    // GANADORES SOLO CUANDO TODOS LOS PARTIDOS TERMINEN
const jornadaTerminada = partidos.every(p =>
  p.goles_local != null && p.goles_visitante != null
);

// Obtener puntuaciones distintas de mayor a menor
const puntuaciones = [
  ...new Set(tabla.map(jugador => jugador.puntos))
].sort((a, b) => b - a);

const primerPuntaje = puntuaciones[0];
const segundoPuntaje = puntuaciones[1];

const primerosLugares = jornadaTerminada
  ? tabla.filter(j => j.puntos === primerPuntaje)
  : [];

const segundosLugares = jornadaTerminada
  ? tabla.filter(j => j.puntos === segundoPuntaje)
  : [];

    // Descargar logos compatibles con PDFKit
    const logos = new Map();

    async function obtenerLogo(url) {
      if (!url || typeof url !== 'string') return null;
      if (logos.has(url)) return logos.get(url);

      let imagen = null;

      try {
        const direccion = new URL(url);

        if (direccion.protocol === 'https:') {

  // Fetch exclusivo para los logos del PDF
  const { default: fetchPDF } = await import('node-fetch');

  const respuesta = await fetchPDF(url, {
    timeout: 6000,
    headers: {
      Accept: 'image/png,image/jpeg'
    }
  });

          const tipo = respuesta.headers.get('content-type') || '';
          const largo = Number(
            respuesta.headers.get('content-length') || 0
          );

          if (respuesta.ok &&
              /image\/(png|jpeg|jpg)/i.test(tipo) &&
              largo <= 1000000) {
            const buffer = Buffer.from(await respuesta.arrayBuffer());
            if (buffer.length <= 1000000) {
              imagen = buffer;
            }
          }
        }
      } catch (error) {
        console.log('Logo no disponible:', error.message);
      }

      logos.set(url, imagen);
      return imagen;
    }

    for (const p of partidos) {
      await obtenerLogo(p.logo_local);
      await obtenerLogo(p.logo_visitante);
    }
const fs = require('fs');

const rutaLogoInge = path.join(__dirname, 'public', 'logo2.png');

const logoIngeDisponible = fs.existsSync(rutaLogoInge);

    const doc = new PDFDocument({
      size: 'LETTER',
      layout: 'portrait',
      margin: 20,
      bufferPages: true,
      autoFirstPage: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Resultados-Semana-${jornada}.pdf"`
    );

    doc.pipe(res);

    const AZUL = '#102B50';
    const DORADO = '#F3C84B';
    const VERDE = '#24A148';
    const AMARILLO = '#F8C53A';
    const ROJO = '#D83B40';
    const GRIS = '#B7BDC8';
    const BLANCO = '#FFFFFF';

    const margen = 20;
    const anchoPagina = doc.page.width - margen * 2;
    const anchoNombre = 116;
    const anchoPuntos = 38;
    const anchoPartido =
      (anchoPagina - anchoNombre - anchoPuntos) /
      partidos.length;

    const alturaFila = 23;

// Espacio reservado para ganadores
const mostrarGanadores = jornadaTerminada && tabla.length > 0;

const textoPrimeros = primerosLugares
  .map(j => j.nombre)
  .join(', ');

const textoSegundos = segundosLugares
  .map(j => j.nombre)
  .join(', ');

const alturaGanadores = mostrarGanadores
  ? 66
  : 0;

const inicioFilas = 192 + alturaGanadores;

    const limiteInferior = doc.page.height - 45;

    function textoCorto(texto, maximo) {
      const valor = String(texto || '');
      return valor.length > maximo
        ? valor.slice(0, maximo - 1) + '.'
        : valor;
    }

    function pintarLogo(url, x, y, nombre) {
      const imagen = logos.get(url);

      if (imagen) {
        try {
          doc.image(imagen, x, y, {
            fit: [22, 22],
            align: 'center'
          });
          return;
        } catch (error) {
          // Usar abreviatura si PDFKit no admite el logo
        }
      }

      doc.fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(5)
        .text(
          textoCorto(nombre, 3).toUpperCase(),
          x - 1, y + 3,
          { width: 15, align: 'center' }
        );
    }

    function encabezado() {
      doc.rect(0, 0, doc.page.width, 80).fill(AZUL);
// LOGO DE QUINIELAS EL INGE - TODAS LAS PÁGINAS
if (logoIngeDisponible) {
  try {
    doc.image(rutaLogoInge, doc.page.width - 88, 12, {
      fit: [55, 55],
      align: 'center',
      valign: 'center'
    });
  } catch (error) {
    console.log('No se pudo mostrar el logo:', error.message);
  }
}

      doc.fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(19)
        .text('QUINIELAS EL INGE', 20, 18, {
          align: 'center'
        });


      doc.fillColor(DORADO)
  .fontSize(11)
  .text(`TABLA DE RESULTADOS - SEMANA ${jornada}`,
    20, 47, { align: 'center' });

// BOLSA EN JUEGO
doc.fillColor('#FFD700')
  .font('Helvetica-Bold')
  .fontSize(13)
  .text(
    `BOLSA EN JUEGO: ${bolsaFormateada}`,
    margen,
    62,
    {
      width: anchoPagina,
      align: 'center',
      lineBreak: false
    }
  );

// Leyenda de colores
const leyenda = [
        { color: VERDE, texto: '2 PUNTOS' },
        { color: AMARILLO, texto: '1 PUNTO' },
        { color: ROJO, texto: '0 PUNTOS' },
        { color: GRIS, texto: 'PENDIENTE' }
      ];

      let lx = 68;

      for (const item of leyenda) {
        doc.roundedRect(lx, 85, 11, 11, 2)
          .fill(item.color);

        doc.fillColor(AZUL)
          .font('Helvetica-Bold')
          .fontSize(7)
          .text(item.texto, lx + 15, 87, {
            width: 80
          });

        lx += 125;
      }
// CUADRO DE GANADORES - REPETIDO EN TODAS LAS PÁGINAS
if (mostrarGanadores) {
  const yGanadores = 105;

  doc.roundedRect(
    margen,
    yGanadores,
    anchoPagina,
    62,
    6
  ).fill('#EAF1F8');

  doc.fillColor(AZUL)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('GANADORES OFICIALES', margen + 8, yGanadores + 5, {
      width: anchoPagina - 16,
      align: 'center'
    });

  doc.fillColor('#A47A12')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(
      `1ER LUGAR (${primerPuntaje} PTS): ${textoPrimeros}`,
      margen + 10,
      yGanadores + 23,
      {
        width: anchoPagina - 20,
        height: 15,
        ellipsis: true
      }
    );

  if (segundosLugares.length) {
    doc.fillColor('#52657A')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(
        `2DO LUGAR (${segundoPuntaje} PTS): ${textoSegundos}`,
        margen + 10,
        yGanadores + 42,
        {
          width: anchoPagina - 20,
          height: 15,
          ellipsis: true
        }
      );
  }
}

      // Encabezado de partidos
    
      // ENCABEZADO COMPACTO:
      // LOGO LOCAL | RESULTADO O VS | LOGO VISITANTE

      const yEncabezado = 108 + alturaGanadores;
      const altoEncabezado = 76;

      doc.rect(
        margen,
        yEncabezado,
        anchoPagina,
        altoEncabezado
      ).fill(AZUL);

      // Título de la primera columna
      doc.fillColor(BLANCO)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(
          'PARTICIPANTE',
          margen + 5,
          yEncabezado + 34,
          {
            width: anchoNombre - 8
          }
        );

      // Logos y marcadores de los partidos
      // LOGOS VERTICALES Y MARCADOR CENTRADO
partidos.forEach((p, i) => {

  const x = margen + anchoNombre + i * anchoPartido;
  const centro = x + anchoPartido / 2;

  const finalizado =
    p.goles_local != null &&
    p.goles_visitante != null;

  const resultado = finalizado
    ? `${p.goles_local}-${p.goles_visitante}`
    : 'VS';

  // Escudos de 24 puntos, centrados
  const tamanoLogo = Math.min(24, anchoPartido - 6);
  const xLogo = centro - tamanoLogo / 2;

  // LOGO LOCAL - ARRIBA
  pintarLogo(
    p.logo_local,
    xLogo,
    yEncabezado + 5,
    p.local
  );

  // MARCADOR - EN MEDIO
  doc.fillColor(finalizado ? DORADO : BLANCO)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(
      resultado,
      x + 2,
      yEncabezado + 34,
      {
        width: anchoPartido - 4,
        align: 'center'
      }
    );

  // LOGO VISITANTE - ABAJO
  pintarLogo(
    p.logo_visitante,
    xLogo,
    yEncabezado + 48,
    p.visitante
  );

});

      // Título de la última columna
          doc.fillColor(DORADO)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(
          'PTS',
          margen + anchoPagina - anchoPuntos,
          yEncabezado + 34,
          {
            width: anchoPuntos,
            align: 'center'
          }
        );

      doc.y = inicioFilas;
    }

    encabezado();

    let y = inicioFilas;

    tabla.forEach((jugador, indice) => {
      if (y + alturaFila > limiteInferior) {
        doc.addPage();
        encabezado();
        y = inicioFilas;
      }

      const fondo = indice % 2 === 0
        ? '#EDF2F8'
        : BLANCO;

      doc.rect(margen, y, anchoPagina, alturaFila)
        .fill(fondo);

      doc.fillColor(AZUL)
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .text(
          `${indice + 1}. ${jugador.nombre}`,
          margen + 4,
          y + 7,
          {
            width: anchoNombre - 7,
            ellipsis: true,
            lineBreak: false
          }
        );

      partidos.forEach((partido, i) => {
        const x = margen + anchoNombre + i * anchoPartido;
        const pr = jugador.pronosticos.get(Number(partido.id));

        let marcador = '-';
        let color = GRIS;
        let puntos = null;

        if (pr) {
          marcador = `${pr.goles_local}-${pr.goles_visitante}`;

          if (partido.goles_local != null &&
              partido.goles_visitante != null) {
            puntos = calcularPuntos(partido, pr);

            color = puntos === 2 ? VERDE
              : puntos === 1 ? AMARILLO
              : ROJO;
          }
        }

        doc.roundedRect(
          x + 2,
          y + 3,
          Math.max(1, anchoPartido - 4),
          17,
          3
        ).fill(color);

        doc.fillColor(
          puntos === 1 || puntos === null
            ? '#172033'
            : BLANCO
        )
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(marcador, x + 2, y + 7, {
            width: anchoPartido - 4,
            align: 'center'
          });
      });

      doc.fillColor(AZUL)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(
          String(jugador.puntos),
          margen + anchoPagina - anchoPuntos,
          y + 6,
          {
            width: anchoPuntos,
            align: 'center'
          }
        );

      y += alturaFila;
    });

    // Número de página en todas las hojas
    const rango = doc.bufferedPageRange();

    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);

      doc.fillColor('#697386')
        .font('Helvetica')
        .fontSize(8)
        .text(
          `quinielasinge.com  |  Página ${i + 1} de ${rango.count}`,
          margen,
          doc.page.height - 30,
          {
            width: anchoPagina,
            align: 'center'
          }
        );
    }

    doc.end();

  } catch (error) {
    console.error('ERROR PDF:', error);

    if (!res.headersSent) {
      res.status(500).send('Error al generar PDF');
    } else {
      res.destroy(error);
    }
  }
});


app.get('/exportar-excel', verificarAdmin, async (req, res) => {
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
    ySplit: 12
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


const ingresosExcel = await pool.query(`
    SELECT COALESCE(SUM(precio_final), 0) AS total
    FROM compras_quinielas
    WHERE jornada = $1
`, [jornada]);

const anterioresExcel = await pool.query(`
    SELECT COUNT(DISTINCT pr.envio_id) AS total
    FROM predicciones pr
    LEFT JOIN compras_quinielas_envios ce
        ON ce.envio_id = pr.envio_id
    WHERE pr.jornada = $1
      AND ce.envio_id IS NULL
`, [jornada]);

const totalComprasExcel =
    Number(ingresosExcel.rows[0].total) || 0;

const totalAnterioresExcel =
    Number(anterioresExcel.rows[0].total) || 0;

const recaudado = Math.round(
    (totalComprasExcel + totalAnterioresExcel * 50) * 100
) / 100;

const bolsaPremios = Math.round(
    recaudado * 0.80 * 100
) / 100;


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

// =========================================
// PREMIO + LOGO
// =========================================

// TEXTO DEL PREMIO
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
    size: 22,
    color: { argb: "FFFFFFFF" }
};

premio.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true
};

premio.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
        argb: "FF4F81BD"
    }
};


// ALTURA
sheet.getRow(5).height = 40;
sheet.getRow(6).height = 40;
sheet.getRow(7).height = 40;


// LOGO A LA IZQUIERDA
const logo = workbook.addImage({
    filename: "./public/logo2.png",
    extension: "png"
});

sheet.addImage(logo, {
    tl: { col: 0.2, row: 4.1 },
    br: { col: 2.2, row: 7.0 }
});

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
const filaFecha = [""];
const filaResultado = [""];
const filaVisitante = [""];

partidos.forEach(p => {

    filaLocal.push(p.local);

    // 📅 FECHA Y HORA DEL PARTIDO
    filaFecha.push(
        p.fecha
            ? moment
                .tz(p.fecha, "YYYY-MM-DD HH:mm:ss", "America/Mexico_City")
                .format("DD/MM/YYYY HH:mm")
            : "—"
    );

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

const rowFecha = sheet.insertRow(9, filaFecha);
const rowLocal = sheet.insertRow(10, filaLocal);
const rowResultado = sheet.insertRow(11, filaResultado);
const rowVisitante = sheet.insertRow(12, filaVisitante);

// Ancho columnas
sheet.getColumn(1).width = 22;

for (let i = 2; i < filaLocal.length; i++) {
    sheet.getColumn(i).width = 16;
}

sheet.getColumn(filaLocal.length).width = 10;
// =========================================
// ESTILO CABECERA
// =========================================

[rowLocal, rowFecha, rowResultado, rowVisitante].forEach(row => {

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

// 📅 FECHA Y HORA EN AMARILLO
rowFecha.eachCell((cell) => {

    cell.font = {
        bold: true,
        color: { argb: "FFFFFF00" },
        name: "Arial",
        size: 10
    };

    cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true
    };

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


app.post('/admin/login', (req, res, next) => {
  const user = String(req.body?.user ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (
    !process.env.ADMIN_USER ||
    !process.env.ADMIN_PASSWORD ||
    user !== process.env.ADMIN_USER ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      ok: false,
      error: 'Credenciales incorrectas'
    });
  }

  req.session.regenerate(err => {
    if (err) return next(err);

    req.session.esAdmin = true;

    req.session.save(err => {
      if (err) return next(err);

      res.json({ ok: true });
    });
  });
});

app.post('/admin/logout', verificarAdmin, (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);

    res.clearCookie('inge.sid');
    res.json({ ok: true });
  });
});



function verificarAdmin(req, res, next) {
  if (req.session?.esAdmin === true) {
    return next();
  }

  return res.status(401).json({
    ok: false,
    error: 'Sesión administrativa requerida'
  });
}


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
app.get('/recordatorios', verificarAdmin, async (req, res) => {
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
        AND u.ocultar_recordatorio = FALSE
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

app.post('/recordatorios/reiniciar', verificarAdmin, async (req, res) => {
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

// =========================================
// OBTENER JORNADAS DISPONIBLES
// =========================================

app.get("/admin/jornadas", async (req, res) => {

    try {

        const resultado = await pool.query(`
            SELECT DISTINCT jornada
            FROM predicciones
            ORDER BY jornada DESC
        `);

        res.json({
            ok: true,
            jornadas: resultado.rows.map(r => r.jornada)
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            ok: false,
            error: "Error obteniendo jornadas"
        });

    }

});

// =========================================
// CAMBIAR ESTADO DE PAGO
// =========================================


app.post("/admin/cambiar-estado", async (req, res) => {

    const { envio_id } = req.body || {};

    if (typeof envio_id !== "string" || !envio_id.trim()) {
        return res.status(400).json({
            ok: false,
            error: "envio_id válido requerido"
        });
    }

    let client;

    try {

        client = await pool.connect();

        await client.query("BEGIN");

    
        // Buscar si la quiniela pertenece a una compra.
        const compra = await client.query(`
            SELECT compra_id
            FROM compras_quinielas_envios
            WHERE envio_id = $1
            LIMIT 1
        `, [envio_id]);

        let envios = [envio_id];
        let compraId = null;

        if (compra.rows.length > 0) {

            compraId = compra.rows[0].compra_id;

            const relacionados = await client.query(`
                SELECT envio_id
                FROM compras_quinielas_envios
                WHERE compra_id = $1
            `, [compraId]);

            envios = relacionados.rows.map(
                fila => fila.envio_id
            );

        }

        // Obtener el estado de todas las quinielas.
        const actual = await client.query(`
            SELECT estado_pago
            FROM predicciones
            WHERE envio_id = ANY($1)
        `, [envios]);

        if (actual.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                ok: false,
                error: "Quiniela no encontrada"
            });

        }

        // Si todas están pagadas, pasar a pendiente.
        // En cualquier otro caso, marcar toda la compra pagada.
        const todasPagadas = actual.rows.every(
            fila =>
                String(fila.estado_pago || "")
                    .trim()
                    .toLowerCase() === "pagado"
        );

        const nuevoEstado = todasPagadas
            ? "Pendiente"
            : "Pagado";

        await client.query(`
            UPDATE predicciones
            SET estado_pago = $1
            WHERE envio_id = ANY($2)
        `, [nuevoEstado, envios]);

        await client.query("COMMIT");

        res.json({
            ok: true,
            estado: nuevoEstado,
            compra_id: compraId,
            quinielas_actualizadas: envios.length
        });

   
    } catch (err) {

        if (client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Error al revertir el cambio de pago:",
                    rollbackError
                );
            }
        }

        console.error(err);


        res.status(500).json({
            ok: false,
            error: "Error al cambiar estado"
        });

  
} finally {

    if (client) {
        client.release();
    }

}


});


// 🚀 SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🔥 SERVIDOR PRO corriendo en ${PORT}`);
});