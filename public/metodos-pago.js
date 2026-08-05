function copiarTexto(texto, boton) {

    navigator.clipboard.writeText(texto);

    const textoOriginal = boton.innerHTML;

    boton.innerHTML = "✅ Copiado";

    boton.disabled = true;

    setTimeout(() => {

        boton.innerHTML = textoOriginal;

        boton.disabled = false;

    }, 2000);

}
// BanCoppel
function copiarBanCoppel(btn){

    const datos =
`137593105314456900`;

    copiarTexto(datos, btn);

}

// Mercado Pago
function copiarMercadoPago(btn){

    const datos =
`722969010004811581`;

    copiarTexto(datos, btn);

}

// Enviar comprobante
document
.getElementById("btnEnviarComprobante")
.addEventListener("click", () => {

    window.open(
        "https://wa.me/524531336012",
        "_blank"
    );

});