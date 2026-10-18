// Contador de aperturas: lista cerrada, modos y tope por hora. Se cuentan aperturas, no personas.
// La lista es la misma que en la migración 20261018210000_gasol_visitas.sql (lo comprueba
// scripts/test_textos.py). Decisión 113 en docs/DECISIONES.md.

export const PAGINAS = [
  "portada", "inicio", "comparador", "ruta", "calculadoras", "favoritas",
  "gastos", "ingresos", "vencimientos", "cuenta", "privacidad", "aviso-legal", "instalar",
] as const;
export const MODOS = ["navegador", "instalada"] as const;

/**
 * Aperturas por hora entre todos. No impide inflar el contador, solo lo limita: como mucho 7.200
 * aperturas falsas al día. Con el tope lleno, el resto de la hora no se cuenta. Dato orientativo.
 */
export const LIMITE_VISITAS_HORA = 300;

export type Pagina = typeof PAGINAS[number];
export type Modo = typeof MODOS[number];

/** Lee {pagina, modo} del cuerpo (texto JSON de sendBeacon). null si no es válido. */
export function leerVisita(texto: string): { pagina: Pagina; modo: Modo } | null {
  let d: unknown;
  try { d = JSON.parse(texto); } catch { return null; }
  const { pagina, modo } = (d ?? {}) as Record<string, unknown>;
  if (!PAGINAS.includes(pagina as Pagina) || !MODOS.includes(modo as Modo)) return null;
  return { pagina: pagina as Pagina, modo: modo as Modo };
}

type Rpc = (nombre: string, args: Record<string, unknown>) => Promise<unknown>;

/** Cuenta la apertura. Solo se envían página, modo y el tope: nada que identifique a nadie. */
export async function contarVisita(rpc: Rpc, v: { pagina: Pagina; modo: Modo }) {
  return await rpc("gasol_contar_visita", { p_pagina: v.pagina, p_modo: v.modo, p_limite_hora: LIMITE_VISITAS_HORA });
}
