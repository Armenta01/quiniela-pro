const jornadaSelect = document.getElementById("jornadaSelect");

for(let i=1;i<=60;i++){

    const option=document.createElement("option");

    option.value=i;
    option.textContent="Jornada "+i;

    jornadaSelect.appendChild(option);

}

jornadaSelect.value=14;