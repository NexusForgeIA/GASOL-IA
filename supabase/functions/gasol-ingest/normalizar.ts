// Normaliza el JSON del servicio oficial a filas de gasol_estaciones / gasol_precios.
import { type Abierta24h, clasificarHorario } from "./horario.ts";

export const FUENTE_URL =
  "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/";

// Si llegan menos estaciones, la respuesta se trata como incompleta y no se carga.
export const MIN_ESTACIONES = 8000;

// Campo oficial -> código interno. Un campo "Precio ..." nuevo no se pierde:
// se guarda con un código derivado de su nombre y se avisa en la captura.
export const COMBUSTIBLES: Record<string, string> = {
  "Precio Gasoleo A": "gasoleo_a",
  "Precio Gasoleo B": "gasoleo_b",
  "Precio Gasoleo Premium": "gasoleo_premium",
  "Precio Diésel Renovable": "diesel_renovable",
  "Precio Biodiesel": "biodiesel",
  "Precio Adblue": "adblue",
  "Precio Gasolina 95 E5": "gasolina_95_e5",
  "Precio Gasolina 95 E5 Premium": "gasolina_95_e5_premium",
  "Precio Gasolina 95 E10": "gasolina_95_e10",
  "Precio Gasolina 95 E25": "gasolina_95_e25",
  "Precio Gasolina 95 E85": "gasolina_95_e85",
  "Precio Gasolina 98 E5": "gasolina_98_e5",
  "Precio Gasolina 98 E10": "gasolina_98_e10",
  "Precio Gasolina Renovable": "gasolina_renovable",
  "Precio Bioetanol": "bioetanol",
  "Precio Gases licuados del petróleo": "glp",
  "Precio Gas Natural Comprimido": "gnc",
  "Precio Gas Natural Licuado": "gnl",
  "Precio Biogas Natural Comprimido": "biogas_comprimido",
  "Precio Biogas Natural Licuado": "biogas_licuado",
  "Precio Hidrogeno": "hidrogeno",
  "Precio Amoniaco": "amoniaco",
  "Precio Metanol": "metanol",
};

export interface Estacion {
  ideess: string;
  rotulo: string;
  direccion: string;
  cp: string;
  localidad: string;
  municipio: string;
  id_municipio: string;
  provincia: string;
  id_provincia: string;
  id_ccaa: string;
  lat: number;
  lon: number;
  margen: string;
  remision: string;
  tipo_venta: string;
  horario_texto: string;
  abierta_24h: Abierta24h;
}

export interface Precio {
  ideess: string;
  combustible: string;
  precio: number;
}

export interface Normalizado {
  fechaFuente: string; // ISO con zona Europe/Madrid resuelta
  estaciones: Estacion[];
  precios: Precio[];
  avisos: string[];
}

const num = (s: unknown): number | null => {
  if (typeof s !== "string" || !s.trim()) return null;
  const n = Number(s.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const txt = (s: unknown): string => (typeof s === "string" ? s.trim() : "");

const slug = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/^precio\s+/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// "17/10/2026 21:54:46" en hora peninsular -> ISO UTC.
export function fechaFuenteAIso(fecha: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(fecha.trim());
  if (!m) throw new Error(`Fecha de la fuente con formato inesperado: ${fecha}`);
  const [d, mo, y, h, mi, s] = m.slice(1).map(Number);
  // Offset de Europe/Madrid para ese instante (CET/CEST).
  const comoUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const enMadrid = new Date(
    new Date(comoUtc).toLocaleString("en-US", { timeZone: "Europe/Madrid" }),
  );
  const enUtc = new Date(new Date(comoUtc).toLocaleString("en-US", { timeZone: "UTC" }));
  const offset = enMadrid.getTime() - enUtc.getTime();
  return new Date(comoUtc - offset).toISOString();
}

export function normalizar(json: unknown, minEstaciones = MIN_ESTACIONES): Normalizado {
  const raiz = json as Record<string, unknown>;
  if (!raiz || raiz.ResultadoConsulta !== "OK") {
    throw new Error(`ResultadoConsulta distinto de OK: ${String(raiz?.ResultadoConsulta)}`);
  }
  const lista = raiz.ListaEESSPrecio;
  if (!Array.isArray(lista)) throw new Error("Falta ListaEESSPrecio");
  if (lista.length < minEstaciones) {
    throw new Error(`Respuesta incompleta: ${lista.length} estaciones (< ${minEstaciones})`);
  }

  const fechaFuente = fechaFuenteAIso(txt(raiz.Fecha));
  const estaciones: Estacion[] = [];
  const precios: Precio[] = [];
  const avisos = new Set<string>();
  const vistos = new Set<string>();

  for (const e of lista as Record<string, unknown>[]) {
    const ideess = txt(e["IDEESS"]);
    const lat = num(e["Latitud"]);
    const lon = num(e["Longitud (WGS84)"]);
    if (!ideess || vistos.has(ideess)) {
      avisos.add(`Estación sin IDEESS o duplicada descartada (${ideess || "vacío"})`);
      continue;
    }
    if (lat === null || lon === null) {
      avisos.add(`Estación ${ideess} sin coordenadas descartada`);
      continue;
    }
    vistos.add(ideess);
    const horario = txt(e["Horario"]);
    estaciones.push({
      ideess,
      rotulo: txt(e["Rótulo"]),
      direccion: txt(e["Dirección"]),
      cp: txt(e["C.P."]),
      localidad: txt(e["Localidad"]),
      municipio: txt(e["Municipio"]),
      id_municipio: txt(e["IDMunicipio"]),
      provincia: txt(e["Provincia"]),
      id_provincia: txt(e["IDProvincia"]),
      id_ccaa: txt(e["IDCCAA"]),
      lat,
      lon,
      margen: txt(e["Margen"]),
      remision: txt(e["Remisión"]),
      tipo_venta: txt(e["Tipo Venta"]),
      horario_texto: horario,
      abierta_24h: clasificarHorario(horario),
    });

    for (const [campo, valor] of Object.entries(e)) {
      if (!campo.startsWith("Precio ")) continue;
      let codigo = COMBUSTIBLES[campo];
      if (!codigo) {
        codigo = slug(campo);
        avisos.add(`Campo de precio no mapeado: "${campo}" -> ${codigo}`);
      }
      const precio = num(valor);
      if (precio === null) continue;
      // Límite amplio: el hidrógeno y los gases se publican por kg (~25 €).
      if (precio <= 0 || precio >= 100) {
        avisos.add(`Precio fuera de rango descartado: ${ideess} ${codigo} ${valor}`);
        continue;
      }
      precios.push({ ideess, combustible: codigo, precio });
    }
  }
  return { fechaFuente, estaciones, precios, avisos: [...avisos].slice(0, 50) };
}
