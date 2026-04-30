let usuario = "";
let jornadaActual = 1;
let timerContador = null;
let quinielaCerrada = false;

// 🔐 TOKEN ÚNICO POR USUARIO (SIN LOGIN)
function getUserToken() {
  let token = localStorage.getItem("user_token");

  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("user_token", token);
  }

  return token;
}

let ultimoCampeon = null;

async function cargarCampeon() {
  const res = await fetch(`/campeon?jornada=${jornadaActual}`);
  const data = await res.json();

  const div = document.getElementById("campeon");

  if (!div) return;

  if (data && data.nombre) {
    div.innerHTML = `🏆 Campeón: ${data.nombre} (${data.puntos} pts)`;

    // 🎉 CONFETTI SOLO SI ES NUEVO
    if (ultimoCampeon !== data.nombre) {
      lanzarConfetti();
      ultimoCampeon = data.nombre;

      alert(`🏆 Campeón de la jornada: ${data.nombre}`);
    }

  } else {
    div.innerHTML = "";
  }
}

// 🔥 ONLOAD
window.onload = async () => {
  quinielaCerrada = false;

  const input = document.getElementById('usuario');
  const select = document.getElementById('jornadaSelect');

  if (!input || !select) return;

  let aviso = document.createElement('div');
  aviso.style.color = "#f87171";
  aviso.style.fontSize = "12px";
  input.parentNode.insertBefore(aviso, input.nextSibling);

  input.addEventListener('input', (e) => {
    if (e.target.value.length > 15) {
      aviso.innerText = "⚠️ Máximo 15 caracteres";
      e.target.value = e.target.value.slice(0, 15);
    } else {
      aviso.innerText = "";
    }
    usuario = e.target.value;
  });

  await cargarJornadas();

  const guardada = localStorage.getItem("jornadaActual");
  if (guardada) {
    jornadaActual = guardada;
    select.value = guardada;
  } else {
    jornadaActual = select.value;
  }

  cargarPartidos();
  iniciarContador();
  verResultados();

  cargarCampeon(); // 🔥 AQUÍ


  setInterval(() => {
    verResultados();
  }, 5000);
};

// 🔥 CAMBIAR JORNADA
function cambiarJornada() {
  const select = document.getElementById('jornadaSelect');
  if (!select) return;

  jornadaActual = select.value;
  quinielaCerrada = false;

  localStorage.setItem("jornadaActual", jornadaActual);

  cargarPartidos();
  iniciarContador();
  verResultados();
  cargarCampeon(); // 🔥 AQUÍ

}

// 🔥 CARGAR JORNADAS
async function cargarJornadas() {
  const res = await fetch('/jornadas');
  const data = await res.json();

  const select = document.getElementById('jornadaSelect');
  select.innerHTML = '';

  data.forEach(j => {
    select.innerHTML += `<option value="${j.jornada}">Semana ${j.jornada}</option>`;
  });
}

