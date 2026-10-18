# Fuente de datos — Fase 0

Verificado el 17/10/2026 (sábado) entre las 21:54 y las 23:14, hora peninsular.

## Resumen

| Punto | Estado |
| --- | --- |
| Servicio oficial localizado | ✅ REST del Ministerio, sin autenticación |
| Formato y campos | ✅ JSON documentado abajo con datos reales |
| Frecuencia real | ✅ Cambia varias veces al día (medido); la "Fecha" del JSON **no** es la de publicación |
| Horarios | ✅ Gramática regular; 0 textos no interpretables en la muestra |
| **Licencia comercial** | ⚠️ **PENDIENTE de confirmar por escrito** (ver §4) |
| Campos para camión | ❌ Faltan apto camión, aparcamiento y atendida/automática; AdBlue solo parcial |
| Límite técnico | ⚠️ El servidor solo acepta TLS 1.2 con RSA estático: incompatible con Edge Functions (resuelto con pg_net) |

## 1. Servicio

- **Catálogo**: en datos.gob.es aparece como *Geoportal Gasolineras: localización de las
  instalaciones de repostaje* (`e0dat0002-geoportal-gasolineras-localizacion-de-las-instalaciones-de-repostaje`),
  publicado vía el Catálogo Oficial de Datos y Servicios INSPIRE (CODSI). El portal de
  referencia es el Geoportal de Gasolineras (`geoportalgasolineras.es`), del MITECO.
- **URL usada**:
  `https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/`
- **Ayuda/operaciones**: `.../PreciosCarburantes/help`. Hay filtros por CCAA, provincia,
  municipio y producto, histórico por fecha (`EstacionesTerrestresHist/{FECHA}`) y
  listados (provincias, municipios, productos).
- **Formato**: JSON (`application/json; charset=utf-8`), sin autenticación,
  `Access-Control-Allow-Origin: *`. Servidor IIS/ASP.NET.
- **Tamaño**: 12,15 MB por descarga completa. ~9 s desde España.
- **Límites documentados**: no se ha encontrado ninguno (ni cuota ni rate limit). Una
  descarga al día es un uso muy por debajo de cualquier límite razonable.

### Estructura

```json
{
  "Fecha": "17/10/2026 21:54:46",
  "ListaEESSPrecio": [ { ...una estación... } ],
  "Nota": "Archivo de todos los productos en todas las estaciones de servicio. La actualización de precios se realiza cada media hora, con los precios en vigor en ese momento.",
  "ResultadoConsulta": "OK"
}
```

### Campos reales por estación (muestra: 11.432 estaciones, 52 provincias, 3.237 municipios)

| Campo | Ejemplo | Notas |
| --- | --- | --- |
| `IDEESS` | `"4375"` | Identificador de la estación. Único en la muestra. |
| `Rótulo` | `"Nº 10.935"` | Marca/nombre comercial, a veces con espacios finales. |
| `Dirección`, `C.P.`, `Localidad`, `Municipio`, `Provincia` | | Texto libre, mayúsculas en dirección y provincia. |
| `IDMunicipio`, `IDProvincia`, `IDCCAA` | `"52"`, `"02"`, `"07"` | Códigos del propio servicio (no INE). |
| `Latitud`, `Longitud (WGS84)` | `"39,211417"` | **Coma decimal**, como texto. 0 estaciones sin coordenadas. |
| `Horario` | `"L-D: 07:00-22:00"` | Ver §3. |
| `Margen` | `D` 6.086 · `I` 2.699 · `N` 2.647 | Lado de la vía (derecha/izquierda/no aplica). |
| `Remisión` | `dm` 7.406 · `OM` 4.026 | Quién remite los datos (distribuidor minorista / operador mayorista). |
| `Tipo Venta` | `P` 11.432 | Todas "P" (venta al público) en este endpoint. |
| `% BioEtanol`, `% Éster metílico` | `"0,0"` | |
| `Precio <producto>` (23 campos) | `"1,799"` o `""` | **Coma decimal**, vacío = no se vende o no se publica. |

