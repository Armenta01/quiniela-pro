let jornadaActual = 1;
let quinielaCerrada = false;
let enviandoQuiniela = false;

async function obtenerJornadaActual() {
  const res = await fetch('/jornada-actual');
  const data = await res.json();

  jornadaActual = data.jornada;

  document.getElementById("jornadaSelect").value = jornadaActual;

}

// 🔥 INIT
window.onload = async () => {

  await cargarJornadas();

  await obtenerJornadaActual();

  await cambiarJornada();

  cargarTop4();

  cargarBolsa(jornadaActual);

  setInterval(actualizarContador, 1000);

  setTimeout(mostrarRankingPopup, 1000);

  // 🔥 Ocultar Splash
  setTimeout(() => {

    const splash = document.getElementById("splash");
    const contenido = document.getElementById("contenido");

    // Ocultar Splash
    if (splash) {
        splash.classList.add("ocultar");
    }

    // Mostrar contenido con efecto
  setTimeout(() => {
    if (contenido) {
        contenido.classList.add("visible");
    }

    }, 300);

}, 1800);

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


 // 🔥 CAMBIO DE JORNADA
async function cambiarJornada() {

  jornadaActual = document.getElementById("jornadaSelect").value || 1;

  quinielasAgregadas = [];
  editandoQuiniela = null;

  document.getElementById("btnAgregarQuiniela").textContent =
    "➕ Agregar quiniela";

  await mostrarMisQuinielas();

  // Primero cargar todos los partidos
  await cargarPartidos();

  // Después comprobar si la jornada está abierta o cerrada
  await checkBloqueo();

  // Actualizar información de la jornada
  cargarTop4();

  cargarBolsa(jornadaActual);

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
// ==========================================
// 🎨 COLORES DINÁMICOS POR EQUIPO
// ==========================================

function obtenerColorEquipo(nombre) {

  const colores = {

    "PUEBLA": "#5B9BE6",
    "ATLANTE": "#D32F2F",
    "TIJUANA": "#E53935",
    "QUERÉTARO": "#60A5FA",
    "ATL SAN LUIS": "#e9ebee",
    "ATLÉTICO DE SAN LUIS": "#e9ebee",
    "PACHUCA": "#e9ebee",
  

    "TOLUCA": "#D62828",
    "ATLAS": "#E53935",

    "MONTERREY": "#38BDF8",
    "TIGRES": "#F5B700",

    "CRUZ AZUL": "#2F80ED",
    "AMÉRICA": "#D4A017",
    "AMERICA": "#D4A017",

    "SANTOS LAGUNA": "#7CB342",
    "SANTOS": "#7CB342",
    "JUÁREZ": "#4CAF50",

    "CHIVAS": "#E53935",
    "PUMAS UNAM": "#D4A017",
    "PUMAS": "#D4A017",

    "NECAXA": "#E53935",
    "LEON": "#8BC34A",
    "LEÓN": "#8BC34A",




    "BÉLGICA": "#a78c04",
    "TURQUÍA": "#D62828",

    "FRANCIA": "#022f72",
    "ITALIA": "#246f94",

    "COLOMBIA": "#f6f202",
    "PARAGUAY": "#ea0808",


    "CROACIA": "#ea0808",
    "INGLATERRA": "#1a5c9f",

    "CANADÁ": "#9f1919",
    "PERÚ": "#ea0808",

    "ESPAÑA": "#ea0808",
    "REP. CHEQUIA": "#9f1919",

    "ESTADOS UNIDOS": "#ffffff",
    "MÉXICO": "#084b15",

     "PORTUGAL": "#b80d0d",
    "NORUEGA": "#9e9236",

    "GRECIA": "#16689f",
    "ALEMANIA": "#9e9236"


  };

  return colores[
    (nombre || "").toUpperCase()
  ] || "#2F80ED";
}


// 🔥 PARTIDOS
async function cargarPartidos() {
  const res = await fetch(`/partidos?jornada=${jornadaActual}`);
  const data = await res.json();

  const cont = document.getElementById("partidos");
  cont.innerHTML = "";

  data.forEach((p, index) => {

    const estado = getEstadoPartido(p.fecha);
    const colorLocal = obtenerColorEquipo(p.local);
const colorVisitante = obtenerColorEquipo(p.visitante);

const fechaTexto = p.fecha;

const [fechaParte, horaParte] = fechaTexto.split(' ');

const [anio, mes, dia] = fechaParte.split('-');

const meses = [
  'ene','feb','mar','abr','may','jun',
  'jul','ago','sep','oct','nov','dic'
];

const fechaFormateada =
  `${dia}-${meses[parseInt(mes)-1]}`;

const horaFormateada = horaParte;

cont.innerHTML += `
    <div
      class="card partido-card"
      style="
        --color-local:${colorLocal};
        --color-visitante:${colorVisitante};
      "
    >

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

          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="2"
            id="l${p.id}">

          <span>-</span>

          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="2"
            id="v${p.id}">

        </div>

        <div class="team right">

          <img src="${p.logo_visitante || ''}">

          <div class="nombre-abajo">
            ${p.visitante}
          </div>

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
  cont.style.setProperty("--partidos", totalPartidos);
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
async function guardarIndividual() {

  if (enviandoQuiniela) {

    mostrarToast(
        "Tu quiniela ya se está enviando...",
        "⏳"
    );

    return;
}


const btn = document.getElementById("btnGuardar");


 if (quinielaCerrada) {

    mostrarMensaje(
        "Quiniela cerrada",
        "La quiniela de esta jornada ya no acepta pronósticos.",
        "🔒"
    );

    return;

}


  let usuario = document.getElementById("usuario").value.trim();
  let telefono = document.getElementById("telefono").value.trim();

if (!/^\d{10}$/.test(telefono)) {

    mostrarMensaje(
        "WhatsApp inválido",
        "Ingresa un número de WhatsApp válido de 10 dígitos.",
        "📱"
    );

    return;

}


// limpiar caracteres raros
usuario = usuario.replace(/[^a-zA-Z0-9\s]/g, "");

if (usuario.length < 3) {

    mostrarMensaje(
        "Nombre inválido",
        "El nombre debe tener al menos 3 caracteres.",
        "👤"
    );

    return;

}

  if (!usuario) {

    mostrarMensaje(
        "Nombre requerido",
        "Por favor escribe tu nombre para continuar.",
        "👤"
    );

    return;

}

  localStorage.setItem("miNombre", usuario);


  try {
    const partidos = await (await fetch(`/partidos?jornada=${jornadaActual}`)).json();

    const lista = [];

    for (const p of partidos) {

  const gl = document.getElementById("l" + p.id).value;
  const gv = document.getElementById("v" + p.id).value;

  if (gl === "" || gv === "") {

    mostrarMensaje(
        "Marcador incompleto",
        `Falta capturar el marcador de:<br><br><strong>${p.local} vs ${p.visitante}</strong>`,
        "⚠️"
    );

    return;

}

  const local = parseInt(gl);
  const visitante = parseInt(gv);

  if (isNaN(local) || isNaN(visitante)) {

    mostrarMensaje(
        "Marcador inválido",
        "Debes ingresar únicamente números.",
        "⚠️"
    );

    return;

}

  if (local < 0 || visitante < 0) {

    mostrarMensaje(
        "Marcador inválido",
        "No se permiten goles negativos.",
        "🚫"
    );

    return;

}

 if (local > 20 || visitante > 20) {

    mostrarMensaje(
        "Marcador fuera de rango",
        "El marcador máximo permitido es de 20 goles.",
        "📈"
    );

    return;

}

  lista.push({
    partido_id: p.id,
    local,
    visitante
  });
}

   if (lista.length === 0) {

    mostrarMensaje(
        "Sin pronósticos",
        "Debes capturar al menos un marcador antes de guardar.",
        "📝"
    );

    return;

}

enviandoQuiniela = true;

if (btn) {
    btn.disabled = true;
    btn.textContent = "📲 Abriendo WhatsApp...";
}

    const res = await fetch('/guardar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      nombre: usuario,
      telefono,
      jornada: jornadaActual,
      pronosticos: lista
      })
    });

    const data = await res.json();

    if (!res.ok) {

    enviandoQuiniela = false;

if (btn) {
    btn.disabled = false;
    btn.textContent = "Guardar Quiniela";
}

    mostrarMensaje(
        "No fue posible guardar",
        data.error || "Ocurrió un error al guardar la quiniela.",
        "❌"
    );

    return;

}

const ahora = new Date();

const fechaHora =
    ahora.toLocaleDateString("es-MX") +
    " " +
    ahora.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
    });

let mensaje = "";

mensaje += "🏆 *Quinielas El Inge*\n\n";
mensaje += `👤 Jugador: *${usuario}*\n`;
mensaje += `📅 Semana: *${jornadaActual}*\n`;
mensaje += `🕒 Registro: *${fechaHora}*\n`;
mensaje += "🎟️ Total: *1 quiniela*\n";
mensaje += "💰 Importe: *$50 MXN*\n\n";
mensaje += "━━━ *PRONÓSTICOS* ━━━\n\n";

lista.forEach(p => {

    const partido = partidos.find(x => x.id === p.partido_id);

    if (!partido) return;

    mensaje += `⚽ ${partido.local} *[${p.local}]-[${p.visitante}]* ${partido.visitante}\n`;

});

mensaje += "\n━━━━━━━━━━━━\n";
mensaje += "🍀 *¡Mucha suerte!*\n\n";


   const phone = "524531336012";
const texto = encodeURIComponent(mensaje);
const url = `https://wa.me/${phone}?text=${texto}`;

mostrarToast("¡Quiniela enviada correctamente!", "✅");

if (typeof confetti === "function") {

    confetti({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.6 }
    });

}

  if (/Android|iPhone/i.test(navigator.userAgent)) {
    window.location.href = url;   // 📱 móvil
  } else {
    window.open(url, "_blank");   // 💻 computadora
  }

// Esperar solo para volver a habilitar el botón
setTimeout(() => {
  // Limpiar formulario
  document.getElementById("usuario").value = "";
  document.getElementById("telefono").value = "";

  document.querySelectorAll('input[id^="l"]').forEach(i => {
  i.value = "";
  });

  document.querySelectorAll('input[id^="v"]').forEach(i => {
  i.value = "";
  });

  enviandoQuiniela = false;

if (btn) {
    btn.disabled = false;
    btn.textContent = "Guardar Quiniela";
}

}, 3000);

  } 
  catch(err){

    enviandoQuiniela = false;

if (btn) {
    btn.disabled = false;
    btn.textContent = "Guardar Quiniela";
}

    console.error(err);

    mostrarMensaje(
        "Error",
        err.message,
        "❌"
    );

}

finally{

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
// 🔥 TOP 4 PREMIUM
async function cargarTop4() {

    const res = await fetch(`/top4?jornada=${jornadaActual}`);
    const data = await res.json();

    const cont = document.getElementById("top4");

    if (!cont) return;

    cont.innerHTML = `
        <h3>🏆 TOP 4</h3>
    `;

    data.forEach((u, i) => {

        const posicion = i + 1;

        const clases = [
            "top1",
            "top2",
            "top3",
            "top4"
        ];

        const clasePosicion = clases[i] || "top4";

        const medallas = [
            "🥇",
            "🥈",
            "🥉",
            "🏅"
        ];

        const medal = medallas[i] || "🏅";

        let detallesHTML = "";

        if (Array.isArray(u.detalles)) {

            detallesHTML = u.detalles.map(d => {

                return `
                    <span
                        class="top4-dot ${d}"
                        title="${d}">
                    </span>
                `;

            }).join("");

        }

        cont.innerHTML += `

            <div class="top4-card ${clasePosicion}">

                <div class="top4-posicion">
                    ${medal}
                </div>

                <div class="top4-info">

                    <div class="top4-nombre">
                        ${u.nombre}
                    </div>

                    <div class="top4-puntos">
                        ${u.puntos} pts
                    </div>

                </div>

                <div class="top4-detalles">
                    ${detallesHTML}
                </div>

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

    document.querySelectorAll(".score input").forEach(i => {
      i.disabled = true;
    });

    document.getElementById("btnGuardar").disabled = true;

  } else {

    quinielaCerrada = false;

    estado.innerText = "🟢 Quiniela abierta";
    estado.className = "estado open";

    document.querySelectorAll(".score input").forEach(i => {
      i.disabled = false;
    });

    document.getElementById("btnGuardar").disabled = false;

  }

  // 🔥 BLOQUEO DE QUINIELAS MÚLTIPLES

  const btnAgregar = document.getElementById("btnAgregarQuiniela");
  const btnMultiples = document.getElementById("btnGuardarMultiples");

  if (btnAgregar) {
    btnAgregar.disabled = quinielaCerrada;
  }

  if (btnMultiples) {
    btnMultiples.disabled = quinielaCerrada;
  }

}

const social = document.getElementById("socialFloat");

if (social) {

  window.addEventListener("scroll", function() {

    const posicion =
      window.pageYOffset ||
      document.documentElement.scrollTop;

    if (posicion > 500) {
      social.style.display = "none";
    } else {
      social.style.display = "flex";
    }

  });

}

async function limpiarPronosticos() {

    const ok = await mostrarConfirmacion(
        "Borrar pronósticos",
        "¿Deseas borrar todos tus pronósticos?"
    );

    if (!ok) return;

    document.querySelectorAll('input[id^="l"]').forEach(i => {
        i.value = "";
    });

    document.querySelectorAll('input[id^="v"]').forEach(i => {
        i.value = "";
    });
    

    mostrarToast("Pronósticos eliminados correctamente", "🗑️");

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

        const r = await fetch(`/limite?jornada=${jornadaActual}`);

        if (!r.ok) {
            throw new Error("Error obteniendo límite");
        }

        const d = await r.json();

       
      // Jornada cerrada
      if (d.bloqueada) {
      info.style.display = "none";

      if (!quinielaCerrada) {
        await checkBloqueo();
      }

      return;
      }


        info.style.display = "block";

        const limite = new Date(d.limite);
        const ahora = new Date();

        const diff = limite - ahora;

        const dias = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));

        const horas = Math.max(0, Math.floor(
            (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        ));

        const minutos = Math.max(0, Math.floor(
            (diff % (1000 * 60 * 60)) / (1000 * 60)
        ));

        const segundos = Math.max(0, Math.floor(
            (diff % (1000 * 60)) / 1000
        ));

        // Actualizar SOLO los números
        document.getElementById("dias").textContent =
            dias.toString().padStart(2, "0");

        document.getElementById("horas").textContent =
            horas.toString().padStart(2, "0");

        document.getElementById("minutos").textContent =
            minutos.toString().padStart(2, "0");

        document.getElementById("segundos").textContent =
            segundos.toString().padStart(2, "0");

    } catch (err) {

        console.error(err);

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

  const r = await fetch(`/limite?jornada=${jornada}`);
  const limite = await r.json();

  const jornadaCerrada = limite.bloqueada;

  // ===========================
  // SI YA TERMINÓ LA JORNADA
  // ===========================
  if (bolsa.jornadaTerminada && bolsa.campeones.length > 0) {
    const nombres = bolsa.campeones
  .map(c => `<div class="nombre-campeon">👑 ${c.nombre}</div>`)
  .join("<br>");

const titulo =
    bolsa.campeones.length === 1
        ? `🏆 CAMPEÓN SEMANA ${jornada}`
        : `🏆 CAMPEONES SEMANA ${jornada}`;

let premios = "";

if (bolsa.segundoLugar === 0) {

    premios = `
        💰 <strong>Premio ganado</strong>

        <br>

        <span class="premio-campeon">
            $${Math.round(bolsa.primerLugar)} MXN
        </span>
    `;

} else {

    premios = `
        🥇 1er Lugar:
        <strong>$${Math.round(bolsa.primerLugar)} MXN</strong>

        <br>

        🥈 2do Lugar:
        <strong>$${Math.round(bolsa.segundoLugar)} MXN</strong>
    `;

}

const mensaje =
    bolsa.campeones.length === 1
        ? "🎉 ¡Muchas felicidades al campeón!"
        : "🎉 ¡Muchas felicidades a los campeones!";

document.getElementById("bolsaInfo").innerHTML = `
<div class="bolsa-box">

    <div class="bolsa-titulo">
        ${titulo}
    </div>

    <div class="premios">

        ${premios}


        ${mensaje}

        <br>

        ${nombres}

    </div>

</div>
`;

  }

  // ===========================
  // JORNADA ABIERTA
  // ===========================
  else {

    let contenido = "";

// 🔒 Jornada cerrada (partidos en curso)
if (jornadaCerrada) {

  contenido = `
      <div class="mensaje-juego">

     <strong>¡MUCHA SUERTE A TODOS LOS PARTICIPANTES!</strong>

    <br>

    🏆 Los resultados y la tabla de posiciones
    se actualizarán conforme finalicen los partidos.

</div>
  `;

}

// 🟢 Jornada abierta
else if (bolsa.bolsaPremios < 2500) {

      contenido = `
       <br>
        🔥 <span class="bolsa-creciendo">
      <strong>¡Bolsa acumulada en crecimiento!</strong>
          </span>
          <br><br>

          👑 <strong>¡El próximo campeón puede ser tú!</strong>
          <br>
          🏆 No dejes pasar la oportunidad de competir y ganar.
         
      `;

    } else if (bolsa.segundoLugar === 0) {

      contenido = `
        🥇 1er Lugar:
        <strong>$${Math.round(bolsa.primerLugar)} MXN</strong>

        <br><br>

        👤 Premio único
        <br>
        (Hasta 750 participantes)
      `;

    } else {

      contenido = `
        🥇 1er Lugar:
        <strong>$${Math.round(bolsa.primerLugar)} MXN</strong>

        <br><br>

        🥈 2do Lugar:
        <strong>$${Math.round(bolsa.segundoLugar)} MXN</strong>
      `;

    }

    document.getElementById("bolsaInfo").innerHTML = `
      <div class="bolsa-box">

        <div class="bolsa-titulo">
          ${jornadaCerrada ? `⚽ SEMANA ${jornada} EN JUEGO` : `🏆 PREMIOS SEMANA ${jornada}`}
        </div>

        <div class="premios">
          ${contenido}
        </div>

      </div>
    `;

  }

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

/* =========================================================
   BUSCADOR DE PARTICIPANTES
   FUNCIONA EN PC Y CELULAR
   ========================================================= */

document.addEventListener("input", function (e) {

  if (e.target.id !== "buscarJugador") return;

  const texto = e.target.value
    .trim()
    .toLowerCase();

  const filas = document.querySelectorAll(
    "#tabla .fila:not(.header)"
  );

  filas.forEach(fila => {

    const jugador = fila.querySelector(".jugador");

    if (!jugador) return;

    const nombre = jugador.textContent
      .trim()
      .toLowerCase();

    if (texto === "" || nombre.includes(texto)) {

      fila.classList.remove("fila-oculta");

    } else {

      fila.classList.add("fila-oculta");

    }

  });

});

function verMiPosicion() {

  const nombreGuardado =
    localStorage.getItem("miNombre");

  if (!nombreGuardado || !nombreGuardado.trim()) {

    mostrarMensaje(
      "Nombre no encontrado",
      "En este dispositivo todavía no hay una quiniela guardada.",
      "👤"
    );

    return;
  }

  const nombre =
    nombreGuardado
      .trim()
      .toLowerCase();

  const filas =
    document.querySelectorAll(
      "#tabla .fila:not(.header)"
    );

  let encontrada = null;

  filas.forEach(function(fila) {

    const jugador =
      fila.querySelector(".jugador");

    if (!jugador) return;

    const nombreJugador =
      jugador.textContent
        .trim()
        .toLowerCase();

    if (nombreJugador === nombre) {
      encontrada = fila;
    }

  });

  if (!encontrada) {

    mostrarMensaje(
      "Participante no encontrado",
      "Tu nombre está guardado en este dispositivo, pero no aparece en esta jornada.",
      "🔎"
    );

    return;
  }

  /* =========================================
     MOSTRAR TODAS LAS FILAS
     ========================================= */

  filas.forEach(function(fila) {
    fila.classList.remove("fila-oculta");
  });


  /* =========================================
     QUITAR RESALTADO ANTERIOR
     ========================================= */

  document
    .querySelectorAll(".mi-posicion-activa")
    .forEach(function(fila) {

      fila.classList.remove(
        "mi-posicion-activa"
      );

    });


  /* =========================================
     RESALTAR MI FILA
     ========================================= */

  encontrada.classList.add(
    "mi-posicion-activa"
  );


  /* =========================================
     IR A MI POSICIÓN
     ========================================= */

  setTimeout(function() {

    encontrada.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

  }, 100);


  /* =========================================
     QUITAR RESALTADO
     ========================================= */

  setTimeout(function() {

    encontrada.classList.remove(
      "mi-posicion-activa"
    );

  }, 5000);

}


/* =========================================
   SISTEMA DE QUINIELAS MÚLTIPLES
   ========================================= */

let quinielasAgregadas = [];
let editandoQuiniela = null;
let enviandoMultiples = false;

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

async function obtenerPartidosCaptura() {
  const res = await fetch(
    `/partidos?jornada=${encodeURIComponent(jornadaActual)}`
  );

  if (!res.ok) {
    throw new Error("No se pudieron obtener los partidos.");
  }

  const partidos = await res.json();

  if (!Array.isArray(partidos) || !partidos.length) {
    throw new Error("No hay partidos para esta jornada.");
  }

  return partidos;
}

function capturarMarcadores(partidos, obligatorio = true) {
  const lista = [];
  let hayAlgo = false;

  for (const p of partidos) {
    const localInput = document.getElementById("l" + p.id);
    const visitaInput = document.getElementById("v" + p.id);

    if (!localInput || !visitaInput) {
      throw new Error("Faltan campos de partidos. Recarga la página.");
    }

    const gl = localInput.value.trim();
    const gv = visitaInput.value.trim();

    if (gl !== "" || gv !== "") hayAlgo = true;

    if (gl === "" || gv === "") {
      if (!obligatorio && gl === "" && gv === "") {
        continue;
      }

      throw new Error(
        `Falta capturar el marcador de ${p.local} vs ${p.visitante}.`
      );
    }

    if (!/^\d{1,2}$/.test(gl) || !/^\d{1,2}$/.test(gv)) {
      throw new Error("Los marcadores deben ser números enteros.");
    }

    const local = Number(gl);
    const visitante = Number(gv);

    if (local > 20 || visitante > 20) {
      throw new Error("El máximo permitido es de 20 goles.");
    }

    lista.push({
      partido_id: Number(p.id),
      local,
      visitante
    });
  }

  if (!obligatorio && !hayAlgo) return null;

  if (lista.length !== partidos.length) {
    throw new Error("Debes completar los nueve marcadores.");
  }

  return lista;
}

function firmaQuiniela(pronosticos) {
  return JSON.stringify(
    [...pronosticos]
      .sort((a, b) => a.partido_id - b.partido_id)
      .map(p => [
        Number(p.partido_id),
        Number(p.local),
        Number(p.visitante)
      ])
  );
}

function limpiarCamposPartidos() {
  document.querySelectorAll("#partidos .score input")
    .forEach(input => input.value = "");
}

function restaurarMarcadores(pronosticos) {
  limpiarCamposPartidos();

  pronosticos.forEach(p => {
    const local = document.getElementById("l" + p.partido_id);
    const visitante = document.getElementById("v" + p.partido_id);

    if (local) local.value = p.local;
    if (visitante) visitante.value = p.visitante;
  });
}

function mostrarErrorQuiniela(mensaje) {
  mostrarMensaje("Revisa tu quiniela", escaparHTML(mensaje), "⚠️");
}

async function agregarQuiniela() {
  if (quinielaCerrada || enviandoMultiples || enviandoQuiniela) return;

  try {
    const partidos = await obtenerPartidosCaptura();
    const pronosticos = capturarMarcadores(partidos);

    const firma = firmaQuiniela(pronosticos);

    const repetida = quinielasAgregadas.some(
      (q, i) => i !== editandoQuiniela &&
        firmaQuiniela(q) === firma
    );

    if (repetida) {
      throw new Error(
        "Ya agregaste una quiniela con estos mismos resultados."
      );
    }

    if (editandoQuiniela !== null) {
      quinielasAgregadas[editandoQuiniela] = pronosticos;
      editandoQuiniela = null;
      mostrarToast("Quiniela actualizada", "✅");
    } else {
      quinielasAgregadas.push(pronosticos);
      mostrarToast("Quiniela agregada", "✅");
    }

    limpiarCamposPartidos();
    await mostrarMisQuinielas(partidos);

    document.getElementById("btnAgregarQuiniela").textContent =
      "➕ Agregar quiniela";

  } catch (error) {
    mostrarErrorQuiniela(error.message);
  }
}

async function editarQuiniela(indice) {
  if (quinielaCerrada || enviandoMultiples) return;

  if (editandoQuiniela !== null && editandoQuiniela !== indice) {
    mostrarErrorQuiniela(
      "Termina de editar la quiniela actual antes de abrir otra."
    );
    return;
  }

  if (!quinielasAgregadas[indice]) return;

  restaurarMarcadores(quinielasAgregadas[indice]);
  editandoQuiniela = indice;

  document.getElementById("btnAgregarQuiniela").textContent =
    "💾 Actualizar quiniela";

  document.getElementById("partidos")
    .scrollIntoView({ behavior: "smooth", block: "start" });

  mostrarToast("Edita los marcadores y pulsa Actualizar", "✏️");
}

async function eliminarQuiniela(indice) {
  if (enviandoMultiples) return;

  const confirmado = await mostrarConfirmacion(
    "Eliminar quiniela",
    `¿Deseas eliminar la quiniela #${indice + 1}?`
  );

  if (!confirmado) return;

  quinielasAgregadas.splice(indice, 1);

  if (editandoQuiniela === indice) {
    editandoQuiniela = null;
    limpiarCamposPartidos();
  } else if (editandoQuiniela !== null && editandoQuiniela > indice) {
    editandoQuiniela--;
  }

  document.getElementById("btnAgregarQuiniela").textContent =
    editandoQuiniela === null
      ? "➕ Agregar quiniela"
      : "💾 Actualizar quiniela";

  await mostrarMisQuinielas();
  mostrarToast("Quiniela eliminada", "🗑️");
}

async function mostrarMisQuinielas(partidosRecibidos = null) {
  const seccion = document.getElementById("misQuinielas");
  const lista = document.getElementById("listaQuinielas");
  const boton = document.getElementById("btnGuardarMultiples");
  const cantidad = quinielasAgregadas.length;


seccion.hidden = cantidad === 0;
boton.hidden = cantidad === 0;

// Mostrar únicamente un botón de envío
const botonIndividual = document.getElementById("btnGuardar");

if (botonIndividual) {
  botonIndividual.hidden = cantidad > 0;
}


  document.getElementById("cantidadQuinielas").textContent =
    `${cantidad} agregada${cantidad === 1 ? "" : "s"}`;

  document.getElementById("resumenQuinielas").textContent =
    `${cantidad} quiniela${cantidad === 1 ? "" : "s"}`;

  document.getElementById("precioQuinielas").textContent =
    `$${cantidad * 50} MXN`;

  boton.textContent = `📲 Guardar y enviar ${cantidad} quiniela${cantidad === 1 ? "" : "s"}`;

  if (!cantidad) {
    lista.innerHTML = "";
    return;
  }

  const partidos = partidosRecibidos || await obtenerPartidosCaptura();
  const mapa = new Map(partidos.map(p => [Number(p.id), p]));

  lista.innerHTML = quinielasAgregadas.map((quiniela, indice) => {
    const filas = quiniela.map(pr => {
      const p = mapa.get(Number(pr.partido_id));
      if (!p) return "";

      return `
        <div class="quiniela-mini-partido">

          <div class="quiniela-mini-equipo local">
            <span class="quiniela-mini-nombre">${escaparHTML(p.local)}</span>
            <img src="${escaparHTML(p.logo_local || "")}"
                 alt="" loading="lazy">
          </div>

          <span class="quiniela-mini-marcador">
            ${pr.local} - ${pr.visitante}
          </span>

          <div class="quiniela-mini-equipo visitante">
            <img src="${escaparHTML(p.logo_visitante || "")}"
                 alt="" loading="lazy">
            <span class="quiniela-mini-nombre">${escaparHTML(p.visitante)}</span>
          </div>

        </div>
      `;
    }).join("");

    return `
      <details class="quiniela-mini" ${indice === cantidad - 1 ? "open" : ""}>
        <summary>
          <span>🎟️ Quiniela #${indice + 1}</span>
          <span class="quiniela-mini-precio">$50</span>
        </summary>

        <div class="quiniela-mini-partidos">
          ${filas}
        </div>

        <div class="quiniela-mini-acciones">
          <button type="button"
                  class="btn-editar-mini"
                  onclick="editarQuiniela(${indice})">
            ✏️ Editar
          </button>

          <button type="button"
                  class="btn-eliminar-mini"
                  onclick="eliminarQuiniela(${indice})">
            🗑️ Eliminar
          </button>
        </div>
      </details>
    `;
  }).join("");
}

/* El botón original decide qué enviar */
async function guardarTodo() {
  if (quinielasAgregadas.length > 0) {
    return guardarMultiples();
  }

  return guardarIndividual();
}

function crearMensajeMultiples(nombre, quinielas, partidos) {
  const mapa = new Map(partidos.map(p => [Number(p.id), p]));

  const fechaHora = new Date().toLocaleString("es-MX");

  let mensaje = "🏆 *Quinielas El Inge*\n\n";
  mensaje += `👤 Jugador: *${nombre}*\n`;
  mensaje += `📅 Semana: *${jornadaActual}*\n`;
  mensaje += `🕒 Registro: *${fechaHora}*\n`;
  mensaje += `🎟️ Total: *${quinielas.length} quinielas*\n`;
  mensaje += `💰 Importe: *$${quinielas.length * 50} MXN*\n\n`;

  quinielas.forEach((quiniela, indice) => {
    mensaje += `━━━ *QUINIELA #${indice + 1}* ━━━\n`;

    quiniela.forEach(pr => {
      const p = mapa.get(Number(pr.partido_id));
      if (!p) return;

      mensaje += `⚽ ${p.local} *[${pr.local}]-[${pr.visitante}]* ${p.visitante}\n`;
    });

    mensaje += "\n";
  });
  mensaje += "\n━━━━━━━━━━━━\n";
  mensaje += "🍀 *¡Mucha suerte!*\n";

  return mensaje;
}

async function guardarMultiples() {
  if (enviandoMultiples || enviandoQuiniela || quinielaCerrada) return;

  const boton = document.getElementById("btnGuardarMultiples");

  try {
    if (editandoQuiniela !== null) {
      throw new Error(
        "Primero pulsa Actualizar quiniela para guardar tus cambios."
      );
    }

    let nombre = document.getElementById("usuario").value.trim();
    const telefono = document.getElementById("telefono").value.trim();

    nombre = nombre.replace(/[^a-zA-Z0-9\s]/g, "");

    if (nombre.length < 3) {
      throw new Error("Ingresa un nombre válido.");
    }

    if (!/^\d{10}$/.test(telefono)) {
      throw new Error("Ingresa un WhatsApp válido de 10 dígitos.");
    }

    
const partidos = await obtenerPartidosCaptura();

const actual = capturarMarcadores(partidos, false);

if (actual) {
    throw new Error(
        "Tienes marcadores pendientes. Pulsa Agregar quiniela antes de enviar todas."
    );
}

const todas = quinielasAgregadas.map(q =>
    q.map(p => ({ ...p }))
);


    if (!todas.length) {
      throw new Error("No hay quinielas para enviar.");
    }

    const firmas = todas.map(firmaQuiniela);

    if (new Set(firmas).size !== firmas.length) {
      throw new Error(
        "Tienes quinielas repetidas. Modifica los resultados antes de enviar."
      );
    }

    enviandoMultiples = true;
    boton.disabled = true;
    boton.textContent = "⏳ Guardando quinielas...";

    const res = await fetch("/guardar-multiples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        telefono,
        jornada: jornadaActual,
        quinielas: todas
      })
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "No fue posible guardar.");
    }

    localStorage.setItem("miNombre", nombre);

    const mensaje = crearMensajeMultiples(nombre, todas, partidos);
    const url = "https://wa.me/524531336012?text=" +
      encodeURIComponent(mensaje);

    quinielasAgregadas = [];
    editandoQuiniela = null;
    limpiarCamposPartidos();
    await mostrarMisQuinielas(partidos);

    document.getElementById("btnAgregarQuiniela").textContent =
      "➕ Agregar quiniela";

    mostrarToast("¡Quinielas registradas! Abriendo WhatsApp", "✅");

    if (typeof confetti === "function") {
      confetti({ particleCount: 180, spread: 100 });
    }

    if (/Android|iPhone/i.test(navigator.userAgent)) {
      window.location.href = url;
    } else {
      window.open(url, "_blank");
    }

  } catch (error) {
    mostrarErrorQuiniela(error.message);
  } finally {
    enviandoMultiples = false;
    boton.disabled = quinielaCerrada;
    if (!quinielaCerrada && quinielasAgregadas.length) {
      boton.textContent = "📲 Guardar y enviar todas";
    }
  }
}
