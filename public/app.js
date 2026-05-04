let jornadaActual = 1;
let quinielaCerrada = false;

// 🔥 INIT
window.onload = async () => {
  await cargarJornadas();
  cambiarJornada();
  cargarTop4();

  const btn = document.getElementById("btnTabla");
if (btn) btn.onclick = () => verTablaCompleta(jornadaActual);
};

function irTabla() {
  window.location.href = "tabla.html";
}

// 🔥 JORNADAS
async function cargarJornadas() {
  const r = await fetch('/jornadas');
  const data = await r.json();

  const select = document.getElementById('jornadaSelect');
  select.innerHTML = '';

  data.forEach(j => {
    select.innerHTML += `<option value="${j.jornada}">Semana ${j.jornada}</option>`;
  });
}

// 🔥 CAMBIO
function cambiarJornada() {
  jornadaActual = document.getElementById("jornadaSelect").value || 1;

  cargarPartidos();
  cargarTop4();
  cargarCampeon();
  checkBloqueo();
}

// 🔥 ESTADO PARTIDO
function getEstadoPartido(fechaStr) {

  const ahora = new Date();

  const [fechaRaw, horaRaw] = fechaStr.split("T");

  const partidoFecha = new Date(fechaRaw + "T" + horaRaw);

  const diffMin = (ahora - partidoFecha) / 60000;

  if (diffMin > 120) {
    return { texto: "FINALIZADO", clase: "finalizado", icono: "🔒" };
  }

  if (diffMin >= 0 && diffMin <= 120) {
    return { texto: "EN VIVO", clase: "envivo", icono: "🟢" };
  }

  const hoy = new Date();
  if (partidoFecha.toDateString() === hoy.toDateString()) {
    return { texto: "HOY", clase: "hoy", icono: "🕒" };
  }

  return { texto: "PRÓXIMO", clase: "futuro", icono: "📅" };
}

// 🔥 PARTIDOS
async function cargarPartidos() {
  const res = await fetch(`/partidos?jornada=${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById("partidos");
  cont.innerHTML = "";

  data.forEach(p => {

    const estado = getEstadoPartido(p.fecha);

    const [fechaRaw, horaRaw] = p.fecha.split("T");

    const fecha = new Date(fechaRaw);

    const fechaFormateada = fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short'
    });

    const horaFormateada = horaRaw?.slice(0,5) || "";

    cont.innerHTML += `
      <div class="card">

        <div class="estado ${estado.clase}">
          ${estado.icono} ${estado.texto}
        </div>

        <div class="match">

          <div class="team left">
            <img src="${p.logo_local || ''}">
            <span>${p.local}</span>
          </div>

          <div class="score">
  <input type="number" min="0" max="20" id="l${p.id}">
  <span>-</span>
  <input type="number" min="0" max="20" id="v${p.id}">
</div>

          <div class="team right">
            <span>${p.visitante}</span>
            <img src="${p.logo_visitante || ''}">
          </div>

        </div>

        <div class="meta">
          <div class="hora">
            ⏰ ${fechaFormateada} · ${horaFormateada}
          </div>

          <div class="liga">
            🏆 ${p.liga || "Liga MX"}
          </div>
        </div>

      </div>
    `;
  });
}

async function verTablaCompleta(jornada) {

  const res = await fetch(`/tabla?jornada=${jornada}`);
  const data = await res.json();

  const cont = document.getElementById("tabla");
  cont.innerHTML = "";

  // 🔥 seguridad total
  if (!Array.isArray(data) || data.length === 0) {
    cont.innerHTML = "<p>No hay datos</p>";
    return;
  }

  // 🔥 usar el primero seguro
  const totalPartidos = Math.max(...data.map(u => u.picks.length));

  let header = `
    <div class="fila header">
      <div class="celda jugador">Jugador</div>
  `;

  for (let i = 0; i < totalPartidos; i++) {
    header += `<div class="celda">P${i+1}</div>`;
  }

  header += `<div class="celda puntos">Pts</div></div>`;

  cont.innerHTML += header;

  let contador = {};

  data.forEach((u, index) => {

    let claseTop = index === 0 ? "top1"
      : index === 1 ? "top2"
      : index === 2 ? "top3"
      : "";

    if (!contador[u.nombre]) contador[u.nombre] = 1;
    else contador[u.nombre]++;

    const nombreFinal = contador[u.nombre] > 1
      ? `${u.nombre} #${contador[u.nombre]}`
      : u.nombre;

    let fila = `<div class="fila ${claseTop}">`;

    fila += `<div class="celda jugador">
      ${index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : ""}
      ${nombreFinal}
    </div>`;
    // 🔥 pintar picks existentes
u.picks.forEach((p, i) => {
  const valor = p || "-";
  const color = u.detalles[i] || "gris";

  fila += `<div class="celda ${color}">${valor}</div>`;
});

// 🔥 completar columnas faltantes (IMPORTANTE)
for (let i = u.picks.length; i < totalPartidos; i++) {
  fila += `<div class="celda gris">-</div>`;
}

    fila += `<div class="celda puntos">${u.puntos}</div>`;
    fila += `</div>`;

    cont.innerHTML += fila;
  });
}