Estaciones con precio por producto en la muestra: Gasóleo A 11.220 · Gasolina 95 E5 10.880 ·
Gasóleo Premium 5.888 · Gasolina 98 E5 5.474 · **AdBlue 2.940** · Gasóleo B 2.257 ·
Diésel renovable 1.618 · Gasolina 95 E5 Premium 1.115 · GLP 996 · GNC 98 · GNL 53 ·
Biogás licuado 50 · Biogás comprimido 42 · Gasolina renovable 31 · Biodiésel 28 ·
95 E10 27 · 98 E10 15 · 95 E85 2 · Hidrógeno 2 · 95 E25 1 · Bioetanol 1 · Amoniaco 0 · Metanol 0.

**Unidades**: el JSON no las declara, pero sí el anexo de la orden que regula su remisión
(confirmado el 18/10/2026, ver §8): €/l para carburantes líquidos, GLP y AdBlue; €/kg para GNC,
GNL, hidrógeno, metanol, amoniaco y biogás.

## 2. Frecuencia real de actualización

- La `Nota` del propio JSON dice "cada media hora".
- **La `Fecha` del JSON es la hora de la respuesta**, no la de publicación de los datos:
  coincide al segundo con la cabecera HTTP `Date` (21:54:46 local = 19:54:46 GMT), y
  cada petición trae una distinta. No sirve como clave de idempotencia.
- Medido: entre las 21:54 y las 23:13 (79 min, sábado noche) cambiaron **155 precios en
  48 estaciones** y desapareció 1 estación. Entre las capturas de las 22:18 y las 22:52
  también hubo cambios. Los datos cambian a lo largo del día, como mínimo con
  granularidad inferior a la hora.
- Consecuencia: con una carga diaria, un precio mostrado puede tener hasta ~24 h. Por eso
  cada precio lleva la fecha y hora de su captura y nunca se llama "en vivo".

## 3. Horarios

Formato observado: `DÍAS: TRAMO[; DÍAS: TRAMO…]`, con días `L M X J V S D` (sueltos o en
rango `L-V`), tramos `HH:MM-HH:MM` (también `H:MM`), varios tramos unidos por ` y `, y `24H`.

- 1.165 textos distintos. Los más frecuentes: `L-D: 24H` (5.182), `L-D: 06:00-22:00` (1.576),
  `L-D: 07:00-23:00` (735).
- Variantes de 24 h: `L-D: 24H`; `L-D: 00:00-23:59` (78); combinaciones que cubren la
  semana (`L-V: 24H; S-D: 24H`).
- Casos dudosos: `L: 24H` (119), `L: 00:00-23:59` (4), `S-D: 24H`, `L-S: 24H`,
  `L-M: 24H; J-D: 24H` (falta el miércoles). Probablemente errores de alta, pero no se
  presupone nada.

Clasificación aplicada (`supabase/functions/gasol-ingest/horario.ts`, 29 tests):

| Resultado | Regla | Estaciones |
| --- | --- | --- |
| `si` | Los 7 días cubiertos una sola vez y todos `24H` o `00:00-23:59`/`00:00-24:00` | 5.261 |
| `no` | Se entiende y al menos un día tiene horario parcial | 6.043 |
| `sin_confirmar` | Días sin cubrir con el resto 24 h, días repetidos, `00:00-00:00` o formato desconocido | 128 |

El texto original se guarda siempre (`gasol_estaciones.horario_texto`) y se muestra al usuario.

## 4. Licencia y condiciones de reutilización — PENDIENTE

Lo que dicen literalmente las fuentes encontradas:

1. **Registro INSPIRE del Geoportal** (CODSI, `spaGeoportal`, fecha del registro
   2025-04-03), enlazado desde datos.gob.es:
   - Limitaciones de acceso: *"Sin limitaciones al acceso público."*
   - Condiciones de uso: *"No se aplican condiciones de acceso y uso."* y *"MITERD CC BY 4.0"*.
