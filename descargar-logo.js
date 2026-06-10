const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com")
    ? { rejectUnauthorized: false }
    : false
});

async function descargarLogo(nombreEquipo) {

  try {

    const nombreArchivo =
      nombreEquipo
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-") + ".png";

    const rutaArchivo = path.join(
      __dirname,
      "logos",
      nombreArchivo
    );

    // Ya existe
    if (await fs.pathExists(rutaArchivo)) {
      console.log("⏭️ Ya existe:", nombreEquipo);
      return;
    }

    const url =
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=` +
      encodeURIComponent(nombreEquipo);

    const { data } = await axios.get(url);

    if (!data.teams || data.teams.length === 0) {
      console.log("❌ No encontrado:", nombreEquipo);
      return;
    }

    const logo = data.teams[0].strBadge;

    if (!logo) {
      console.log("❌ Sin logo:", nombreEquipo);
      return;
    }

    const imagen = await axios.get(logo, {
      responseType: "arraybuffer"
    });

    await fs.writeFile(rutaArchivo, imagen.data);

    console.log("✅ Descargado:", nombreEquipo);

  } catch (err) {

    console.log("❌ Error:", nombreEquipo);
  }
}

async function main() {

  const result = await pool.query(`
    SELECT local, visitante
    FROM partidos
  `);

  const equipos = new Set();

  result.rows.forEach(p => {

    if (p.local) equipos.add(p.local.trim());

    if (p.visitante)
      equipos.add(p.visitante.trim());

  });

  console.log(
    `🔎 Equipos encontrados: ${equipos.size}`
  );

  for (const equipo of equipos) {

    await descargarLogo(equipo);

  }

  await pool.end();

  console.log("🏁 Proceso terminado");
}

main();