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

cargarJornadas();