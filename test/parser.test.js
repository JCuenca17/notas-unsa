// node test/parser.test.js
const assert = require('assert');
const P = require('../parser.js');

const texto = [
  'ESCUELA DE PRUEBA Periodo: 2026-B',
  '1.\tESTRUCTURAS DE DATOS\tEVAL. CONTINUA 1\tA\t14\t15%\tNo',
  '2.\tESTRUCTURAS DE DATOS\tEXAMEN 1\tA\t09\t15%\tNo',
  '3. CALCULO INTEGRAL 2 EVAL. CONTINUA 1 B 17 10% No',
  '4. CALCULO INTEGRAL 2 EXAMEN 1 B 15 20% No',
  '5. TALLER DE INVESTIGACIÓN EVAL. CONTINUA 1 C 16 30% No',
  '6. COMUNICACION EXAMEN 1 A - 10% Si'
].join('\n');

const r = P.parsear(texto);
assert.strictEqual(r.periodo, '2026-B');
assert.strictEqual(r.cursos.length, 4);

// Lo que falta va como un solo bloque con el peso real restante
const ed = r.cursos[0];
assert.strictEqual(ed.nombre, 'Estructuras de Datos');
assert.deepStrictEqual(ed.evaluaciones.map(e => e.id), ['EC1', 'EX1', 'RESTO']);
assert.strictEqual(ed.evaluaciones[2].peso, 70);

// "Calculo Integral 2": el número del curso no se confunde con el parcial
assert.strictEqual(r.cursos[1].nombre, 'Calculo Integral 2');
assert.strictEqual(r.cursos[1].grupo, 'B');

// Ausente sin nota cuenta como 0
assert.strictEqual(r.cursos[3].evaluaciones[0].nota, 0);

// 14*.15 + 9*.15 = 3.45; falta 70 % → necesita (10.5-3.45)/.7 = 10.07
const k = P.calcular(ed, 10.5);
assert.ok(Math.abs(k.acumulado - 3.45) < 1e-9);
assert.ok(Math.abs(k.necesita - 10.0714) < 1e-3);

// Simular 15 en lo que falta cierra el curso
const k2 = P.calcular(ed, 10.5, { RESTO: 15 });
assert.strictEqual(k2.pesoLibre, 0);
assert.ok(Math.abs(k2.acumulado + k2.supuesto - 13.95) < 1e-9);

// Probabilidad: casos límite y orden
const sd = P.dispersion(r.cursos);
assert.ok(sd >= 2 && sd <= 5);
assert.strictEqual(P.probAprobar(0, 12, 3), 1);
assert.strictEqual(P.probAprobar(21, 12, 3), 0);
assert.ok(Math.abs(P.probAprobar(12, 12, 3) - 0.5) < 0.05);
assert.ok(P.probAprobar(8, 14, 3) > P.probAprobar(12, 14, 3));

assert.strictEqual(P.parsear('hola').cursos.length, 0);
console.log('OK: todas las pruebas pasan');
