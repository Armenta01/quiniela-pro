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
`Tarjeta:
4169 1606 0973 8225

CLABE:
137593105314456900`;

    copiarTexto(datos, btn);

}

// Mercado Pago
function copiarMercadoPago(btn){

    const datos =
`CLABE:
TU_CLABE_AQUI`;

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