2. **Aviso legal de datos abiertos del MITECO** (`datosabiertos.miteco.gob.es/es/aviso-legal.html`):
   *"Las presentes condiciones generales permiten la reutilización de los documentos
   sometidos a ellas para fines comerciales y no comerciales."* Condiciones: no
   desnaturalizar la información; citar la fuente (*"Origen de los datos: Ministerio para
   la Transición ecológica y el Reto Demográfico"*); mencionar la fecha de la última
   actualización; no sugerir que el Ministerio participa, patrocina o apoya; conservar los
   metadatos de fecha y condiciones.
3. **Geoportal de Gasolineras**: la URL `/geoportal-instalaciones/AvisoLegal` redirige a la
   portada; no se ha encontrado aviso legal propio. La página de ayuda del servicio REST
   no menciona licencia.

**Por qué queda pendiente**: ningún texto vincula *expresamente* el servicio REST de
precios (`sedeaplicaciones.minetur.gob.es`) con una licencia. El CC BY 4.0 figura en el
registro del dataset de *localización* del Geoportal, y el aviso legal citado es el del
portal de datos abiertos del MITECO. Todo apunta a reutilización comercial permitida con
atribución (Ley 37/2007 y RD 1495/2011), pero **no se afirma hasta tener confirmación**.

Mientras tanto la app ya cumple las condiciones del punto 2: atribución literal, fecha de
captura en cada precio y aviso de que el Ministerio no participa ni patrocina.

### Borrador de consulta al organismo

> **Para**: bzn-censoeess@miteco.es (punto de contacto del Geoportal en el registro INSPIRE)
> **Asunto**: Condiciones de reutilización del servicio REST de precios de carburantes
>
> Buenos días:
>
> Estamos desarrollando una aplicación para conductores profesionales (taxi, VTC, furgoneta y
> camión) que muestra los precios de
> carburantes publicados en el servicio
> https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/
> con la fecha de captura y la cita "Origen de los datos: Ministerio para la Transición
> Ecológica y el Reto Demográfico".
>
> ¿Nos pueden confirmar si este servicio se rige por la licencia CC BY 4.0 que figura en
> el registro INSPIRE del Geoportal de Gasolineras (o por las condiciones generales de
> reutilización del MITECO) y si se permite su uso en una aplicación comercial?
> ¿Existe algún límite de frecuencia de consulta que debamos respetar?
>
> Muchas gracias.

## 5. Campos que faltan para nuestras funciones

| Función | ¿En la fuente? | Detalle |
| --- | --- | --- |
| Apto para camión | ❌ No | No hay gálibo, accesos ni surtidor de alto caudal. `Margen` solo indica el lado de la vía. |
| Aparcamiento (camiones) | ❌ No | Ningún campo. |
| AdBlue | ⚠️ Parcial | `Precio Adblue` en 2.940 estaciones (26 %). Que no haya precio **no** significa que no vendan AdBlue. Sin distinguir surtidor o envasado. |
| Atendida / automática | ❌ No | `Tipo Venta` (todas "P") y `Remisión` (dm/OM) no lo indican. |

Fuentes candidatas para completar (sin decidir, cada una con su licencia por revisar):
OpenStreetMap (`hgv`, `fuel:adblue`, `self_service`, `automated`, `parking`) bajo ODbL, que
exige compartir bajo la misma licencia las bases de datos derivadas, o información aportada
por las propias estaciones o los usuarios.

## 6. Limitación técnica encontrada

`sedeaplicaciones.minetur.gob.es` solo negocia **TLS 1.2 con intercambio de claves RSA
estático** (`AES256-GCM-SHA384`). Rechaza TLS 1.3 y los cifrados ECDHE. El runtime de
Supabase Edge Functions (Deno/rustls) no soporta ese cifrado y la conexión se corta en el
handshake. pg_net (libcurl/OpenSSL) desde la base de datos sí conecta, así que la descarga
se hace con pg_net y el resto (normalización, parser, carga) sigue en `gasol-ingest`.
Si el Ministerio cambia la configuración TLS, se puede volver a `fetch` directo.

## 7. Revisión de campos para la ficha de estación — 18/10/2026

Comprobado con el JSON real completo (`Fecha` 18/10/2026 3:41:42, 11.429 estaciones), no con la
documentación. Cada estación trae **41 campos**, todos presentes en todas las estaciones:

- Identificación y dirección: `IDEESS`, `Rótulo`, `Dirección`, `C.P.`, `Localidad`, `Municipio`,
  `Provincia`, `IDMunicipio`, `IDProvincia`, `IDCCAA`, `Latitud`, `Longitud (WGS84)`.
- Operación: `Horario`, `Margen`, `Remisión`, `Tipo Venta`, `% BioEtanol`, `% Éster metílico`.
- 23 campos `Precio …` (con valor: Gasóleo A 11.218 · Gasolina 95 E5 10.878 · Gasóleo Premium
  5.887 · Gasolina 98 E5 5.473 · AdBlue 2.940 · Gasóleo B 2.257 · Diésel renovable 1.618 ·
  Gasolina 95 E5 Premium 1.115 · GLP 996 · GNC 97 · GNL 52 · Biogás licuado 50 · Biogás
  comprimido 42 · Gasolina renovable 31 · Biodiésel 28 · 95 E10 27 · 98 E10 15 · 95 E85 2 ·
  Hidrógeno 2 · 95 E25 1 · Bioetanol 1 · Amoniaco 0 · Metanol 0).

**Teléfono: no existe.** Ningún campo de teléfono, correo ni web. No se muestra ni se busca en
otra fuente.

**Lo que guardamos hoy**: `gasol_estaciones` tiene `ideess, rotulo, direccion, cp, localidad,
municipio, id_municipio, provincia, id_provincia, id_ccaa, lat, lon, margen, remision,
tipo_venta, horario_texto, abierta_24h, actualizada_en` (no se guardan los porcentajes de
bioetanol y éster). `gasol_precios` guarda **todos** los campos `Precio …` con valor (un código
por producto, p. ej. `gasolina_95_e5_premium`), con `fecha_captura` y `fuente`. Para la ficha
no hizo falta ampliar la ingesta.

**Ficha**: muestra Gasóleo A, Gasóleo Premium, Diésel renovable, Gasolina 95 E5, Gasolina 95 E5
Premium, Gasolina 98 E5, GLP y AdBlue, solo si tienen precio en la última captura. Fuera:
Gasóleo B (agrícola) y GNC, GNL, biogás e hidrógeno (unidades sin confirmar; el hidrógeno sale a
9,90–25,00, compatible con €/kg).

**Contraste** (10 estaciones con 5 o más productos, 50 precios): 39 iguales al JSON de las 3:41
del 18/10; los 11 restantes, de 3 estaciones, coinciden con el histórico oficial del 17/10
(`EstacionesTerrestresHist/17-10-2026`): cambiaron de precio después de nuestra captura.

## 8. Combustibles alternativos — 18/10/2026

**Unidades, confirmadas en fuente oficial.** Anexo de la Orden ITC/2308/2007, en su versión
modificada por la Resolución de 5 de diciembre de 2025, publicado por el MITECO
(<https://www.miteco.gob.es/content/dam/miteco/es/energia/files-1/risp/normativa/Documents/Anexos%20Orden%20ITC23082007%20modificados%20por%20Resolucion%205%20diciembre%202025.pdf>).
Textualmente: *"Todos los precios se darán en: euros por litro (€/l) para los productos G95E5,
G95E5+, G95E10, G95E25, G95E85, BIE, G98E5, G98E10, GOA, GOA+, GOB, GOC, BIO, GLP, ADB, DREN y
GREN"* y *"euros por kilogramo (€/kg) para los productos PVPGNC, PVPGNL, PVPH2, PVPMET, PVPAMO,
PVPBGNC y PVPBGNL"*, porque *"son las realmente aplicadas en el punto de venta"*. Es la orden
con la que las estaciones remiten los precios que publica el servicio REST.

**Datos reales en nuestra ingesta** (captura del 17/10/2026, 23:12; ya se guardaban todos):

| Producto | Código | Estaciones | Rango | Unidad | Decisión |
| --- | --- | --- | --- | --- | --- |
| GLP (autogás) | `glp` | 996 | 0,781–1,290 | €/l | Ya estaba en el comparador y las calculadoras. |
| Gas natural comprimido | `gnc` | 97 | 1,299–2,199 | €/kg | **Añadido** al comparador, la ficha y favoritas. |
| Gas natural licuado | `gnl` | 52 | 1,729–1,959 | €/kg | **Añadido** al comparador, la ficha y favoritas. |
| Biogás comprimido | `biogas_comprimido` | 42 | 1,789–1,999 | €/kg | **Añadido** al comparador, la ficha y favoritas. |
| Biogás licuado | `biogas_licuado` | 50 | 1,729–1,889 | €/kg | **Añadido** al comparador, la ficha y favoritas. |
| Hidrógeno | `hidrogeno` | 2 | 9,900 y 25,000 | €/kg | **Fuera**: dos estaciones y un precio 2,5 veces el otro. Se revisará. |
| Metanol, amoniaco | — | 0 | — | €/kg | Sin datos. |

Coherencia: el informe mensual del MITECO de septiembre de 2026 da un GNC medio de 182,12 c€/kg,
dentro del rango observado. Contraste con el histórico oficial del 17/10/2026
(`EstacionesTerrestresHist/17-10-2026`): GNC 97/97, GNL 52/52, biogás comprimido 42/42 y biogás
licuado 50/50 precios iguales.

**Dónde no se añaden todavía**: la ruta (su calculadora de desvío usa litros y l/100 km), las
calculadoras y el control de gastos (piden litros). Requieren pasar a kg y kg/100 km; pendiente.

## 9. Puntos de recarga eléctrica — investigado, NO integrado (18/10/2026)

| Fuente | Qué es | Licencia | Estado |
| --- | --- | --- | --- |
| **Puntos de Recarga de Vehículos Eléctricos** (datos.gob.es, `e05068001-puntos-de-recarga-de-vehiculos-electricos`; <https://datos.gob.es/es/catalogo/e05068001-puntos-de-recarga-de-vehiculos-electricos>) | Registro oficial del MITECO (SG de Prospectiva y Estadísticas Energéticas, aplicación RIPREE). Cobertura nacional. Frecuencia «irregular»; última modificación en el catálogo: 01/06/2026. | **CC BY 4.0**, según el identificador de licencia de la ficha del catálogo. | Candidata principal. |
| **Mapa REVE** (Red Eléctrica, por encargo del MITECO) | Mapa oficial con disponibilidad y precios dinámicos de más de 25.600 puntos. | **No encontrada**: sin aviso legal, condiciones de reutilización ni API pública documentada. | No usar hasta que publiquen condiciones. |

**Campos reales de la exportación CSV** (descargada el 18/10/2026 desde
`https://energia.serviciosmin.gob.es/Ripree/ExportarInstalaciones/Export`: la página genera el
archivo con un `POST` a `GenerarExcel`; `InstalacionesPublicas_20261018_041742.csv`, ~44 MB,
UTF-16, separador `;`, una fila por conector, valores con formato de Excel `="…"`):
COMUNIDAD AUTONOMA, PROVINCIA, MUNICIPIO, LATITUD, LONGITUD, NOMBRE INSTALACION, DIRECCIÓN,
CODIGO POSTAL, LOCALIZACION, TIPO HORARIO APERTURA, HORARIO APERTURA, NOMBRE OPERADOR,
COD. OPERADOR, TIPOS DE SERVICIOS, COD. INSTALACION, ID. PUNTO DE RECARGA, ACCESIBILIDAD,
METODOS DE PAGOS, COD. PUNTO DE RECARGA, ID. CONECTOR, TIPO CONECTOR, TIPO DE CARGA, FORMATO,
POTENCIA MAXIMA, VOLTAJE, INTENSIDAD, FECHA DE ULTIMA MODIFICACION. **No trae precio ni
disponibilidad.**

**Recomendación**: si se integra, usar el registro del MITECO (CC BY 4.0) solo para ubicación,
potencia, conector, horario y operador, con atribución y fecha de última modificación, y sin
precios (no están en la fuente abierta). Antes: confirmar la licencia en el propio portal de
datos abiertos del MITECO, decidir la carga periódica (archivo grande, UTF-16, por `POST`) y
cómo agrupar conectores por instalación. Precio y disponibilidad solo cuando el Mapa REVE
publique condiciones de reutilización.
