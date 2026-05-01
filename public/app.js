let jornadaActual = 1;
let quinielaCerrada = false;

// 🔥 INIT
window.onload = async () => {
  await cargarJornadas();
  cambiarJornada();
};

document.addEventListener("DOMContentLoaded", ()=> {
  const btn = document.getElementById("btnTabla");
  if (btn){
    btn.addEventListener("click", verTabla);
  }
});

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

// 🔥 PARTIDOS
async function cargarPartidos() {
  try {
    const res = await fetch(`/partidos?jornada=${jornadaActual}`);
    const data = await res.json();

    const cont = document.getElementById("partidos");
    cont.innerHTML = "";

    if (!data || data.length === 0) {
      cont.innerHTML = "<p>No hay partidos</p>";
      return;
    }

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

          <div class="liga">
            🏆 ${p.jornada_partido || ""}
          </div>
        </div>
      `;
    });

  } catch (err) {
    console.error("Error partidos:", err);
    document.getElementById("partidos").innerHTML = "❌ Error cargando partidos";
  }
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

  confetti();
  alert("🔥 Quiniela enviada");

  let mensaje = `📊 Quiniela Semana ${jornadaActual}%0A`;
  mensaje += `👤 ${usuario}%0A%0A`;

  lista.forEach(p => {
    const partido = partidos.find(x => x.id === p.partido_id);
    mensaje += `⚽ ${partido.local} ${p.local}-${p.visitante} ${partido.visitante}%0A`;
  });

  const url = `https://wa.me/524531021052?text=${mensaje}`;
  window.location.href = url;
}

// 🔥 TABLA
window.verTabla = async function () {
  const cont = document.getElementById("tabla");

  try {
    const res = await fetch(`/tabla?jornada=${jornadaActual}`);

    if (!res.ok) throw new Error("Error backend");

    const data = await res.json();

    cont.innerHTML = "<h2>🏆 Tabla</h2>";

    if (!data || data.length === 0) {
      cont.innerHTML += "<p>No hay datos aún</p>";
      return;
    }

    data.slice(0,4).forEach((u, i) => {
      let medal = ["🥇", "🥈", "🥉"][i] || "";

      cont.innerHTML += `
        <div class="tabla-item ${i === 0 ? 'gold' : ''}">
          ${medal} ${u.nombre} - ${u.puntos} pts
        </div>
      `;
    });

  } catch (err) {
    console.error("Error tabla:", err);
    cont.innerHTML = "<p style='color:red'>Error cargando tabla</p>";
  }
};

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