// 🔥 GUARDAR
async function guardarTodo() {
  if (quinielaCerrada) return alert("🔒 Cerrado");

  let usuario = document.getElementById("usuario").value.trim();

// limpiar caracteres raros
usuario = usuario.replace(/[^a-zA-Z0-9\s]/g, "");

if (usuario.length < 3) {
  alert("Nombre mínimo 3 caracteres");
  return;
}

  if (!usuario) return alert("Pon tu nombre");

  const btn = document.getElementById("btnGuardar");
  if (btn) btn.disabled = true;

  try {
    const partidos = await (await fetch(`/partidos?jornada=${jornadaActual}`)).json();

    const lista = [];

    partidos.forEach(p => {
  const gl = document.getElementById("l" + p.id).value;
  const gv = document.getElementById("v" + p.id).value;

  // si no llenó ambos → lo ignora
  if (gl === "" || gv === "") return;

  const local = parseInt(gl);
  const visitante = parseInt(gv);

  // 🚫 no números
  if (isNaN(local) || isNaN(visitante)) return;

  // 🚫 negativos
  if (local < 0 || visitante < 0) {
    alert("No se permiten goles negativos");
    return;
  }

  // 🚫 marcadores irreales
  if (local > 20 || visitante > 20) {
    alert("Marcador fuera de rango (máx 20)");
    return;
  }

  lista.push({
    partido_id: p.id,
    local,
    visitante
  });
});

    if (lista.length === 0) {
      alert("No capturaste resultados");
      return;
    }

    const res = await fetch('/guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: usuario,
        jornada: jornadaActual,
        pronosticos: lista
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error al guardar");
      return;
    }

    let mensaje = `📊 Quiniela Semana ${jornadaActual}\n`;
    mensaje += `👤 ${usuario}\n\n`;

    lista.forEach(p => {
      const partido = partidos.find(x => x.id === p.partido_id);
      if (!partido) return;
      mensaje += `⚽ ${partido.local} ${p.local}-${p.visitante} ${partido.visitante}\n`;
    });

    const phone = "524531021052";
    const texto = encodeURIComponent(mensaje);
    const url = `https://wa.me/${phone}?text=${texto}`;

    if (/Android|iPhone/i.test(navigator.userAgent)) {
  window.location.href = url;   // 📱 móvil
} else {
  window.open(url, "_blank");   // 💻 computadora
}

    confetti();
    alert("🔥 Quiniela enviada");

  } catch (err) {
    console.error(err);
    alert("❌ Error de conexión");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 🔥 CAMPEÓN
async function cargarCampeon() {
  const res = await fetch(`/campeon?jornada=${jornadaActual}`);
  const data = await res.json();

  let cont = document.getElementById("campeon");
  if (!cont) return;

  if (!data || data.length === 0) {
    cont.innerHTML = "";
    return;
  }

  const nombres = data.map(u => `${u.nombre} (${u.puntos} pts)`).join(" • ");

  cont.innerHTML = `
    <div style="
      background:linear-gradient(90deg,#ffd700,#facc15);
      color:black;
      padding:15px;
      border-radius:12px;
      margin:15px 0;
      font-size:18px;
      font-weight:bold;
      text-align:center;
      box-shadow:0 0 15px gold;
    ">
      🏆 Campeón${data.length > 1 ? "es" : ""} Semana ${jornadaActual}: <br>
      ${nombres}
    </div>
  `;
}

// 🔥 TOP 4 (SOLO UNA)
async function cargarTop4() {
  const res = await fetch(`/top4?jornada=${jornadaActual}`);
  const data = await res.json();

  let cont = document.getElementById("top4");
  if (!cont) return;

  cont.innerHTML = "<h3>🔝 TOP 4</h3>";

  data.forEach((u,i)=>{

    let medal = ["🥇","🥈","🥉","🏅"][i] || "";

    let detallesHTML = u.detalles.map(d => {
      let color = {
        verde: "#22c55e",
        amarillo: "#eab308",
        rojo: "#ef4444",
        gris: "#9ca3af"
      }[d];

      return `<span style="
        display:inline-block;
        width:10px;
        height:10px;
        border-radius:50%;
        background:${color};
        margin:2px;
      "></span>`;
    }).join("");

    cont.innerHTML += `
      <div style="
        background:#132a4f;
        margin:10px;
        padding:10px;
        border-radius:10px;
      ">
        ${medal} ${u.nombre} - ${u.puntos} pts
        <div>${detallesHTML}</div>
      </div>
    `;
  });
}

// 🔒 BLOQUEO
async function checkBloqueo() {
  const r = await fetch(`/limite?jornada=${jornadaActual}`);
  const d = await r.json();

  const estado = document.getElementById("estadoQuiniela");

  if (d.bloqueada) {
    quinielaCerrada = true;

    estado.innerText = "🔒 Quiniela cerrada";
    estado.className = "estado closed";

    document.querySelectorAll(".score input").forEach(i => i.disabled = true);
    document.getElementById("btnGuardar").disabled = true;

  } else {
    quinielaCerrada = false;

    estado.innerText = "🟢 Quiniela abierta";
    estado.className = "estado open";

    document.querySelectorAll(".score input").forEach(i => i.disabled = false);
    document.getElementById("btnGuardar").disabled = false;
  }
}