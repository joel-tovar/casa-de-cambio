#!/usr/bin/env python3
"""Casa de Cambio · actualiza datos/tasas.json (solo biblioteca estándar).

Uso:  python3 actualizar.py          (corrida diaria: baja solo lo que falta)
      python3 actualizar.py --sin-historico   (solo Google, más rápido)
"""
import json, os, re, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone, date

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.join(AQUI, "datos", "tasas.json")
CACHE = os.path.join(AQUI, "cache")
MONEDAS = ["USD", "COP", "EUR", "MXN", "GTQ", "HNL", "PEN", "CLP", "ARS", "BRL", "CRC", "DOP", "GBP", "CAD", "AED", "CNY"]
OTRAS = [m for m in MONEDAS if m != "USD"]
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
TZ = timezone(timedelta(hours=-5))
LIMITE_AVISO, LIMITE_FALLA = 200 * 1024, 240 * 1024


def sig6(x):
    if x is None:
        return None
    return float(f"{x:.6g}")


def pedir(url, headers=None, reintentos=2, timeout=25):
    h = {"User-Agent": UA}
    h.update(headers or {})
    ultimo = None
    for i in range(reintentos + 1):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            ultimo = e
        except Exception as e:  # red, tiempo de espera
            ultimo = e
        time.sleep(1.5 * (i + 1))
    raise ultimo


def bloque(html, clave):
    """Devuelve el JSON del bloque AF_initDataCallback con key 'ds:N'."""
    m = re.search(r"AF_initDataCallback\(\{key: '%s', hash: '[^']*', data:" % re.escape(clave), html)
    if not m:
        return None
    i = m.end()
    prof, en_str, esc = 0, False, False
    for j in range(i, len(html)):
        c = html[j]
        if en_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                en_str = False
            continue
        if c == '"':
            en_str = True
        elif c in "[{":
            prof += 1
        elif c in "]}":
            prof -= 1
            if prof == 0:
                return json.loads(html[i:j + 1])
    return None


def serie_g(data):
    """Lista de (datetime, precio) desde data[0][0][3][0][1]."""
    out = []
    for p in data[0][0][3][0][1]:
        f, v = p[0], p[1][0]
        if not f or v is None or f[0] is None:
            continue
        y, mo, d = f[0], f[1], f[2]
        h = f[3] if len(f) > 3 and f[3] is not None else 0
        mi = f[4] if len(f) > 4 and f[4] is not None else 0
        out.append((datetime(y, mo, d, h, mi), float(v)))
    return out


def decimales(v):
    t = repr(float(v))
    return len(t.split(".")[1]) if "." in t else 0


