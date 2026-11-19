/*
 * Lee el texto de la página "Consulta de Notas Parciales" de la extranet UNSA
 * (copiado y pegado, o enviado por el botón de favoritos) y lo convierte en cursos.
 * Funciona en el navegador (window.NotasParser) y en Node (module.exports) para las pruebas.
 */
(function (root) {
  'use strict';

  // Del final hacia atrás: grupo, nota, peso %, ausente. Lo de la izquierda es "curso + parcial + n.º".
  var FILA = /^(\d+)\.?\s+(.+)\s+(\d+)\s+([A-Z]{1,3})\s+(\S+)\s+(\d+(?:[.,]\d+)?)\s*%\s+(S[IÍ]|NO)\s*$/i;
  var PARCIAL = /^(.*?)\s+(EVAL\.?\s*CONTINUA|EVALUACI[OÓ]N\s+CONTINUA|EXAMEN(?:\s+(?:FINAL|PARCIAL))?|SUSTITUTORIO|PR[AÁ]CTICAS?|TRABAJO|PROYECTO)$/i;

  function normalizar(linea) {
    return linea.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
  }

  function numero(txt) {
    var t = String(txt).replace(',', '.');
    return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
  }

  function tipoDe(parcial) {
    if (/CONTINUA/i.test(parcial)) return 'EC';
    if (/EXAMEN/i.test(parcial)) return 'EX';
    return 'OT';
  }

  function titulo(txt) {
    var menores = { de: 1, del: 1, la: 1, las: 1, el: 1, los: 1, en: 1, y: 1, e: 1, a: 1, para: 1, con: 1 };
    return txt.toLowerCase().split(' ').map(function (p, i) {
      if (/^(i|ii|iii|iv|v|vi)$/.test(p)) return p.toUpperCase();
      if (i > 0 && menores[p]) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }

  function parsear(texto) {
    var filas = [];
    var periodo = null;
    var cui = null;
    var lineas = String(texto || '').split(/\r?\n/);

    for (var i = 0; i < lineas.length; i++) {
      var l = normalizar(lineas[i]);
      if (!l) continue;
      var p = /Periodo:?\s*([0-9]{4}\s*-\s*[A-Z0-9]+)/i.exec(l);
      if (p) periodo = p[1].replace(/\s+/g, '');
      var cu = /CUI:?\s*(\d{6,12})/i.exec(l);
      if (cu) cui = cu[1];

      var m = FILA.exec(l);
      if (!m) continue;

      var medio = m[2];
      var curso = medio;
      var parcial = 'Evaluación';
      var mp = PARCIAL.exec(medio);
      if (mp) { curso = mp[1]; parcial = mp[2].toUpperCase().replace(/\s+/g, ' '); }

      filas.push({
        curso: curso.trim(),
        parcial: parcial,
        tipo: tipoDe(parcial),
        fase: parseInt(m[3], 10),
        grupo: m[4].toUpperCase(),
        nota: numero(m[5]),
        peso: parseFloat(m[6].replace(',', '.')),
        ausente: /^S/i.test(m[7])
      });
    }

    // Agrupa por curso + grupo, respetando el orden en que aparecen.
    var cursos = [];
    var indice = {};
    filas.forEach(function (f) {
      var clave = f.curso + '|' + f.grupo;
      if (!(clave in indice)) {
        indice[clave] = cursos.length;
        cursos.push({ id: clave, nombre: titulo(f.curso), grupo: f.grupo, evaluaciones: [] });
      }
      cursos[indice[clave]].evaluaciones.push({
        id: f.tipo + f.fase,
        tipo: f.tipo,
        fase: f.fase,
        nombre: (f.tipo === 'EC' ? 'Eval. continua ' : f.tipo === 'EX' ? 'Examen ' : titulo(f.parcial) + ' ') + f.fase,
        nota: f.ausente && f.nota === null ? 0 : f.nota,
        peso: f.peso,
        ausente: f.ausente,
        publicada: true
      });
    });

    cursos.forEach(completarPendientes);
    return { periodo: periodo, cui: cui, cursos: cursos };
  }

  /*
   * La extranet solo muestra lo ya publicado. Lo único seguro sobre el resto es
   * cuánto pesa en total (100 % menos lo publicado), así que va como un solo bloque
   * "Por calificar", sin inventar cómo se reparte.
   */
  function completarPendientes(curso) {
    var usado = curso.evaluaciones.reduce(function (s, e) { return s + e.peso; }, 0);
    var resto = Math.round((100 - usado) * 100) / 100;
    if (resto <= 0.01) return;
    curso.evaluaciones.push({
      id: 'RESTO', tipo: 'RESTO', fase: 99, nombre: 'Por calificar',
      nota: null, peso: resto, ausente: false, publicada: false
    });
  }

  // ---------- probabilidad de aprobar ----------
  // Función de distribución normal estándar (aproximación de Abramowitz y Stegun 7.1.26).
  function phi(x) {
    var z = Math.abs(x) / Math.SQRT2;
    var t = 1 / (1 + 0.3275911 * z);
    var erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  /*
   * Cuánto varían las notas del alumno: desviación de cada nota respecto al promedio
   * de su curso, juntando todos los cursos. Se limita entre 2 y 5 puntos para que
   * pocas notas no den resultados extremos.
   */
  function dispersion(cursos) {
    var suma = 0, n = 0, grupos = 0;
    cursos.forEach(function (c) {
      var notas = c.evaluaciones.filter(function (e) { return e.nota != null; }).map(function (e) { return e.nota; });
      if (!notas.length) return;
      var media = notas.reduce(function (s, x) { return s + x; }, 0) / notas.length;
      notas.forEach(function (x) { suma += (x - media) * (x - media); });
      n += notas.length;
      grupos++;
    });
    var gl = n - grupos;
    var sd = gl >= 1 ? Math.sqrt(suma / gl) : 3;
    return Math.max(2, Math.min(5, sd));
  }

  /*
   * Probabilidad de sacar al menos `necesita` de promedio en lo que falta, si esas notas
   * siguen una normal con media `media` (tu promedio en el curso) y desviación `sd`,
   * recortada a la escala 0–20.
   */
  function probAprobar(necesita, media, sd) {
    if (necesita == null) return null;
    if (necesita <= 0) return 1;
    if (necesita > 20) return 0;
    var a = phi((0 - media) / sd), b = phi((20 - media) / sd), c = phi((necesita - media) / sd);
    return Math.max(0, Math.min(1, (b - c) / (b - a)));
  }

  /*
   * Cálculo de un curso.
   * supuestos: { idEvaluacion: nota que el alumno se imagina sacar }
   * pesos:     { idEvaluacion: peso corregido por el alumno }
   */
  function calcular(curso, meta, supuestos, pesos) {
    supuestos = supuestos || {};
    pesos = pesos || {};
    var acumulado = 0, pesoNotas = 0, pesoTotal = 0;
    var supuesto = 0, pesoSupuesto = 0, pesoLibre = 0;

    curso.evaluaciones.forEach(function (e) {
      var w = e.publicada ? e.peso : (pesos[e.id] != null ? pesos[e.id] : e.peso);
      pesoTotal += w;
      if (e.nota != null) {
        acumulado += e.nota * w / 100;
        pesoNotas += w;
      } else if (supuestos[e.id] != null) {
        supuesto += supuestos[e.id] * w / 100;
        pesoSupuesto += w;
      } else {
        pesoLibre += w;
      }
    });

    var promedio = pesoNotas > 0 ? acumulado / (pesoNotas / 100) : null;
    var base = acumulado + supuesto;
    var necesita = pesoLibre > 0 ? (meta - base) / (pesoLibre / 100) : null;
    var final = pesoLibre > 0
      ? (promedio != null ? base + promedio * pesoLibre / 100 : null)
      : base;

    var estado;
    if (pesoLibre <= 0.001) estado = base >= meta ? 'aprobado' : 'desaprobado';
    else if (necesita <= 0) estado = 'asegurado';
    else if (necesita > 20) estado = 'imposible';
    else if (necesita > 15) estado = 'dificil';
    else if (necesita > 11 || (promedio != null && necesita > promedio)) estado = 'atento';
    else estado = 'tranquilo';

    return {
      acumulado: acumulado,
      pesoNotas: pesoNotas,
      pesoTotal: pesoTotal,
      promedio: promedio,
      supuesto: supuesto,
      pesoSupuesto: pesoSupuesto,
      pesoLibre: pesoLibre,
      necesita: necesita,
      final: final,
      estado: estado
    };
  }

  var api = { parsear: parsear, calcular: calcular, dispersion: dispersion, probAprobar: probAprobar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NotasParser = api;
})(this);
