let jornadaActual = 1;
let quinielaCerrada = false;

async function obtenerJornadaActual() {
  const res = await fetch('/jornada-actual');
  const data = await res.json();

  jornadaActual = data.jornada;

  document.getElementById("jornadaSelect").value = jornadaActual;

  cargarPartidos();
}

// 🔥 INIT
window.onload = async () => {

  await cargarJornadas();

  await obtenerJornadaActual();

  cambiarJornada();

  cargarTop4();

  cargarBolsa(jornadaActual);

  actualizarContador();

  setInterval(actualizarContador, 60000);
  setTimeout(mostrarRankingPopup, 1000);

};

function irTabla() {
  const jornada = document.getElementById("jornadaSelect").value;
  window.location.href = `tabla.html?jornada=${jornada}`;
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

  cargarBolsa(jornadaActual);

  checkBloqueo();

  actualizarContador();

  setTimeout(mostrarRankingPopup, 500);

}

// 🔥 ESTADO PARTIDO
function getEstadoPartido(fechaStr) {

  const ahora = new Date();

  // convertir "2026-06-03 12:45" a fecha válida
  const partidoFecha = new Date(fechaStr.replace(" ", "T"));

  const diffMin = (ahora - partidoFecha) / 60000;

  if (diffMin > 130) {
    return {
      texto: "FINALIZADO",
      clase: "finalizado",
      icono: "🔒"
    };
  }

  if (diffMin >= 0) {
    return {
      texto: "EN VIVO",
      clase: "envivo",
      icono: "🔴"
    };
  }

  return {
    texto: "PRÓXIMO",
    clase: "futuro",
    icono: "📅"
  };
}

