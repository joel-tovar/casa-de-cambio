# Casa de Cambio · diseño
1. Mundo: una moneda de titanio champaña, grabada y con canto estriado, es el corazón de la interfaz (un solo canvas WebGL, Three.js r128). Todo gira, vuela y vuelve a ella.
2. Tema oscuro único (`color-scheme: dark`): grafito azulado `#0a0e15`, paneles `rgba(255,255,255,.04)`, texto `#eef1f7` / `#a4adbf` / `#6f7a90`. Nunca amarillo sobre negro; sube `#5fd6a4`, baja `#ff8077`, aviso ámbar `#f2b25c`.
3. Ambiente: cada moneda tiene un tinte (h,s,l en `INFO`). Dos resplandores de fondo (origen arriba-izq., destino abajo-der.), el canto de la moneda, la línea de la gráfica y las teclas de operación cambian con transición suave.
4. Tipografía: Geist (una sola familia), cifras tabulares siempre; destino 92 px / 600, origen 68 px / 500; formato colombiano 1.234.567,89.
5. 3D nunca detrás de los números: el fondo tras los datos es sólido o un gradiente muy suave.
6. Resortes propios (`Resorte`: k = rigidez, c = amortiguación) con un solo motor `requestAnimationFrame` que se apaga cuando nada se mueve; para CSS se muestrean como `linear()`.
7. Odómetro: cada dígito es una columna de 12 filas que rueda con resorte, escalonado de derecha a izquierda.
8. Moneda: tocar = voltea y suena el «tin» (WebAudio generado); arrastrar = gira con inercia y vuelve al frente; en voz levita con anillos de onda que se aceleran con cada resultado parcial.
9. Apertura: acuñado con destello y chispas, giro lento, `CASA DE CAMBIO` letra por letra, vuelo al botón. 2,6 s la primera vez (≈0,8 s después), con «Saltar» y seguro por tiempo.
10. Gráfica SVG propia: PCHIP, se dibuja de izquierda a derecha, morph entre rangos, máximo y mínimo marcados, arrastre recorre los puntos reales y la cifra principal rueda a esa tasa.
11. Selector: hoja inferior con resorte y arrastre para cerrar; monedas 3D pintadas en CSS (degradados + inclinación con el puntero); la elegida vuela a su sitio.
12. Voz: `interpretar()` puro (src/interprete.js), fichas que se iluminan por moneda, respuesta hablada con números en letras; sin micrófono, plan B con campo de texto.
13. Accesibilidad: foco visible, `aria-label`, `aria-live` en el resultado, `prefers-reduced-motion` (sin apertura, cambios instantáneos), zonas seguras y cero desborde horizontal desde 320 px.
14. Respaldo: si WebGL falla, moneda CSS 3D con la misma API (`?css=1` para probarla).
15. Ganchos de prueba: `?raf=t` (reloj por temporizadores en paneles ocultos), `?rm=1` (movimiento reducido), `?voz=texto` (plan B de voz).
