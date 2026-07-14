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
onclick="seleccionarJugador(${j.id})">

👤 ${j.nombre}

</div>

`;

    });

}

document
.getElementById("jornadaEditar")
.addEventListener("change",cargarJugadores);


async function iniciar(){

    await cargarJornadas();

    await cargarJugadores();

}

iniciar();