def google(mon):
    # Finance alterna dos fuentes para el mismo par (medido 30-oct: 3172,34527 y 3224,49). La de Morningstar,
    # la misma de la búsqueda de Google, trae 4 o más decimales; la otra, 2. Se reintenta hasta dar con ella.
    mejor = None
    for intento in range(6):
        if intento:
            time.sleep(1.5)
        html = pedir(f"https://www.google.com/finance/quote/USD-{mon}",
                     {"Accept-Language": "es-CO,es;q=0.9", "Cookie": "CONSENT=YES+1"})
        fila = bloque(html, "ds:2")[0][0][0]
        if fila[2] != f"USD / {mon}":
            continue
        if mejor is None or decimales(fila[5][0]) > decimales(mejor[0][5][0]):
            mejor = (fila, html)
        if decimales(fila[5][0]) >= 4:
            break
    if mejor is None:
        raise ValueError("Google no devolvió el par pedido")
    fila, html = mejor
    r = float(fila[5][0])
    ts = int(fila[11][0])
    ds11 = bloque(html, "ds:11")
    mes = serie_g(ds11)
    if len(mes) < 5:
        raise ValueError("serie de 1 mes vacía")
    dia = []
    try:
        ds10 = bloque(html, "ds:10")
        if ds10:
            dia = serie_g(ds10)
    except Exception:
        dia = []
    # el día también mezcla las dos fuentes: si hay suficientes de Morningstar, solo esas, y cierra en la tasa actual
    finos = [p for p in dia if decimales(p[1]) >= 4]
    if len(finos) >= 8:
        dia = finos
    if dia:
        dia[-1] = (dia[-1][0], r)
    # buckets de 15 minutos (último valor del bucket)
    b = {}
    for t, v in dia:
        t = t - timedelta(hours=5)  # Google entrega UTC; mostramos hora de Colombia
        k = t.replace(minute=(t.minute // 15) * 15, second=0)
        b[k] = v
    dia15 = sorted(b.items())
    return {"r": r, "ts": ts, "c": float(fila[7]), "mes": mes, "dia": dia15}


def cargar_previo():
    try:
        with open(SALIDA) as f:
            return json.load(f)
    except Exception:
        return None


def bajar_historico(dia_iso):
    """Descarga (o lee de cache) el archivo de un día. Devuelve dict de tasas o None."""
    ruta = os.path.join(CACHE, f"{dia_iso}.json")
    if os.path.exists(ruta):
        try:
            with open(ruta) as f:
                return json.load(f)
        except Exception:
            pass
    url = f"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{dia_iso}/v1/currencies/usd.min.json"
    try:
        txt = pedir(url, reintentos=1)
    except urllib.error.HTTPError:
        return None
    except Exception:
        return None
    try:
        d = json.loads(txt)["usd"]
        solo = {m: d[m.lower()] for m in OTRAS if m.lower() in d}
    except Exception:
        return None
    os.makedirs(CACHE, exist_ok=True)
    with open(ruta, "w") as f:
        json.dump(solo, f)
    return solo


def historico(hoy):
    semanales = [hoy - timedelta(days=7 * i) for i in range(104, 12, -1)]  # ~2 años, semanal
    diarios = [hoy - timedelta(days=i) for i in range(90, 0, -1)]
    dias = sorted(set(semanales + diarios))
    iso = [d.isoformat() for d in dias]
    falta = [i for i in iso if not os.path.exists(os.path.join(CACHE, i + ".json"))]
    if falta:
        print(f"Histórico: bajando {len(falta)} archivos (6 hilos)…")
    with ThreadPoolExecutor(max_workers=6) as ex:
        res = list(ex.map(bajar_historico, iso))
    return [(d, r) for d, r in zip(dias, res) if r]


def principal():
    sin_hist = "--sin-historico" in sys.argv
    previo = cargar_previo()
    ahora = datetime.now(TZ)
    hoy = ahora.date()
    monedas, fallas = {}, []
    g = {}
    for i, m in enumerate(OTRAS):
        if i:
            time.sleep(1)
        try:
            g[m] = google(m)
            monedas[m] = {"r": g[m]["r"], "ts": g[m]["ts"], "c": g[m]["c"]}
        except Exception as e:
            fallas.append(m)
            print(f"  ! Google falló para {m}: {type(e).__name__}: {str(e)[:80]}")
            if previo and m in previo.get("monedas", {}):
                monedas[m] = previo["monedas"][m]
            if len(fallas) > 3:
                print("Fallaron más de 3 monedas: no se sobrescribe el archivo.")
                sys.exit(1)
    monedas["USD"] = {"r": 1.0, "ts": int(time.time())}
    ok = [m for m in OTRAS if m in g]
    print(f"Google OK: {len(ok)}/{len(OTRAS)}  fallas: {fallas or 'ninguna'}")

    # ---- m1 (1 mes, Google) ----
    todas_t = sorted({t.strftime("%Y-%m-%d") for m in ok for t, _ in g[m]["mes"]})
    # un punto por día (último del día) para mantener el tamaño bajo
    m1t = todas_t
    m1v = {}
    for m in OTRAS:
        if m in g:
            porDia = {}
            for t, v in g[m]["mes"]:
                porDia[t.strftime("%Y-%m-%d")] = v
            m1v[m] = [sig6(porDia.get(d)) for d in m1t]
        elif previo and previo.get("m1", {}).get("v", {}).get(m) and previo["m1"]["t"] == m1t:
            m1v[m] = previo["m1"]["v"][m]
    # la serie de 1 mes de Google es horaria o diaria; para el gráfico de 1S necesitamos
    # más resolución, así que conservamos hasta 4 puntos por día en 'w1' si alcanza.
    # ---- d1 (1 día, buckets 15 min) ----
    d1_ok = [m for m in ok if g[m]["dia"]]
    d1t = sorted({k for m in d1_ok for k, _ in g[m]["dia"]})
    d1v = {}
    for m in d1_ok:
        mp = dict(g[m]["dia"])
        d1v[m] = [sig6(mp.get(k)) for k in d1t]
    d1 = {"t": [k.strftime("%Y-%m-%dT%H:%M") for k in d1t], "v": d1v}

    # ---- y2 (histórico de referencia) ----
    if sin_hist and previo and previo.get("y2"):
        y2 = previo["y2"]
    else:
        h = historico(hoy)
        y2t = [d.isoformat() for d, _ in h]
        y2v = {}
        for m in OTRAS:
            y2v[m] = [sig6(r.get(m)) for _, r in h]
        y2 = {"t": y2t, "v": y2v}
    # empalme con la tasa de hoy
    hoy_iso = hoy.isoformat()
    if y2["t"] and y2["t"][-1] < hoy_iso:
        y2["t"].append(hoy_iso)
        for m in OTRAS:
            y2["v"][m].append(sig6(monedas[m]["r"]))
    elif y2["t"]:
        for m in OTRAS:
            y2["v"][m][-1] = sig6(monedas[m]["r"])

    # m1 por hora: Google ofrece ~1 punto por día o más; si la serie de 1 mes trae
    # varios puntos por día los guardamos todos con fecha-hora.
    # Aquí la dejamos diaria (suficiente para 1S/1M y liviana).
    salida = {
        "ts": int(time.time()),
        "actualizado": ahora.isoformat(timespec="seconds"),
        "fallas": fallas,
        "monedas": monedas,
        "d1": d1,
        "m1": {"t": m1t, "v": m1v},
        "y2": y2,
    }
    txt = json.dumps(salida, separators=(",", ":"), ensure_ascii=False)
    kb = len(txt.encode()) / 1024
    if len(txt.encode()) > LIMITE_FALLA:
        print(f"ERROR: tasas.json pesa {kb:.0f} KB (> 240 KB). No se guarda.")
        sys.exit(2)
    if len(txt.encode()) > LIMITE_AVISO:
        print(f"AVISO: tasas.json pesa {kb:.0f} KB (> 200 KB).")
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w") as f:
        f.write(txt)
    print(f"Listo: {SALIDA}  {kb:.1f} KB · d1 {len(d1['t'])} pts · m1 {len(m1t)} pts · y2 {len(y2['t'])} pts")
    return salida


if __name__ == "__main__":
    principal()
