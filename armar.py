#!/usr/bin/env python3
"""Casa de Cambio · arma index.html (para publicar como Artifact) y local.html (para probar en el navegador).
Uso: python3 armar.py   (después de actualizar.py)"""
import os, re, json, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
leer = lambda *p: open(os.path.join(AQUI, *p), encoding="utf-8").read()

def main():
    html = leer("src", "app.html")
    datos = json.loads(leer("datos", "tasas.json"))          # valida
    compacto = json.dumps(datos, separators=(",", ":"), ensure_ascii=False)
    if "</" in compacto:
        compacto = compacto.replace("</", "<\\/")
    partes = {
        "datos": compacto,
        "interprete": leer("src", "interprete.js"),
        "nucleo": leer("src", "nucleo.js"),
        "moneda3d": leer("src", "moneda3d.js"),
        "app_base": leer("src", "app_base.js"),
        "app_graf": leer("src", "app_graf.js"),
        "app_voz": leer("src", "app_voz.js"),
    }
    def ascii_js(txt):
        # el JS viaja solo con ASCII (\uXXXX): no depende de la codificación con que se sirva la página
        def r(m):
            b = m.group(0).encode("utf-16-be")
            return "".join("\\u%02x%02x" % (b[i], b[i + 1]) for i in range(0, len(b), 2))
        return re.sub(r"[^\x00-\x7f]", r, txt)
    for k in ("interprete", "nucleo", "moneda3d", "app_base", "app_graf", "app_voz"):
        partes[k] = ascii_js(partes[k])
    html = html.replace("<!--@externa-->", "<!--@externa-->", 1)
    for k, v in partes.items():
        marca = f"<!--@{k}-->"
        if marca not in html:
            sys.exit(f"Falta la marca {marca} en src/app.html")
        html = html.replace(marca, v.replace("\\", "\\\\") if False else v)
    externa = "<script>" + ascii_js(leer("src", "externa.js")) + "</script>"
    base = html
    html = base.replace("<!--@externa-->", "")
    # el fragmento publicable NO lleva doctype/html/head/body
    with open(os.path.join(AQUI, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    # app fuera del artefacto: PWA en web/ (también es lo que empaqueta el APK)
    tags = ('<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#0a0e15">'
            '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Casa de Cambio">'
            '<link rel="apple-touch-icon" href="icono-192.png"><link rel="icon" href="icono-192.png">\n')
    web = base.replace("<!--@externa-->", externa).replace(
        "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", "three.min.js")
    os.makedirs(os.path.join(AQUI, "web"), exist_ok=True)
    with open(os.path.join(AQUI, "web", "index.html"), "w", encoding="utf-8") as f:
        f.write('<!doctype html>\n<html lang="es"><meta charset="utf-8">\n' + tags + web + "\n</html>\n")
    with open(os.path.join(AQUI, "web", "tasas.json"), "w", encoding="utf-8") as f:
        f.write(compacto)
    # versión local con doctype para probar con el servidor estático
    local = ('<!doctype html>\n<html lang="es"><meta charset="utf-8">'
             '\n' + html + "\n</html>\n")
    with open(os.path.join(AQUI, "local.html"), "w", encoding="utf-8") as f:
        f.write(local)
    kb = lambda n: os.path.getsize(os.path.join(AQUI, n)) / 1024
    propio = len(html.encode()) - len(compacto.encode())
    print(f"index.html {kb('index.html'):.1f} KB (propio {propio/1024:.1f} KB + datos {len(compacto.encode())/1024:.1f} KB) · local.html {kb('local.html'):.1f} KB")

if __name__ == "__main__":
    main()
