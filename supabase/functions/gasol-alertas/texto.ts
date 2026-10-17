// Texto de los avisos push: corto, sin acciones, solo hechos de la captura.

const NOMBRES: Record<string, string> = {
  gasoleo_a: "Gasóleo A", gasoleo_premium: "Gasóleo Premium", diesel_renovable: "Diésel renovable",
  adblue: "AdBlue", gasolina_95_e5: "Gasolina 95", gasolina_98_e5: "Gasolina 98", glp: "GLP",
};

const euros = (n: number) => n.toFixed(3).replace(".", ",");
const FORMATO = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
/** "18/10, 06:15" en hora peninsular, sin depender de cómo formatee la ICU en español. */
const hora = (iso: string) => {
  const p = Object.fromEntries(FORMATO.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}, ${p.hour}:${p.minute}`;
};

/** Texto del aviso. Solo hechos de la captura: cuántas bajan y la más barata. */
export function textoAviso(nombreRuta: string, combustible: string, bajan: number, minimo: number, fecha: string) {
  const titulo = `${nombreRuta}`.slice(0, 60);
  const cuerpo = `${NOMBRES[combustible] ?? combustible}: ${bajan} ${bajan === 1 ? "baja" : "bajan"} en tu ruta. ` +
    `Más barata del corredor: ${euros(minimo)} €/l (captura ${hora(fecha)}).`;
  return { titulo, cuerpo: cuerpo.slice(0, 160) };
}

