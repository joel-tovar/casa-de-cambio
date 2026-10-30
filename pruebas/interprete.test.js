// node pruebas/interprete.test.js
const { interpretar: I, numeroEnLetras } = require('../src/interprete.js');
let ok = 0, mal = 0;
function caso(nombre, texto, esperado, ctx) {
  const r = I(texto, ctx);
  const falla = [];
  for (const k of Object.keys(esperado)) {
    const a = JSON.stringify(r[k]), e = JSON.stringify(esperado[k]);
    if (a !== e) falla.push(`${k}: obtuve ${a}, esperaba ${e}`);
  }
  if (falla.length) { mal++; console.log('  ✗', nombre, '·', JSON.stringify(texto), '\n     ', falla.join(' | ')); }
  else { ok++; console.log('  ✓', nombre); }
}
const m = (monto, de, a) => ({ monto, de, a });

console.log('Números');
caso('cien', 'cien dólares a pesos', m(100, 'USD', 'COP'));
caso('doscientos cincuenta mil', 'doscientos cincuenta mil pesos a dólares', m(250000, 'COP', 'USD'));
caso('dos millones y medio', 'dos millones y medio de pesos a euros', m(2500000, 'COP', 'EUR'));
caso('un millón doscientos mil', 'un millón doscientos mil pesos en dólares', m(1200000, 'COP', 'USD'));
caso('1.500 con punto', '1.500 dólares a pesos', m(1500, 'USD', 'COP'));
caso('1,5 millones', '1,5 millones de pesos a dólares', m(1500000, 'COP', 'USD'));
caso('20 mil', '20 mil pesos a quetzales', m(20000, 'COP', 'GTQ'));
caso('2 lucas', '2 lucas a dólares', m(2000, 'COP', 'USD'));
caso('2 lucas dólares', 'dos lucas en dólares', m(2000, 'COP', 'USD'));
caso('un palo', 'un palo de pesos en euros', m(1000000, 'COP', 'EUR'));
caso('dos palos', 'dos palos a dólares', m(2000000, 'COP', 'USD'));
caso('medio millón', 'medio millón de pesos a dólares', m(500000, 'COP', 'USD'));
caso('mil quinientos', 'mil quinientos dólares a pesos', m(1500, 'USD', 'COP'));
caso('cifra pura', '350 dólares a pesos', m(350, 'USD', 'COP'));
caso('treinta y cinco', 'treinta y cinco euros a pesos', m(35, 'EUR', 'COP'));
caso('veintiún mil', 'veintiún mil pesos a dólares', m(21000, 'COP', 'USD'));
caso('2.000.000 puntos', '2.000.000 de pesos a dólares', m(2000000, 'COP', 'USD'));
caso('quinientos mil', 'quinientos mil pesos en quetzales', m(500000, 'COP', 'GTQ'));
caso('tres millones quinientos mil', 'tres millones quinientos mil pesos a euros', m(3500000, 'COP', 'EUR'));
caso('un dólar (1)', 'un dólar a pesos', m(1, 'USD', 'COP'));

console.log('Patrones');
caso('X A a B', 'cien dólares a pesos', m(100, 'USD', 'COP'));
caso('X A en B', 'cien euros en pesos', m(100, 'EUR', 'COP'));
caso('cuánto son X A en B', 'cuánto son 50 dólares en pesos', m(50, 'USD', 'COP'));
caso('cuántos B son X A', 'cuántos euros son dos millones de pesos', m(2000000, 'COP', 'EUR'));
caso('cuántos pesos son cien dólares', 'cuántos pesos son cien dólares', m(100, 'USD', 'COP'));
caso('pasa X A a B', 'pasa 300 euros a dólares', m(300, 'EUR', 'USD'));
caso('convierte', 'convierte mil dólares a quetzales', m(1000, 'USD', 'GTQ'));
caso('a cómo está el dólar', '¿A cómo está el dólar?', m(1, 'USD', 'COP'));
caso('a cuánto está el euro', 'a cuánto está el euro', m(1, 'EUR', 'COP'));
caso('sin monto con ctx', 'dólares a pesos', m(750, 'USD', 'COP'), { monto: 750, de: 'EUR', a: 'GTQ' });
caso('sin monto sin ctx', 'dólares a pesos', { monto: null, de: 'USD', a: 'COP', faltan: ['monto'] });
caso('solo origen: destino actual', 'cien dólares', m(100, 'USD', 'GTQ'), { monto: 5, de: 'COP', a: 'GTQ' });
caso('solo origen = destino actual -> COP', 'cien dólares', m(100, 'USD', 'COP'), { monto: 5, de: 'COP', a: 'USD' });
caso('solo origen sin ctx pide destino', 'cien dólares', { monto: 100, de: 'USD', a: null, faltan: ['a'] });
caso('"pesos" a secas = COP', '200 dólares a pesos', m(200, 'USD', 'COP'));

