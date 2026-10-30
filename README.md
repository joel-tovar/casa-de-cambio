# Casa de Cambio

Conversor de monedas (16 monedas) con moneda 3D, voz y gráfica. Texto en español colombiano.

```bash
python3 actualizar.py            # baja tasas de Google Finance + histórico (cache/) -> datos/tasas.json
python3 actualizar.py --sin-historico   # solo Google (rápido)
python3 armar.py                 # embebe datos y genera index.html (para publicar) y local.html (para probar)
node pruebas/interprete.test.js  # 63 casos del intérprete de voz
python3 -m http.server 8791      # abrir http://localhost:8791/local.html
```

- `index.html` es el fragmento para publicar como Artifact (empieza en `<title>`, sin doctype). `local.html` es lo mismo con doctype.
- Con `db`, la página lee `tasas/hoy` y reemplaza los datos si el documento es más nuevo (campo `ts`).
- Ganchos de prueba: `?raf=t`, `?rm=1`, `?css=1`, `?voz=texto`.
- Capturas en `capturas/`.
