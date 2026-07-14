let jugadorSeleccionado = null;

if(sessionStorage.getItem("admin") !== "true"){

    location.href="login.html";

}

async function cargarJornadas(){

    const select = document.getElementById("jornadaEditar");

    select.innerHTML = "";

    for(let i = 1; i <= 60; i++){

        select.innerHTML += `
            <option value="${i}">
                Semana ${i}
            </option>
        `;

    }

    try{

        const r = await fetch("/jornada-actual");
        const data = await r.json();

        select.value = data.jornada;

    }catch(err){

        select.value = 1;

    }

}


let jugadores = [];

async function cargarJugadores(){

    const jornada =
        document.getElementById("jornadaEditar").value;

   const r =
await fetch(`/admin/jugadores?jornada=${jornada}`);

jugadores = await r.json();

    jugadores =
        await r.json();

    mostrarJugadores(jugadores);

}

function mostrarJugadores(lista){

    const contenedor =
        document.getElementById("listaJugadores");

    contenedor.innerHTML = "";

    lista.forEach(j=>{

        contenedor.innerHTML += `

<div class="jugador-card"
onclick="seleccionarJugador(${j.id},'${j.nombre}')">

👤 ${j.nombre}

</div>

`;

    });

}

async function seleccionarJugador(id,nombre){

    jugadorSeleccionado=id;

    document.getElementById("tituloJugador").innerHTML=
        "👤 "+nombre;

    await cargarPronosticos();

}
async function cargarPronosticos(){

    if(!jugadorSeleccionado)return;

    const jornada =
        document.getElementById("jornadaEditar").value;

    const r =
await fetch(`/admin/pronosticos?user_id=${jugadorSeleccionado}&jornada=${jornada}`);

    const partidos =
        await r.json();

    const lista =
        document.getElementById("listaPronosticos");

    lista.innerHTML="";

    partidos.forEach(p=>{

        lista.innerHTML += `

<div class="card">

<h3>${p.local} vs ${p.visitante}</h3>

<input
type="number"
class="gl"
data-id="${p.partido_id}"
value="${p.goles_local}">

<input
type="number"
class="gv"
data-id="${p.partido_id}"
value="${p.goles_visitante}">

</div>

`;

    });

}