console.log('Monedas y sinónimos');
caso('verdes', 'cien verdes a pesos', m(100, 'USD', 'COP'));
caso('gringos', 'mil gringos en pesos', m(1000, 'USD', 'COP'));
caso('quetzal/guatemala', '500 quetzales a pesos', m(500, 'GTQ', 'COP'));
caso('pesos mexicanos', 'mil pesos mexicanos a pesos', m(1000, 'MXN', 'COP'));
caso('lempiras', 'cien lempiras a quetzales', m(100, 'HNL', 'GTQ'));
caso('soles / perú', 'cien soles en pesos', m(100, 'PEN', 'COP'));
caso('pesos chilenos', 'cien mil pesos chilenos a pesos', m(100000, 'CLP', 'COP'));
caso('pesos argentinos', 'diez mil pesos argentinos en dólares', m(10000, 'ARS', 'USD'));
caso('reales', 'cien reales a pesos', m(100, 'BRL', 'COP'));
caso('colones', 'cien mil colones a dólares', m(100000, 'CRC', 'USD'));
caso('pesos dominicanos', 'cinco mil pesos dominicanos a pesos', m(5000, 'DOP', 'COP'));
caso('libras', 'cien libras a pesos', m(100, 'GBP', 'COP'));
caso('dólares canadienses', 'cien dólares canadienses a pesos', m(100, 'CAD', 'COP'));
caso('dírhams', 'cien dírhams a pesos', m(100, 'AED', 'COP'));
caso('yuanes', 'cien yuanes a pesos', m(100, 'CNY', 'COP'));
caso('países: Guatemala', 'cien dólares a Guatemala', m(100, 'USD', 'GTQ'));
caso('pesos colombianos', 'cien mil pesos colombianos a dólares', m(100000, 'COP', 'USD'));
caso('sin tildes ni mayúsculas', 'CUANTOS EUROS SON TRES MILLONES DE PESOS', m(3000000, 'COP', 'EUR'));
caso('pasa/convierte con "pásame"', 'pásame cincuenta dólares a pesos', m(50, 'USD', 'COP'));

console.log('Fallos');
caso('no entiende', 'qué hora es', { ok: false, entendido: false, faltan: ['monto', 'de', 'a'] });
caso('solo monto con ctx', 'doscientos', m(200, 'USD', 'COP'), { monto: 1, de: 'USD', a: 'COP' });
caso('mismas monedas', 'cien dólares a dólares', { de: 'USD', a: null });

console.log('Fichas');
{
  const r = I('cien dólares a pesos');
  const t = r.tokens.map(x => x.tipo + ':' + x.texto).join(' | ');
  const esperado = 'monto:cien | de:dólares | palabra:a | a:pesos';
  if (t === esperado) { ok++; console.log('  ✓ fichas'); } else { mal++; console.log('  ✗ fichas', t); }
}

console.log('Número en letras (voz)');
function letras(n, e) {
  const r = numeroEnLetras(n);
  if (r === e) { ok++; console.log('  ✓', n, '→', r); } else { mal++; console.log('  ✗', n, r, '≠', e); }
}
letras(100, 'cien');
letras(317603, 'trescientos diecisiete mil seiscientos tres');
letras(1000000, 'un millón');
letras(21000, 'veintiún mil');
letras(1250000, 'un millón doscientos cincuenta mil');

console.log(`\n${ok} bien · ${mal} mal · ${ok + mal} casos`);
process.exit(mal ? 1 : 0);
