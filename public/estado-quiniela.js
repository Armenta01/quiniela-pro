const jornadaSelect = document.getElementById("jornadaSelect");
const tabla = document.getElementById("tablaQuinielas");

// ===============================
// CARGAR JORNADAS
// ===============================

async function cargarJornadas() {

    try {

        const resp = await fetch("/admin/jornadas");
        const data = await resp.json();

        jornadaSelect.innerHTML = "";

        data.jornadas.forEach(jornada => {

            const option = document.createElement("option");

            option.value = jornada;
            option.textContent = "Jornada " + jornada;

            jornadaSelect.appendChild(option);

        });

        // Seleccionar automáticamente la jornada más reciente
        if (data.jornadas.length > 0) {

            jornadaSelect.value = data.jornadas[0];

            cargarQuinielas(data.jornadas[0]);

        }

    } catch (error) {

        console.error(error);

    }

}

// ===============================
// CARGAR QUINIELAS
// ===============================

async function cargarQuinielas(jornada){

    try{

        const resp = await fetch(`/admin/estado-quinielas?jornada=${jornada}`);

        const data = await resp.json();

        console.log(data);

        tabla.innerHTML="";

        // Aquí en el siguiente paso llenaremos la tabla

    }catch(error){

        console.error(error);

    }

}

// ===============================

jornadaSelect.addEventListener("change",()=>{

    cargarQuinielas(jornadaSelect.value);

});

cargarJornadas();