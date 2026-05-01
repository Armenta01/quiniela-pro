let jornadaActual = 1;
let quinielaCerrada = false;

// 🔥 INIT
window.onload = async () => {
  await cargarJornadas();
  cambiarJornada();
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
  jornadaActual = document.getElementById("jornadaSelect").value;
  cargarPartidos();
  verTabla();
  checkBloqueo();
}

// 🔥 PARTIDOS UI PRO
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
            <img src="${p.logo_local}">
            <span>${p.local}</span>
          </div>

          <div class="score">
            <input type="number" id="l${p.id}">
            <span>-</span>
            <input type="number" id="v${p.id}">
          </div>

          <div class="team right">
            <span>${p.visitante}</span>
            <img src="${p.logo_visitante}">
          </div>

        </div>

        <div class="meta">
          ⏰ ${new Date(p.fecha).toLocaleString()}
        </div>

        <div class="liga">
          🏆 ${p.jornada_partido || ""}
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
        local: gl,
        visitante: gv
      });
    }
  });

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

  confetti();
  alert("🔥 Quiniela enviada");

const url = `https://wa.me/524531021052?text=Quiniela enviada`;
window.location.href = url;
}

// 🔥 TABLA PRO
async function verTabla() {
  const res = await fetch(`/tabla?jornada=${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById("tabla");
  cont.innerHTML = "<h2>🏆 Tabla</h2>";
if (data.length === 0) {
  cont.innerHTML += "<p>No hay datos aún</p>";
  return;
}
  data.forEach((u,i)=>{
    let medal = ["🥇","🥈","🥉"][i] || "";

    cont.innerHTML += `
      <div class="tabla-item ${i===0?'gold':''}">
        ${medal} ${u.nombre} - ${u.puntos} pts
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

    document.querySelectorAll("input").forEach(i=>i.disabled=true);
    document.getElementById("btnGuardar").disabled = true;
  } else {
    quinielaCerrada = false;
    estado.innerText = "🟢 Quiniela abierta";
    estado.className = "estado open";
  }
}