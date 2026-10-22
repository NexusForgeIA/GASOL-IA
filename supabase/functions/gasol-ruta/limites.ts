// Topes de cálculos de ruta. No son cifras de rendimiento: frenan el uso para respetar la política
// del servidor de demostración de OSRM («Do not exceed 1 request per second»; «reasonable,
// non-commercial use-cases»). Cada cálculo hace dos peticiones a OSRM (ruta y desvíos).
// Decisión 109 en docs/DECISIONES.md. El cliente tiene su propio tope por dispositivo (assets/config.js).

/** Cálculos por hora entre todos: 120 peticiones a OSRM por hora, una cada 30 s de media. */
export const LIMITE_RUTAS_HORA = 60;
/** Cálculos por día entre todos (el mismo tope global que ya tenía la demo). */
export const LIMITE_RUTAS_DIA = 500;

/** Cálculos por minuto y por cliente (IP, en memoria): que uno solo no agote el tope global de todos. */
export const LIMITE_RUTAS_MINUTO_CLIENTE = 5;

export const MENSAJES_LIMITE = {
  minuto: "Estás pidiendo rutas muy seguido. Espera un momento y vuelve a intentarlo.",
  dia: "Has llegado al límite de cálculos de hoy en esta versión beta. Vuelve mañana.",
  hora: "Hay muchos cálculos de ruta en esta hora en esta versión beta. Vuelve a intentarlo dentro de un rato.",
} as const;

export type Ventana = keyof typeof MENSAJES_LIMITE;
type Rpc = (nombre: string, args: Record<string, number>) => Promise<unknown>;

/**
 * Cuenta el cálculo en el contador global (gasol_contar_ruta) y devuelve null si se puede seguir o
 * la ventana superada ('hora' o 'dia'). Solo envía los topes: ni coordenadas ni identificadores.
 */
export async function contarRuta(rpc: Rpc): Promise<Ventana | null> {
  const r = await rpc("gasol_contar_ruta", { p_limite_hora: LIMITE_RUTAS_HORA, p_limite_dia: LIMITE_RUTAS_DIA });
  return r === "hora" || r === "dia" ? r : null;
}
