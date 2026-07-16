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

    mostrarJugadores(jugadores);

}

function mostrarJugadores(lista){

    const contenedor =
        document.getElementById("listaJugadores");

    contenedor.innerHTML = "";

    let ultimoNombre = "";
    let numeroQuiniela = 0;

    lista.forEach(j=>{

        if(j.nombre !== ultimoNombre){

            ultimoNombre = j.nombre;
            numeroQuiniela = 1;

        }else{

            numeroQuiniela++;

        }

        contenedor.innerHTML += `

<div class="jugador-card"
onclick="seleccionarJugador(${j.id},'${j.nombre}','${j.envio_id}')">

    <div class="nombre-jugador">
        👤 ${j.nombre}
    </div>

    <div class="numero-quiniela">
        Quiniela ${numeroQuiniela}
    </div>

</div>

`;

    });

}

document
.getElementById("buscarJugador")
.addEventListener("input", function(){

    const texto = this.value.toLowerCase();

    const filtrados = jugadores.filter(j=>{

        return j.nombre
            .toLowerCase()
            .includes(texto);

    });

    mostrarJugadores(filtrados);

});

async function seleccionarJugador(id,nombre,envio_id){

    jugadorSeleccionado = {

        id: id,

        envio_id: envio_id

    };

    document.getElementById("tituloJugador").innerHTML =
        "👤 " + nombre;

    await cargarPronosticos();

}


async function cargarPronosticos(){

    if(!jugadorSeleccionado?.envio_id)return;

    const jornada =
        document.getElementById("jornadaEditar").value;

    const r =
    await fetch(`/admin/pronosticos?envio_id=${jugadorSeleccionado.envio_id}&jornada=${jornada}`);

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

async function guardarCambiosPronosticos(){

    if(!jugadorSeleccionado){
        alert("Selecciona un participante.");
        return;
    }

    const gl =
        document.querySelectorAll(".gl");

    const gv =
        document.querySelectorAll(".gv");

    const pronosticos = [];

    for(let i=0;i<gl.length;i++){

        pronosticos.push({

            partido_id:
                Number(gl[i].dataset.id),

            goles_local:
                Number(gl[i].value),

            goles_visitante:
                Number(gv[i].value)

        });

    }

    const jornada =
        document.getElementById("jornadaEditar").value;

    const r =
        await fetch("/admin/editar-pronosticos",{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({

            envio_id: jugadorSeleccionado.envio_id,

            jornada,

            pronosticos

        })

        });

    const data = await r.json();

    if(data.ok){

         alert("✅ Pronósticos actualizados correctamente.");

    }else{

        alert("❌ " + (data.error || "No fue posible guardar."));

}

}

async function verificarEstadoEdicion(){

    const jornada =
        document.getElementById("jornadaEditar").value;

    const r =
        await fetch(`/admin/estado-edicion?jornada=${jornada}`);

    const estado =
        await r.json();

    if(!estado.abierta){

        document.getElementById("btnGuardar").disabled = true;

        document.getElementById("btnGuardar").innerHTML =
            "🔒 Edición cerrada";

        document.getElementById("btnGuardar").style.opacity = ".6";

        document.getElementById("btnGuardar").style.cursor = "not-allowed";

        alert("La edición está cerrada porque el primer partido ya comenzó.");

    }

}


document
.getElementById("jornadaEditar")
.addEventListener("change", cargarJugadores);

async function iniciar(){

    await cargarJornadas();

    await verificarEstadoEdicion();

    await cargarJugadores();

}

iniciar();