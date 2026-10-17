// Parser del campo "Horario" del servicio oficial de carburantes.
//
// Regla: "si" solo cuando el texto cubre los 7 días, cada uno exactamente una
// vez, y todos con "24H" o con 00:00-23:59 / 00:00-24:00. Si el texto se
// entiende y algún día tiene horario parcial -> "no". Cualquier otra cosa
// (formato desconocido, días repetidos, o días sin cubrir cuando los cubiertos
// son 24 h, p. ej. "L: 24H") -> "sin_confirmar".
// El texto original se guarda siempre aparte; esto solo lo clasifica.

export type Abierta24h = "si" | "no" | "sin_confirmar";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const TRAMO = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

function diasDe(expr: string): number[] | null {
  const partes = expr.split("-");
  if (partes.length === 1) {
    const i = DIAS.indexOf(partes[0]);
    return i < 0 ? null : [i];
  }
  if (partes.length !== 2) return null;
  const a = DIAS.indexOf(partes[0]);
  const b = DIAS.indexOf(partes[1]);
  if (a < 0 || b < 0 || b < a) return null;
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}

// true = día completo, false = horario parcial válido, null = no se entiende.
function esDiaCompleto(horas: string): boolean | null {
  if (horas === "24H") return true;
  const tramos = horas.split(/\s+Y\s+/);
  for (const t of tramos) {
    const m = TRAMO.exec(t.replace(/\s+/g, ""));
    if (!m) return null;
    const [h1, m1, h2, m2] = m.slice(1).map(Number);
    if (h1 > 23 || m1 > 59 || h2 > 24 || m2 > 59 || (h2 === 24 && m2 !== 0)) {
      return null;
    }
    // Apertura = cierre (p. ej. 00:00-00:00): igual puede ser 24 h que cerrado.
    if (h1 === h2 && m1 === m2) return null;
  }
  if (tramos.length !== 1) return false;
  const t = tramos[0].replace(/\s+/g, "");
  return t === "00:00-23:59" || t === "00:00-24:00";
}

export function clasificarHorario(texto: string | null | undefined): Abierta24h {
  const limpio = (texto ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!limpio) return "sin_confirmar";

  const cubiertos = new Array<boolean | undefined>(7).fill(undefined);
  for (const seg of limpio.split(";").map((s) => s.trim()).filter(Boolean)) {
    const sep = seg.indexOf(":");
    if (sep < 0) return "sin_confirmar";
    const dias = diasDe(seg.slice(0, sep).replace(/\s+/g, ""));
    const completo = esDiaCompleto(seg.slice(sep + 1).trim());
    if (!dias || completo === null) return "sin_confirmar";
    for (const d of dias) {
      if (cubiertos[d] !== undefined) return "sin_confirmar";
      cubiertos[d] = completo;
    }
  }
  // Un día con horario parcial ya descarta las 24 h, aunque falten días.
  if (cubiertos.some((c) => c === false)) return "no";
  return cubiertos.every((c) => c === true) ? "si" : "sin_confirmar";
}
