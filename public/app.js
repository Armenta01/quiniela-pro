let jornadaActual = 1;
let quinielaCerrada = false;

// 🔥 INIT
window.onload = async () => {
  await cargarJornadas();
  cambiarJornada();

  const btn = document.getElementById("btnTabla");
  if (btn) btn.onclick = verTabla;
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
  verTabla();
  cargarTop4();
  checkBloqueo();
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
          ⏰ ${new Date(p.fecha).toLocaleString()}
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

  const partidos = await (await fetch(`/partidos?jornada=${jornadaActual}`)).json();

  const lista = [];

  partidos.forEach(p => {
    const gl = document.getElementById("l"+p.id).value;
    const gv = document.getElementById("v"+p.id).value;

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

  const res = await fetch('/guardar', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      nombre: usuario,
      jornada: jornadaActual,
      pronosticos: lista
    })
  });

  const data = await res.json();

  if (!res.ok) return alert(data.error);

  alert("🔥 Quiniela enviada");
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
    cont.innerHTML += `
      <div>
        ${i+1}. ${u.nombre} - ${u.puntos} pts
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