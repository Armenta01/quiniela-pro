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
async function cargarTop4() {
  const res = await fetch(`/top4?jornada=${jornadaActual}`);
  const data = await res.json();

  let cont = document.getElementById("top4");

  if (!cont) {
    const div = document.createElement("div");
    div.id = "top4";
    document.getElementById("partidos").after(div);
    cont = div;
  }

  cont.innerHTML = "<h3>🔥 TOP 4</h3>";

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
// 🔥 PARTIDOS
async function cargarPartidos() {
  const res = await fetch(`/partidos?jornada=${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById("partidos");
  cont.innerHTML = "";

  data.forEach(p => {
    cont.innerHTML += `
      <div class="card">
        <div class="match">

          <div class="team left">
            <img src="${p.logo_local || ''}">
            <span>${p.local}</span>
          </div>

          <div class="score">
            <input type="number" id="l${p.id}">
            <span>-</span>
            <input type="number" id="v${p.id}">
          </div>

          <div class="team right">
            <span>${p.visitante}</span>
            <img src="${p.logo_visitante || ''}">
          </div>

        </div>

        <div class="meta">

 const [fechaRaw, horaRaw] = p.fecha.split("T");

const fecha = new Date(fechaRaw);

const fechaFormateada = fecha.toLocaleDateString('es-MX', {
  day: '2-digit',
  month: 'short'
});

const horaFormateada = horaRaw?.slice(0,5) || "";

<div class="hora">
  ⏰ ${fechaFormateada} · ${horaFormateada}
</div>

  <div class="liga">
    🏆 ${p.liga || "Liga"}
  </div>

</div>
      </div>
    `;
  });
}

// 🔥 GUARDAR
async function guardarTodo() {
  if (quinielaCerrada) return alert("🔒 Cerrado");

  const usuario = document.getElementById("usuario").value;
  if (!usuario) return alert("Pon tu nombre");

  const btn = document.getElementById("btnGuardar");
  if (btn) btn.disabled = true;

  try {
    const partidos = await (await fetch(`/partidos?jornada=${jornadaActual}`)).json();

    const lista = [];

    partidos.forEach(p => {
      const gl = document.getElementById("l" + p.id).value;
      const gv = document.getElementById("v" + p.id).value;

      if (gl !== "" && gv !== "") {
        lista.push({
          partido_id: p.id,
          local: parseInt(gl),
          visitante: parseInt(gv)
        });
      }
    });

    if (lista.length === 0) {
      alert("No capturaste resultados");
      return;
    }

    // 🔥 GUARDAR EN BACKEND
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

    // 🔥 MENSAJE WHATSAPP
    let mensaje = `📊 Quiniela Semana ${jornadaActual}\n`;
    mensaje += `👤 ${usuario}\n\n`;

    lista.forEach(p => {
      const partido = partidos.find(x => x.id === p.partido_id);
      if (!partido) return;
      mensaje += `⚽ ${partido.local} ${p.local}-${p.visitante} ${partido.visitante}\n`;
    });

    const phone = "524531021052"; // tu número
    const texto = encodeURIComponent(mensaje);
    const url = `https://wa.me/${phone}?text=${texto}`;

    // 🔥 REDIRECCIÓN SEGURA
    window.location.href = url;

     // 🎉 CONFIRMACIÓN
    confetti();
    alert("🔥 Quiniela enviada");

  } catch (err) {
    console.error(err);
    alert("❌ Error de conexión");
  } finally {
    if (btn) btn.disabled = false;
  }
}
async function cargarCampeon() {

  const res = await fetch(`/campeon?jornada=${jornadaActual}`);
  const data = await res.json();

  let cont = document.getElementById("campeon");

  if (!cont) return;

  if (!data || data.length === 0) {
    cont.innerHTML = "";
    return;
  }

  // 🔥 nombres de campeones
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

async function validarUsuario() {
  const nombre = document.getElementById("usuario").value;
  if (!nombre) return;

  const res = await fetch(`/check-user?nombre=${nombre}&jornada=${jornadaActual}`);
  const data = await res.json();

  const estado = document.getElementById("estadoQuiniela");

  if (data.existe) {
    estado.innerText = "⚠️ Ya participaste, puedes enviar otra diferente";
    estado.className = "estado warning";
  }
}


// 🏆 TABLA (YA CORRECTA)
async function verTabla() {
  const res = await fetch(`/tabla?jornada=${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById("tabla");
  cont.innerHTML = "<h2>🏆 Tabla</h2>";

  if (data.length === 0) {
    cont.innerHTML += "<p>No hay datos aún</p>";
    return;
  }

  data.forEach((u, i) => {

    let medal = ["🥇","🥈","🥉"][i] || "";

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
      <div class="tabla-item ${i === 0 ? 'gold' : ''}">
        ${medal} ${u.nombre} - ${u.puntos} pts
        <div>${detallesHTML}</div>
      </div>
    `;
  });
}

// 🔥 TOP 4
async function verTablaCompleta(jornada) {

  const res = await fetch(`/tabla?jornada=${jornada}`);
  const data = await res.json();

  const cont = document.getElementById("tabla");
  cont.innerHTML = "";

  if (!data.length) {
    cont.innerHTML = "<p>No hay datos</p>";
    return;
  }

  // 🔥 encabezado partidos
  let header = `
    <div class="fila header">
      <div class="celda jugador">Jugador</div>
  `;

  // tomar partidos del primer usuario
  data[0].picks.forEach((_, i) => {
    header += `<div class="celda">P${i+1}</div>`;
  });

  header += `<div class="celda puntos">Pts</div></div>`;

  cont.innerHTML += header;

  // 🔥 numerador nombres
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

    u.picks.forEach((p, i) => {

      let color = {
        verde: "verde",
        amarillo: "amarillo",
        rojo: "rojo",
        gris: "gris"
      }[u.detalles[i]];

      fila += `<div class="celda ${color}">${p}</div>`;
    });

    fila += `<div class="celda puntos">${u.puntos}</div>`;
    fila += `</div>`;

    cont.innerHTML += fila;
  });
} 

function irTabla() {
  const jornada = document.getElementById("jornadaSelect").value;
  window.location.href = `tabla.html?jornada=${jornada}`;
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