// 🔥 PARTIDOS
async function cargarPartidos() {
  const res = await fetch(`/partidos?jornada=${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById("partidos");
  cont.innerHTML = "";

  data.forEach(p => {

    const estado = getEstadoPartido(p.fecha);

   const fechaTexto = p.fecha;

const [fechaParte, horaParte] = fechaTexto.split(' ');

const [anio, mes, dia] = fechaParte.split('-');

const meses = [
  'ene','feb','mar','abr','may','jun',
  'jul','ago','sep','oct','nov','dic'
];

const fechaFormateada = `${dia}-${meses[parseInt(mes)-1]}`;

const horaFormateada = horaParte;

    cont.innerHTML += `
      <div class="card">

        <div class="estado ${estado.clase}">
          ${estado.icono} ${estado.texto}
        </div>

        <div class="match">

          <div class="team left">

  <img src="${p.logo_local || ''}">

  <div class="nombre-abajo">
    ${p.local}
  </div>

</div>

<div class="score">
  <input type="number" min="0" max="20" id="l${p.id}">
  <span>-</span>
  <input type="number" min="0" max="20" id="v${p.id}">
</div>

<div class="team right">

  <img src="${p.logo_visitante || ''}">

  <div class="nombre-abajo">
    ${p.visitante}

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
  const partidos = await (await fetch(`/partidos?jornada=${jornada}`)).json();

  // 🔥 No mostrar tabla hasta que exista al menos un resultado

const hayResultados = partidos.some(
  p => p.goles_local != null &&
       p.goles_visitante != null
);

if (!hayResultados) {

  cont.innerHTML = `
    <div style="
      text-align:center;
      padding:50px;
      color:white;
      font-size:22px;
      background:#1e293b;
      border-radius:15px;
      margin-top:20px;
    ">
      🏆 La batalla por el liderato aún no comienza.
         La clasificación aparecerá tras el primer resultado oficial.
    </div>
  `;

  return;
}

 let header = `<div class="fila header">
  <div class="celda posicion">Pos</div>
  <div class="celda jugador">Jugador</div>`;
  
partidos.forEach(p => {

  let marcador = (p.goles_local != null && p.goles_visitante != null)
    ? `${p.goles_local}-${p.goles_visitante}`
    : "⏳";

  header += `
  <div class="celda partido-header">

  <img src="${p.logo_local}"
       class="logo-equipo"
       onerror="this.style.visibility='hidden'">

  <div class="nombre-equipo">
    ${p.local}
  </div>

    <div class="resultado-header">
    ${marcador}
    </div>

    <div class="nombre-equipo">
    ${p.visitante}
    </div>

  <img src="${p.logo_visitante}"
       class="logo-equipo"
       onerror="this.style.visibility='hidden'">

</div>
`;
});

header += `<div class="celda puntos">Pts</div></div>`;
  
  cont.innerHTML += header;

let contador = {};

let ranking = [];

let puntosPrimero = data[0]?.puntos;
let puntosSegundo = null;
let posicionActual = 3;

data.forEach((u, index) => {

  let lugar;

  // Empates del primer lugar
  if (u.puntos === puntosPrimero) {

    lugar = 1;

  } else {

    // Detectar puntaje del segundo lugar
    if (puntosSegundo === null) {
      puntosSegundo = u.puntos;
    }

    // Empates del segundo lugar
    if (u.puntos === puntosSegundo) {

      lugar = 2;

    } else {

      // Del tercero para abajo consecutivos
      lugar = posicionActual;
      posicionActual++;
    }
  }

  ranking.push({
    ...u,
    lugar
  });

});

ranking.forEach((u) => {

  let claseTop =
  u.lugar === 1 ? "top1" :
  u.lugar === 2 ? "top2" : "";

  if (!contador[u.nombre]) contador[u.nombre] = 1;
  else contador[u.nombre]++;

  const nombreFinal = contador[u.nombre] > 1
    ? `${u.nombre} #${contador[u.nombre]}`
    : u.nombre;

  let fila = `<div class="fila ${claseTop}">`;

  fila += `
<div class="celda posicion">
  ${
   u.lugar === 1 ? "🥇" :
   u.lugar === 2 ? "🥈" :
   `${u.lugar}º`
  }
</div>

<div class="celda jugador">
  ${nombreFinal}
</div>
`;

  // 🔥 pintar picks existentes
  u.picks.forEach((p, i) => {
    const valor = p || "-";
    const color = u.detalles[i] || "gris";

    fila += `<div class="celda ${color}">
    ${valor}
    </div>`;
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

  localStorage.setItem("miNombre", usuario);

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

   const phone = "524531336012";
const texto = encodeURIComponent(mensaje);
const url = `https://wa.me/${phone}?text=${texto}`;

confetti();

setTimeout(() => {

  if (/Android|iPhone/i.test(navigator.userAgent)) {
    window.location.href = url;   // 📱 móvil
  } else {
    window.open(url, "_blank");   // 💻 computadora
  }

}, 1000);

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

  const nombres = data
    .map(u => `${u.nombre} (${u.puntos} pts)`)
    .join(" • ");

  const esLider = data[0].estado === "lider";

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
      ${
        esLider
          ? `🥇 Líder${data.length > 1 ? "es" : ""} Actual${data.length > 1 ? "es" : ""} Semana ${jornadaActual}:`
          : `🏆 Campeón${data.length > 1 ? "es" : ""} Semana ${jornadaActual}:`
      }
      <br>
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

const social = document.getElementById("socialFloat");

if (social) {

  window.addEventListener("scroll", function() {

    const posicion =
      window.pageYOffset ||
      document.documentElement.scrollTop;

    if (posicion > 150) {
      social.style.display = "none";
    } else {
      social.style.display = "flex";
    }

  });

}

function limpiarPronosticos() {

  if (!confirm("¿Deseas borrar todos tus pronósticos?")) {
    return;
  }

  document.querySelectorAll('input[id^="l"]').forEach(i => {
    i.value = "";
  });

  document.querySelectorAll('input[id^="v"]').forEach(i => {
    i.value = "";
  });

}

function generarAleatorio() {

  const marcadores = [
    [1,0],[1,0],[1,0],
    [0,1],[0,1],
    [1,1],[1,1],[1,1],
    [2,1],[2,1],
    [1,2],
    [2,0],[0,2],
    [2,2],
    [3,1],
    [1,3],
    [3,2]
  ];

  document.querySelectorAll('input[id^="l"]').forEach(inputLocal => {

    const id = inputLocal.id.replace("l","");
    const inputVisitante = document.getElementById("v" + id);

    const resultado =
      marcadores[Math.floor(Math.random() * marcadores.length)];

    inputLocal.value = resultado[0];
    inputVisitante.value = resultado[1];

  });

}

async function actualizarContador() {

  const info = document.getElementById("infoQuiniela");

  if (!info) return;

  try {

    info.style.display = "block";

    const r = await fetch(`/limite?jornada=${jornadaActual}`);

    if (!r.ok) {
      throw new Error("Error obteniendo límite");
    }

    const d = await r.json();

    // Si ya cerró, ocultar la barra
    if (d.bloqueada) {
      info.style.display = "none";
      return;
    }

    const limite = new Date(d.limite);
    const ahora = new Date();

    const diff = limite - ahora;

    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));

    const horas = Math.floor(
      (diff % (1000 * 60 * 60 * 24))
      / (1000 * 60 * 60)
    );

    const minutos = Math.floor(
      (diff % (1000 * 60 * 60))
      / (1000 * 60)
    );

    info.innerHTML = `
      <div class="costo">
        💰 Costo: $50 MXN
      </div>

      <div class="contador">
        ⏰ Cierra en: ${dias}d ${horas}h ${minutos}m
      </div>
    `;

  } catch (err) {

    info.innerHTML = `
      <div class="costo">
        💰 Costo: $50 MXN
      </div>

      <div class="contador">
        ⏰ Actualizando...
      </div>
    `;

  }

}

async function mostrarRankingPopup() {

  const key = `popupSemana${jornadaActual}`;

  if (localStorage.getItem(key)) return;

  const res = await fetch(`/top4?jornada=${jornadaActual}`);
  const data = await res.json();

  if (!data || data.length === 0) return;


  const primerPuntaje = data[0].puntos;

  const primeros = data.filter(
    u => u.puntos === primerPuntaje
  );

  const segundoPuntaje = data.find(
    u => u.puntos < primerPuntaje
  )?.puntos;

  const segundos = segundoPuntaje == null
    ? []
    : data.filter(u => u.puntos === segundoPuntaje);

  const popup = document.getElementById("popupRanking");

  popup.innerHTML = `
    <div class="popup-ranking">

      <div class="popup-card popup-oro">

        <div class="popup-titulo">
          🥇 PRIMER LUGAR
        </div>

        <div class="popup-nombre">
          ${primeros.map(x => x.nombre).join("<br>")}
        </div>

        <div class="popup-puntos">
          ${primerPuntaje} pts
        </div>

      </div>

      ${
        segundos.length > 0
        ? `
        <div class="popup-card popup-plata">

          <div class="popup-titulo">
            🥈 SEGUNDO LUGAR
          </div>

          <div class="popup-nombre">
            ${segundos.map(x => x.nombre).join("<br>")}
          </div>

          <div class="popup-puntos">
            ${segundoPuntaje} pts
          </div>

        </div>
        `
        : ""
      }

    </div>
  `;

  popup.style.display = "block";

  localStorage.setItem(key, "ok");

  setTimeout(() => {

    popup.style.opacity = "0";

    setTimeout(() => {
      popup.style.display = "none";
      popup.style.opacity = "1";
    }, 500);

  }, 5000);
}

async function cargarBolsa(jornada) {

  const res = await fetch(`/bolsa?jornada=${jornada}`);
  const bolsa = await res.json();

  document.getElementById("bolsaInfo").innerHTML = `
  <div class="bolsa-box">

    <div class="bolsa-titulo">
      🏆 PREMIOS SEMANA ${jornada}
    </div>
    <div class="premios">

  <br><br>

  🥇 1er Lugar: $${Math.round(bolsa.primerLugar)} MXN

  ${
    bolsa.segundoLugar > 0
    ? `<br>🥈 2do Lugar: $${Math.round(bolsa.segundoLugar)} MXN`
    : `<br>👥 Menos de 31 participantes: premio único`
  }

</div>

  </div>
`;
}

function toggleMenu() {

  document
    .getElementById("menuLateral")
    .classList
    .toggle("abierto");

  document
    .getElementById("overlayMenu")
    .classList
    .toggle("activo");
}

document.addEventListener("input", function(e){

  if(e.target.id !== "buscarJugador") return;

  const texto = e.target.value.toLowerCase();

  document.querySelectorAll(".fila").forEach(fila => {

    if(fila.classList.contains("header")) return;

    const jugador =
      fila.querySelector(".jugador")
      ?.innerText
      .toLowerCase() || "";

    fila.style.display =
      jugador.includes(texto)
      ? "flex"
      : "none";
  });

});

function verMiPosicion(){

  const nombre =
    localStorage.getItem("miNombre");

  if(!nombre){
    alert("No se encontró tu nombre");
    return;
  }

  const filas =
    document.querySelectorAll(".fila");

  let encontrada = null;

  filas.forEach(fila => {

    const jugador =
      fila.querySelector(".jugador");

    if(!jugador) return;

    if(
      jugador.innerText
      .toLowerCase()
      .includes(nombre.toLowerCase())
    ){
      encontrada = fila;
    }

  });

  if(!encontrada){
    alert("No apareces en esta jornada");
    return;
  }

  encontrada.scrollIntoView({
    behavior:"smooth",
    block:"center"
  });

  encontrada.style.boxShadow =
    "0 0 25px #22c55e";

  setTimeout(()=>{
    encontrada.style.boxShadow="";
  },4000);
}