// 🔥 CARGAR PARTIDOS
async function cargarPartidos() {
  const res = await fetch(`/partidos?jornada=${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById('partidos');
  cont.innerHTML = '';

  data.forEach(p => {
    const div = document.createElement('div');
    div.className = "card";

    div.innerHTML = `
      <div class="fila-partido">
        <div class="equipo lado-izq">
          <img src="${p.logo_local || ''}" class="logo">
          <span>${p.local}</span>
        </div>

        <div class="marcador">
          <input type="number" id="l${p.id}">
          <span>-</span>
          <input type="number" id="v${p.id}">
        </div>

        <div class="equipo lado-der">
          <span>${p.visitante}</span>
          <img src="${p.logo_visitante || ''}" class="logo">
        </div>
      </div>

      <div class="fecha-partido">
        ${new Date(p.fecha).toLocaleString('es-MX', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>

      <div class="liga-info">
  ${p.jornada_partido || ''}
</div>
    `;

    cont.appendChild(div);
  });
}

// 🔥 GUARDAR
// 🔥 GUARDAR
async function guardarTodo() {
  if (quinielaCerrada) {
    alert("⛔ La quiniela ya está cerrada");
    return;
  }

  const resLimite = await fetch(`/limite/${jornadaActual}`);
  const dataLimite = await resLimite.json();

  if (dataLimite.limite && new Date() > new Date(dataLimite.limite)) {
    alert("⛔ La quiniela ya está cerrada");
    return;
  }

  if (!usuario) {
    alert("Escribe tu nombre");
    return;
  }

  const resPartidos = await fetch(`/partidos?jornada=${jornadaActual}`);
  const partidos = await resPartidos.json();

  const lista = [];
  let mensaje = `📊 Quiniela - Semana ${jornadaActual}%0A`;
  mensaje += `👤 ${usuario}%0A%0A`;

  for (let p of partidos) {
    const gl = document.getElementById("l" + p.id).value;
    const gv = document.getElementById("v" + p.id).value;

    if (gl === "" || gv === "") continue;

    lista.push({
      partido_id: p.id,
      goles_local: gl,
      goles_visitante: gv
    });

    mensaje += `⚽ ${p.local} ${gl}-${gv} ${p.visitante}%0A`;
  }

  const res = await fetch('/predicciones', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    nombre: usuario,
    predicciones: lista,
    jornada: jornadaActual,
    user_token: getUserToken()
  })
});

const data = await res.json();

if (!res.ok) {
  alert(data.error || "Error al guardar");
  return;
}

  // 🔥 ABRIR WHATSAPP
  const numero = "524531021052"; // 👈 TU NUMERO
  window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank');
}
// 🔥 TOP 4
async function verResultados() {
  const res = await fetch(`/tabla?jornada=${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById('tabla');
  cont.innerHTML = "<h2>🏆 Top 4</h2>";

  const top = data.slice(0, 4);

  top.forEach((u, i) => {
    cont.innerHTML += `
      <div>${i + 1}. ${u.nombre} - ${u.puntos}</div>
    `;
  });
}

// 🔥 CONTADOR + BLOQUEO
async function iniciarContador() {
  quinielaCerrada = false;

  const res = await fetch(`/limite/${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById('contador');
  if (!cont || !data.limite) return;

  const limite = new Date(data.limite);

  function bloquear() {
    quinielaCerrada = true;

    document.querySelectorAll("input[type='number']").forEach(inp => {
      inp.disabled = true;
    });

    const btn = document.getElementById("btnGuardar");
    if (btn) {
      btn.disabled = true;
      btn.innerText = "🔒 Quiniela cerrada";
    }
  }

  async function cargarCampeon() {
  const res = await fetch(`/campeon?jornada=${jornadaActual}`);
  const data = await res.json();

  const div = document.getElementById("campeon");

  if (data && data.nombre) {
    div.innerHTML = `🏆 Campeón: ${data.nombre} (${data.puntos} pts)`;
  } else {
    div.innerHTML = "";
  }
}

  function actualizar() {
    const ahora = new Date();

    if (ahora > limite) {
      cont.innerHTML = "⛔ Quiniela cerrada";
      bloquear();
    } else {
      cont.innerHTML = "🟢 Quiniela abierta";

      quinielaCerrada = false;

      document.querySelectorAll("input[type='number']").forEach(inp => {
        inp.disabled = false;
      });

      const btn = document.getElementById("btnGuardar");
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Guardar Resultados";
      }
    }
  }

  actualizar();

  if (timerContador) clearInterval(timerContador);
  timerContador = setInterval(actualizar, 1000);
}


function lanzarConfetti() {
  confetti({
    particleCount: 150,
    spread: 100,
    origin: { y: 0.6 }
  });
}

// 🔥 GLOBAL
window.verTablaExcel = function () {
  window.location.href = "/tabla-excel";
};


window.cambiarJornada = cambiarJornada;