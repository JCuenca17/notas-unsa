(function () {
  'use strict';

  var P = window.NotasParser;
  var CLAVE_TEMA = 'notasUnsa.tema';
  var EXTRANET = 'extranet.unsa.edu.pe';

  /*
   * Acciones contadas con Vercel Web Analytics (plan gratis): cada acción se registra como
   * una visita a una página interna, p. ej. /accion/notas-cargadas-boton.
   * Solo nombres fijos; nunca notas, CUI ni nombres. En local no se cuenta nada.
   */
  function contar(accion) {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
    if (typeof window.va !== 'function') return;
    var ruta = '/accion/' + accion;
    try { window.va('pageview', { route: ruta, path: ruta }); } catch (e) { /* nada */ }
  }

  // Notas inventadas para que la página no se vea vacía la primera vez.
  var EJEMPLO = [
    'Periodo: 2026-B',
    '1. ESTRUCTURAS DE DATOS EVAL. CONTINUA 1 A 14 15% No',
    '2. ESTRUCTURAS DE DATOS EXAMEN 1 A 09 15% No',
    '3. ESTRUCTURAS DE DATOS EVAL. CONTINUA 2 A 12 15% No',
    '4. CALCULO INTEGRAL EVAL. CONTINUA 1 B 17 10% No',
    '5. CALCULO INTEGRAL EXAMEN 1 B 15 20% No',
    '6. COMUNICACION INTEGRAL EVAL. CONTINUA 1 A 08 10% No',
    '7. COMUNICACION INTEGRAL EXAMEN 1 A 06 10% Si'
  ].join('\n');

  var $ = function (id) { return document.getElementById(id); };
  var esCel = window.matchMedia ? !window.matchMedia('(hover: hover) and (pointer: fine)').matches : false;
  document.documentElement.classList.toggle('es-cel', esCel);

  var datos = null;
  var esEjemplo = false;
  var abiertos = {}; // qué secciones plegables están abiertas en esta visita

  /*
   * Sesiones por alumno (CUI).
   * - La sesión activa vive en sessionStorage: se borra al cerrar la pestaña.
   * - Solo si el alumno marca "Recordarme en esta computadora" se guarda en localStorage,
   *   separado por CUI, para que en una PC compartida nadie herede datos de otro.
   */
  var K_SESION = 'notasUnsa.sesion';
  var K_PERFILES = 'notasUnsa.perfiles';
  var K_ULTIMO = 'notasUnsa.ultimo';
  var K_VIEJO = 'notasUnsa.v1';

  function leer(store, k) { try { return JSON.parse(store.getItem(k) || 'null'); } catch (e) { return null; } }
  function escribir(store, k, v) {
    try { if (v == null) store.removeItem(k); else store.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
  }
  function nuevo(cui) { return { cui: cui || null, texto: '', meta: 10.5, supuestos: {}, pendientes: {} }; }
  function normal(s) { s.supuestos = s.supuestos || {}; s.pendientes = s.pendientes || {}; if (s.meta == null) s.meta = 10.5; return s; }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function perfiles() { return leer(localStorage, K_PERFILES) || {}; }
  function cuiDe(texto) { var m = /CUI:?\s*(\d{6,12})/i.exec(texto || ''); return m ? m[1] : null; }
  // Solo se guardan las filas de notas y el periodo; nunca el nombre del alumno.
  function limpiar(texto) {
    return String(texto || '').split(/\r?\n/).filter(function (l) { return /^\s*\d+\.\s|Periodo/i.test(l); }).join('\n');
  }

  var recordado = false;
  var fuente = null; // cómo llegaron las notas en esta visita: boton, boton-viejo o pegado

  function cargar() {
    // Datos de la versión anterior (un solo alumno): pasan a su perfil si traen CUI.
    var viejo = leer(localStorage, K_VIEJO);
    if (viejo && viejo.texto) {
      var cv = cuiDe(viejo.texto);
      var ps = perfiles();
      if (cv && !ps[cv]) {
        var m = normal(viejo); m.cui = cv; m.texto = limpiar(m.texto);
        ps[cv] = m; escribir(localStorage, K_PERFILES, ps); escribir(localStorage, K_ULTIMO, cv);
      } else if (!cv && !leer(sessionStorage, K_SESION)) {
        var t = normal(viejo); t.cui = null; t.texto = limpiar(t.texto);
        escribir(sessionStorage, K_SESION, t);
      }
    }
    escribir(localStorage, K_VIEJO, null);

    var ses = leer(sessionStorage, K_SESION);
    var ps2 = perfiles();
    if (ses && ses.cui !== undefined) { recordado = !!(ses.cui && ps2[ses.cui]); return normal(ses); }
    var ult = leer(localStorage, K_ULTIMO);
    if (ult && ps2[ult]) { recordado = true; var p = normal(copia(ps2[ult])); p.cui = ult; return p; }
    recordado = false;
    return nuevo(null);
  }

  function guardar() {
    escribir(sessionStorage, K_SESION, estado);
    if (recordado && estado.cui) {
      var ps = perfiles();
      ps[estado.cui] = estado;
      escribir(localStorage, K_PERFILES, ps);
      escribir(localStorage, K_ULTIMO, estado.cui);
    }
  }

  function recordar(si) {
    recordado = !!si && !!estado.cui;
    if (recordado) guardar();
    else if (estado.cui) {
      var ps = perfiles();
      delete ps[estado.cui];
      escribir(localStorage, K_PERFILES, Object.keys(ps).length ? ps : null);
      if (leer(localStorage, K_ULTIMO) === estado.cui) escribir(localStorage, K_ULTIMO, null);
    }
  }

  // Cambia de alumno al traer notas de otro CUI: nunca hereda datos ajenos.
  function abrirSesion(cui) {
    if (estado.cui === cui && estado.texto) return;
    var ps = perfiles();
    if (cui && ps[cui]) { estado = normal(copia(ps[cui])); estado.cui = cui; recordado = true; }
    else { estado = nuevo(cui); recordado = false; }
  }

  function salir() {
    if (estado.cui) recordar(false);
    escribir(sessionStorage, K_SESION, null);
    estado = nuevo(null);
    recordado = false;
  }

  var estado = cargar();

  // ---------- formato ----------
  function uno(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function entero(n) { return String(Math.ceil(n - 1e-9)); } // nota mínima en enteros, como en el acta
  function pct(n) { return String(Math.round(n * 10) / 10) + ' %'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function leerNum(v) {
    if (v === '' || v == null) return null;
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  function metaActual() { var m = leerNum(estado.meta); return m == null ? 10.5 : m; }

  var avisoT = null;
  function avisar(txt) {
    var t = $('toast');
    t.textContent = txt;
    t.hidden = false;
    clearTimeout(avisoT);
    avisoT = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- tema ----------
  function ponerTema(t) {
    document.documentElement.dataset.theme = t;
    var tc = document.querySelector('meta[name=theme-color]');
    if (tc) tc.setAttribute('content', t === 'dark' ? '#1b1f27' : '#ffffff');
    $('tema').textContent = t === 'dark' ? 'Claro' : 'Oscuro';
    $('tema').setAttribute('aria-label', t === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    try { localStorage.setItem(CLAVE_TEMA, t); } catch (e) { /* nada */ }
  }

  // ---------- botón de favoritos ----------
  function codigoMarcador() {
    var destino = location.origin + location.pathname;
    // Envía las filas de notas, el periodo y solo los dígitos del CUI (nunca el nombre).
    return 'javascript:(function(){var T=document.body.innerText,L=T.split(\'\\n\').filter(function(l){return /^\\s*\\d+\\.\\s|Periodo/i.test(l)});' +
      'var c=(T.match(/CUI:?\\s*(\\d{6,12})/i)||[])[1];if(c)L.unshift(\'CUI: \'+c);' +
      'if(!L.some(function(l){return /%/.test(l)})){alert(\'Primero entra a tus Notas Parciales en la extranet de la UNSA y luego usa Mis Notas.\');return}' +
      'location.href=\'' + destino + '#n2=\'+encodeURIComponent(L.join(\'\\n\'))})();';
  }

  // ---------- probabilidad ----------
  function probTexto(p) {
    if (p >= 0.995) return 'más de 99 %';
    if (p <= 0.005) return 'menos de 1 %';
    return Math.round(p * 100) + ' %';
  }
  function probNivel(p) {
    if (p >= 0.85) return { clase: 'ok', txt: 'muy probable' };
    if (p >= 0.6) return { clase: 'ok', txt: 'probable' };
    if (p >= 0.35) return { clase: 'ojo', txt: 'incierto' };
    return { clase: 'mal', txt: 'poco probable' };
  }

  // ---------- tu sílabo: lo que falta ----------
  // Reparte en enteros, de 5 en 5 cuando se puede. Lo que sobra va a las últimas.
  function repartir(total, n) {
    total = Math.round(total);
    if (n <= 0) return [];
    var paso = (total % 5 === 0 && total / n >= 5) ? 5 : 1;
    var unidades = Math.round(total / paso);
    var base = Math.floor(unidades / n), extra = unidades - base * n;
    var out = [];
    for (var i = 0; i < n; i++) out.push((base + (i >= n - extra ? 1 : 0)) * paso);
    return out;
  }

  function restoDe(c) {
    var r = c.evaluaciones.filter(function (e) { return e.id === 'RESTO'; })[0];
    return r ? r.peso : 0;
  }
  function publicadasDe(c) {
    var ids = {};
    c.evaluaciones.forEach(function (e) { if (e.publicada) ids[e.id] = 1; });
    return ids;
  }

  // Propuesta inicial: lo que aún no aparece, hasta el 3.er parcial.
  function propuesta(c) {
    var tipos = {}, maxFase = 0, hay = publicadasDe(c);
    c.evaluaciones.forEach(function (e) {
      if (!e.publicada) return;
      if (e.tipo === 'EC' || e.tipo === 'EX') tipos[e.tipo] = 1;
      if (e.fase > maxFase) maxFase = e.fase;
    });
    var lista = [];
    var orden = Object.keys(tipos).sort();
    for (var f = 1; f <= Math.max(3, maxFase); f++) {
      orden.forEach(function (t) {
        if (!hay[t + f]) lista.push({ clave: t + f, nombre: (t === 'EC' ? 'Continua ' : 'Examen ') + f, peso: 0, nota: null });
      });
    }
    if (!lista.length && restoDe(c) > 0.01) lista.push({ nombre: 'Evaluación pendiente', peso: 0, nota: null });
    var partes = repartir(restoDe(c), lista.length);
    lista.forEach(function (p, i) { p.peso = partes[i]; });
    return lista;
  }

  /*
   * Lo guardado del sílabo se respeta entre visitas. Si la extranet ya publicó una
   * evaluación que estaba como pendiente (misma clave, p. ej. "EX3"), esa fila se quita sola.
   */
  function listaDe(c) {
    var guardada = estado.pendientes[c.id];
    if (!guardada) return propuesta(c);
    var hay = publicadasDe(c);
    var vigente = guardada.filter(function (p) { return !(p.clave && hay[p.clave]); });
    if (vigente.length !== guardada.length) { estado.pendientes[c.id] = vigente; guardar(); }
    return vigente;
  }

  function armarCurso(c) {
    var resto = restoDe(c);
    var lista = resto > 0.01 ? listaDe(c) : [];
    // Datos de versiones anteriores pueden traer porcentajes vacíos.
    var vacios = lista.filter(function (p) { return p.peso == null; }).length;
    if (vacios) {
      var usado = lista.reduce(function (s, p) { return s + (p.peso || 0); }, 0);
      var partes = repartir(Math.max(0, resto - usado), vacios), k = 0;
      lista.forEach(function (p) { if (p.peso == null) p.peso = partes[k++]; });
    }

    var sup = {}, suma = 0;
    var evs = c.evaluaciones.filter(function (e) { return e.publicada; });
    var filas = lista.map(function (p, i) {
      var nombre = p.nombre || ('Nota ' + (i + 1));
      suma += p.peso;
      if (p.peso > 0) {
        evs.push({ id: 'P' + i, nombre: nombre, nota: null, peso: p.peso, publicada: false });
        if (p.nota != null) sup['P' + i] = p.nota;
      }
      return { nombre: nombre, peso: p.peso, nota: p.nota };
    });
    // Si el sílabo no cubre todo lo que falta, ese resto igual cuenta como pendiente.
    if (resto - suma > 0.01) evs.push({ id: 'RESTO', nombre: 'Sin asignar', nota: null, peso: resto - suma, publicada: false });

    return {
      curso: { id: c.id, nombre: c.nombre, grupo: c.grupo, evaluaciones: evs },
      sup: sup, resto: resto, suma: suma, filas: filas, guardado: !!estado.pendientes[c.id]
    };
  }

  // ---------- dibujar ----------
  function render() {
    var meta = metaActual();
    $('banner').hidden = !esEjemplo;
    pintarSesion();
    pintarGuardados();

    var cursos = datos ? datos.cursos : [];
    var sd = P.dispersion(cursos);
    var res = cursos.map(function (c) {
      var a = armarCurso(c);
      return { a: a, r: P.calcular(a.curso, meta, a.sup) };
    });
    var conNota = res.filter(function (x) { return x.r.promedio != null; });
    var general = conNota.length ? conNota.reduce(function (s, x) { return s + x.r.promedio; }, 0) / conNota.length : 12;

    var cuenta = { enCurso: 0, arriba: 0, asegurados: 0 };
    $('cursos').innerHTML = res.map(function (x) {
      var r = x.r;
      var cerrado = r.pesoLibre <= 0.001 && r.pesoSupuesto <= 0.001;
      if (!cerrado) {
        cuenta.enCurso++;
        if (r.estado === 'asegurado') cuenta.asegurados++;
        if (r.promedio != null && r.promedio >= meta) cuenta.arriba++;
      }
      var prob = r.pesoLibre > 0 ? P.probAprobar(r.necesita, r.promedio != null ? r.promedio : general, sd) : null;
      return tarjeta(x.a, r, meta, prob, cerrado);
    }).join('');

    if (!cursos.length) { $('resumen').innerHTML = ''; return; }
    var partes = [];
    if (cuenta.enCurso) {
      partes.push(cuenta.enCurso === cursos.length ? 'Ningún curso está cerrado todavía.' : cuenta.enCurso + ' de ' + cursos.length + ' cursos siguen en curso.');
      partes.push('Tu promedio en lo calificado supera ' + uno(meta) + ' en ' + cuenta.arriba + ' de ' + cuenta.enCurso + '.');
    }
    if (cuenta.asegurados) partes.push(cuenta.asegurados === 1 ? 'Ya aseguraste 1.' : 'Ya aseguraste ' + cuenta.asegurados + '.');
    $('resumen').innerHTML =
      '<h1>' + (datos.periodo ? 'Semestre ' + esc(datos.periodo) : 'Tus cursos') + '</h1>' +
      '<p>' + partes.join(' ') + '</p>';
  }

  // Lo que necesitas, en un solo lugar de la tarjeta. Cuenta las notas que escribiste.
  function necesitas(r, meta, prob, cerrado) {
    var total = r.acumulado + r.supuesto;
    var simulado = r.pesoSupuesto > 0;

    if (cerrado) return '';
    if (r.pesoLibre <= 0.001) {
      var acta = Math.round(total);
      var ok = total >= meta;
      return '<div class="necesitas ' + (ok ? 'ok' : 'mal') + '">' +
        '<p class="nec-t">Con las notas que escribiste terminas con <b>' + acta + '</b>.</p>' +
        '<p class="nec-s">' + (ok ? 'Apruebas el curso.' : 'No llegas a ' + uno(meta) + '.') + ' Tu nota exacta sería ' + uno(total) + '.</p></div>';
    }
    if (r.estado === 'asegurado') {
      return '<div class="necesitas ok"><p class="nec-t">Ya aprobaste: aunque saques <b>0</b> en lo que falta, llegas a ' + uno(meta) + '.</p></div>';
    }
    var donde = simulado ? 'en lo que dejaste sin nota (' + pct(r.pesoLibre) + ')' : 'en lo que falta (' + pct(r.pesoLibre) + ')';
    if (r.estado === 'imposible') {
      return '<div class="necesitas mal"><p class="nec-t">Necesitarías <b>' + entero(r.necesita) + '</b> ' + donde + '.</p>' +
        '<p class="nec-s">Es más de 20. Consulta por el examen sustitutorio.</p></div>';
    }
    var nivel = probNivel(prob);
    return '<div class="necesitas ' + nivel.clase + '">' +
      '<p class="nec-t">Necesitas mínimo <b>' + entero(r.necesita) + '</b> de promedio ' + donde + '.</p>' +
      (simulado ? '<p class="nec-s">Ya cuenta las notas que escribiste: sumas ' + uno(r.supuesto) + ' a los ' + uno(r.acumulado) + ' que tienes.</p>' : '') +
      '<div class="prob"><div class="prob-cab"><span>Probabilidad de aprobar</span><b>' + probTexto(prob) + '</b></div>' +
      '<div class="prob-barra"><span style="width:' + Math.round(prob * 100) + '%"></span></div><p class="nec-s">' + nivel.txt.charAt(0).toUpperCase() + nivel.txt.slice(1) + ' si sigues como vas.</p></div>' +
      '</div>';
  }

  function silabo(c, x) {
    var cid = esc(c.id);
    var filas = x.filas.map(function (p, i) {
      var base = 'data-curso="' + cid + '" data-i="' + i + '"';
      return '<tr><td><input class="in-nombre" type="text" autocomplete="off" spellcheck="false" id="pnm-' + cid + '-' + i + '" ' + base + ' data-accion="nombre" value="' + esc(p.nombre) + '" aria-label="Nombre de la evaluación ' + (i + 1) + '"></td>' +
        '<td class="der"><span class="campo-pct"><input type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]*" id="pp-' + cid + '-' + i + '" ' + base + ' data-accion="peso" value="' + p.peso + '" aria-label="Cuánto vale ' + esc(p.nombre) + ', en porcentaje">%</span></td>' +
        '<td class="der"><input type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]*" placeholder="—" id="pn-' + cid + '-' + i + '" ' + base + ' data-accion="nota" value="' + (p.nota != null ? p.nota : '') + '" aria-label="Nota que esperas en ' + esc(p.nombre) + '"></td>' +
        '<td class="der"><button type="button" class="quitar" ' + base + ' data-accion="quitar" aria-label="Quitar ' + esc(p.nombre) + '" title="Quitar">×</button></td></tr>';
    }).join('');

    var dif = Math.round(x.suma - x.resto);
    var cuadre = dif !== 0
      ? '<div class="cuadre"><p>Tus porcentajes suman ' + pct(x.suma) + ' y lo que falta es ' + pct(x.resto) + '. ' +
        (dif > 0 ? 'Te pasaste por ' + pct(dif) + '.' : 'Te falta asignar ' + pct(-dif) + '.') + '</p>' +
        '<button type="button" class="btn btn-sec btn-chico" data-curso="' + cid + '" data-accion="repartir">Repartir en partes iguales</button></div>'
      : '';

    var clave = 'sil-' + c.id;
    return '<details class="plegable" data-plegable="' + esc(clave) + '"' + (abiertos[clave] ? ' open' : '') + '>' +
      '<summary>Lo que falta calificar <small>' + pct(x.resto) + '</small></summary>' +
      '<div class="plegable-cuerpo">' +
        '<div class="silabo-cab"><p>¿Cuántas notas faltan?</p>' +
          '<div class="contador" role="group" aria-label="Cantidad de notas que faltan">' +
            '<button type="button" data-curso="' + cid + '" data-accion="menos" aria-label="Una nota menos">−</button>' +
            '<span>' + x.filas.length + (x.filas.length === 1 ? ' nota' : ' notas') + '</span>' +
            '<button type="button" data-curso="' + cid + '" data-accion="mas" aria-label="Una nota más">+</button>' +
          '</div></div>' +
        (x.filas.length
          ? '<table class="t-silabo"><colgroup><col><col class="c-vale"><col class="c-nota"><col class="c-x"></colgroup>' +
            '<thead><tr><th>Evaluación</th><th class="der">Vale</th><th class="der">Tu nota</th><th></th></tr></thead><tbody>' + filas + '</tbody></table>'
          : '') +
        cuadre +
        '<p class="ayuda">' + (x.guardado
          ? 'Se guarda en este dispositivo. Cuando la extranet publique una de estas notas, su fila se quita sola.'
          : 'Es una propuesta. Corrige los porcentajes con tu sílabo; se guardan para la próxima vez. La nota es opcional: escríbela para simular.') + '</p>' +
        (x.guardado ? '<button type="button" class="btn-texto reiniciar" data-curso="' + cid + '" data-accion="reiniciar">Volver a la propuesta inicial</button>' : '') +
      '</div></details>';
  }

  function publicadas(c, meta) {
    var lista = c.evaluaciones.filter(function (e) { return e.publicada; });
    var filas = lista.map(function (e) {
      var clase = e.nota == null ? '' : (e.nota >= meta ? 'n-aprob' : 'n-desap');
      var nota = e.nota == null ? 'sin nota' : (e.nota % 1 ? uno(e.nota) : String(e.nota)) + (e.ausente ? '<span class="aus">ausente</span>' : '');
      return '<tr><td>' + esc(e.nombre) + '</td><td class="der">' + pct(e.peso) + '</td><td class="der ' + clase + '">' + nota + '</td></tr>';
    }).join('');
    var clave = 'pub-' + c.id;
    return '<details class="plegable" data-plegable="' + esc(clave) + '"' + (abiertos[clave] ? ' open' : '') + '>' +
      '<summary>Notas publicadas <small>' + lista.length + '</small></summary>' +
      '<div class="plegable-cuerpo"><table><thead><tr><th>Evaluación</th><th class="der">Vale</th><th class="der">Nota</th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
      '</details>';
  }

  function tarjeta(x, r, meta, prob, cerrado) {
    var c = x.curso;
    var pos = function (v) { return Math.max(0, Math.min(100, v / 20 * 100)); };
    var final = r.acumulado + r.supuesto;
    var tono = cerrado ? (final >= meta ? 'aprob' : 'desap')
      : r.estado === 'asegurado' ? 'aprob'
      : r.estado === 'imposible' ? 'desap'
      : 'neutro';

    var etiqueta = 'En curso', claseEt = '';
    if (cerrado) { etiqueta = final >= meta ? 'Cerrado, aprobado' : 'Cerrado, desaprobado'; claseEt = final >= meta ? 'et-ok' : 'et-mal'; }
    else if (r.estado === 'asegurado') { etiqueta = 'Aprobado asegurado'; claseEt = 'et-ok'; }
    else if (r.estado === 'imposible') { etiqueta = 'Ya no alcanza'; claseEt = 'et-mal'; }

    var txtNota = r.promedio == null ? 'Todavía no hay notas publicadas.'
      : cerrado ? 'Nota final del curso.'
      : 'Llevas esto con el ' + pct(r.pesoNotas) + ' calificado. Tu promedio en esas notas es ' + uno(r.promedio) + '.';

    var faltaTodo = x.resto;
    var maximo = r.acumulado + 20 * faltaTodo / 100;
    var regla = '<div class="regla" role="img" aria-label="Llevas ' + uno(r.acumulado) + ' de 20; como máximo puedes llegar a ' + uno(maximo) + '; para aprobar ' + uno(meta) + '">' +
      '<div class="regla-linea"></div><div class="regla-ticks"></div>' +
      (faltaTodo > 0 ? '<div class="regla-max" style="left:' + pos(r.acumulado) + '%;width:' + (pos(maximo) - pos(r.acumulado)) + '%"></div>' : '') +
      '<div class="regla-lleva" style="width:' + pos(r.acumulado) + '%"></div>' +
      '<div class="regla-aprob" style="left:calc(' + pos(meta) + '% - 1px)"><span>aprueba ' + uno(meta) + '</span></div>' +
      '</div><div class="regla-ext"><span>0</span><span>20</span></div>';

    return '<article class="curso ' + tono + '">' +
      '<div class="curso-cab"><h3 class="curso-nombre">' + esc(c.nombre) + '</h3><span class="etiqueta ' + claseEt + '">' + etiqueta + '</span></div>' +
      '<div><div class="nota"><span class="nota-num">' + uno(r.acumulado) + '</span><span class="nota-de">/ 20</span></div>' +
      '<p class="nota-txt">' + txtNota + '</p></div>' +
      regla +
      necesitas(r, meta, prob, cerrado) +
      (x.resto > 0.01 ? silabo(c, x) : '') +
      publicadas(datos.cursos.filter(function (o) { return o.id === c.id; })[0], meta) +
      '</article>';
  }

  // ---------- cargar notas ----------
  function usarTexto(texto, guardarlo) {
    var d = P.parsear(texto);
    if (!d.cursos.length) return false;
    datos = d;
    esEjemplo = false;
    if (guardarlo) {
      // Notas de otro CUI abren otra sesión. Sin CUI no se sabe de quién son: sesión nueva.
      if (d.cui) abrirSesion(d.cui);
      else if (estado.cui) { estado = nuevo(null); recordado = false; }
      var limpio = limpiar(texto);
      if (estado.texto !== limpio) estado.supuestos = {};
      estado.texto = limpio;
      guardar();
    }
    return true;
  }

  // Barra de sesión: de quién son las notas, recordar o no, y salir.
  function pintarSesion() {
    var el = $('sesion');
    el.hidden = esEjemplo;
    if (esEjemplo) return;
    var quien = estado.cui ? 'CUI <b>' + esc(estado.cui) + '</b>' : '<b>sin CUI</b>';
    el.innerHTML =
      '<p class="ses-quien">Sesión de ' + quien + '</p>' +
      '<label class="ses-recordar" for="recordar"><input type="checkbox" id="recordar"' + (recordado ? ' checked' : '') + (estado.cui ? '' : ' disabled') + '> Recordarme en esta computadora</label>' +
      '<button type="button" id="salir" class="btn btn-sec btn-chico">Salir y borrar</button>' +
      '<p class="ses-ayuda">' + (!estado.cui
        ? (fuente === 'boton-viejo'
            ? 'Usaste un botón «Mis Notas» antiguo, que no envía tu CUI. Bórralo de tu barra (clic derecho, Eliminar), recarga esta página y vuelve a arrastrar el botón desde «Actualizar notas».'
            : 'No encontramos tu CUI. Copia la página de notas completa (Ctrl + A) para que incluya la línea «CUI», y vuelve a pegarla.')
        : recordado
          ? 'Tus notas y porcentajes se guardan en esta computadora, separados de los de otros alumnos.'
          : 'No se guarda nada: al cerrar la pestaña o tocar «Salir y borrar» se borra todo. Si es tu computadora, marca «Recordarme».') + '</p>';
  }

  function pintarGuardados() {
    var ps = perfiles();
    var otros = Object.keys(ps).filter(function (k) { return k !== estado.cui; });
    var el = $('guardados');
    el.hidden = !otros.length;
    el.innerHTML = otros.length
      ? '<p>Alumnos recordados en esta computadora:</p>' + otros.map(function (k) {
          return '<button type="button" class="btn btn-sec btn-chico" data-abrir="' + esc(k) + '">Abrir CUI ' + esc(k) + '</button>';
        }).join('')
      : '';
  }

  function mostrarCarga(si) {
    $('carga').hidden = !si;
    var b = $('abrirCarga');
    b.setAttribute('aria-expanded', String(si));
    b.textContent = si ? 'Cerrar instrucciones' : 'Actualizar notas';
    if (si) $('carga').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cargado() {
    mostrarCarga(false);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    avisar(recordado ? 'Notas cargadas. Tus porcentajes guardados se mantuvieron.' : 'Notas cargadas. No se guardan en esta computadora.');
  }

  function desdeEnlace() {
    // #n2= lo envía el botón actual; #n= viene de un botón antiguo que no manda el CUI.
    var m = /^#n(2?)=(.+)$/.exec(location.hash);
    if (!m) return false;
    fuente = m[1] ? 'boton' : 'boton-viejo';
    var texto;
    try { texto = decodeURIComponent(m[2]); } catch (e) { return false; }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* nada */ }
    var ok = usarTexto(texto, true);
    if (ok) contar(fuente === 'boton' ? 'notas-cargadas-boton' : 'notas-cargadas-boton-antiguo');
    return ok;
  }

  // ---------- eventos ----------
  var marcador = $('marcador');
  marcador.href = codigoMarcador();
  marcador.addEventListener('click', function (ev) {
    ev.preventDefault();
    marcador.classList.remove('aviso');
    void marcador.offsetWidth;
    marcador.classList.add('aviso');
    $('pista').innerHTML = 'Este botón no se hace clic aquí: <b>arrástralo</b> hasta tu barra de favoritos.';
  });

  $('tema').onclick = function () { ponerTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); };
  $('abrirCarga').onclick = function () { mostrarCarga($('carga').hidden); };
  $('bannerCargar').onclick = function () { mostrarCarga(true); };

  $('leerPegado').onclick = function () {
    $('errorPegado').textContent = '';
    fuente = 'pegado';
    if (usarTexto($('pegado').value, true)) { $('pegado').value = ''; contar('notas-cargadas-pegado'); cargado(); }
    else $('errorPegado').textContent = 'Ese texto no tiene la tabla de notas. Copia toda la página de Notas Parciales y vuelve a pegarla.';
  };

  // Ctrl+V en cualquier parte de la página (menos dentro de una casilla).
  document.addEventListener('paste', function (ev) {
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || (t.tagName === 'TEXTAREA' && t.id !== 'pegado'))) return;
    var texto = ev.clipboardData && ev.clipboardData.getData('text');
    if (!texto) return;
    fuente = 'pegado';
    if (usarTexto(texto, true)) {
      ev.preventDefault();
      $('pegado').value = '';
      $('errorPegado').textContent = '';
      contar('notas-cargadas-pegado');
      cargado();
    } else if (t && t.id !== 'pegado') {
      avisar('Eso no parece tu página de notas. Copia toda la página de Notas Parciales.');
    }
  });

  $('meta').value = estado.meta;
  $('meta').addEventListener('input', function () {
    var v = leerNum($('meta').value);
    if (v == null || v < 0 || v > 20) return;
    estado.meta = v;
    guardar();
    render();
  });

  var cursosEl = $('cursos');
  cursosEl.addEventListener('toggle', function (ev) {
    var d = ev.target;
    if (d.dataset && d.dataset.plegable) abiertos[d.dataset.plegable] = d.open;
  }, true);

  function cursoPorId(cid) { return (datos ? datos.cursos : []).filter(function (x) { return x.id === cid; })[0]; }

  // Pasa la propuesta a datos guardados la primera vez que se toca.
  function listaEditable(cid) {
    if (!estado.pendientes[cid]) {
      var c = cursoPorId(cid);
      estado.pendientes[cid] = c ? listaDe(c).map(function (p) { return { clave: p.clave, nombre: p.nombre, peso: p.peso, nota: p.nota }; }) : [];
    }
    return estado.pendientes[cid];
  }
  function repartirLista(cid) {
    var c = cursoPorId(cid);
    var lista = estado.pendientes[cid] || [];
    var partes = repartir(c ? restoDe(c) : 0, lista.length);
    lista.forEach(function (p, i) { p.peso = partes[i]; });
  }

  // Redibuja sin perder la casilla en la que se escribe ni la posición del cursor.
  function redibujar() {
    var a = document.activeElement;
    var id = a && a.id, valor = a && a.value, cursor = null;
    try { cursor = a && a.selectionStart; } catch (e) { cursor = null; }
    render();
    var n = id && document.getElementById(id);
    if (n) {
      if (n.tagName === 'INPUT' && valor != null) n.value = valor;
      n.focus();
      if (cursor != null) { try { n.setSelectionRange(cursor, cursor); } catch (e) { /* nada */ } }
    }
  }

  // Se recalcula mientras se escribe, sin Enter.
  var espera = null;
  cursosEl.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t.dataset || !t.dataset.curso || !t.dataset.accion) return;
    var fila = listaEditable(t.dataset.curso)[+t.dataset.i];
    if (!fila) return;
    var accion = t.dataset.accion;
    if (accion === 'nombre') fila.nombre = t.value.slice(0, 40);
    else {
      var v = leerNum(t.value);
      if (accion === 'peso') fila.peso = v == null ? 0 : Math.max(0, Math.min(100, Math.round(v)));
      else fila.nota = v == null ? null : Math.max(0, Math.min(20, Math.round(v)));
    }
    guardar();
    clearTimeout(espera);
    espera = setTimeout(redibujar, 200);
  });

  // Botones: más, menos, quitar, repartir y volver a la propuesta.
  cursosEl.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button[data-accion]');
    if (!b) return;
    var c = b.dataset.curso, accion = b.dataset.accion;
    if (accion === 'reiniciar') {
      if (!confirmar(b, 'Sí, volver a la propuesta')) return;
      delete estado.pendientes[c];
    }
    else {
      var lista = listaEditable(c);
      if (accion === 'mas' && lista.length < 12) lista.push({ nombre: 'Nota ' + (lista.length + 1), peso: 0, nota: null });
      if (accion === 'menos' && lista.length) lista.pop();
      if (accion === 'quitar') lista.splice(+b.dataset.i, 1);
      // Al cambiar la cantidad, lo que falta se vuelve a repartir solo.
      repartirLista(c);
    }
    guardar();
    render();
  });

  // Primer clic pide confirmar; el segundo (antes de 4 s) ejecuta.
  function confirmar(b, txt) {
    if (b.dataset.confirmando) return true;
    var antes = b.textContent;
    b.dataset.confirmando = '1';
    b.textContent = txt;
    b.classList.add('confirmar');
    setTimeout(function () { if (document.body.contains(b)) { delete b.dataset.confirmando; b.textContent = antes; b.classList.remove('confirmar'); } }, 4000);
    return false;
  }

  function volverAlEjemplo() {
    $('meta').value = estado.meta;
    usarTexto(EJEMPLO, false);
    esEjemplo = true;
    render();
    mostrarCarga(true);
  }

  // Borra lo de TODOS los alumnos recordados en este navegador.
  $('borrar').onclick = function () {
    if (!confirmar($('borrar'), 'Sí, borrar todo')) return;
    escribir(localStorage, K_PERFILES, null);
    escribir(localStorage, K_ULTIMO, null);
    escribir(sessionStorage, K_SESION, null);
    estado = nuevo(null);
    recordado = false;
    volverAlEjemplo();
    avisar('Se borró todo lo guardado en esta computadora.');
  };

  // Barra de sesión: recordar y salir.
  $('sesion').addEventListener('change', function (ev) {
    if (ev.target.id !== 'recordar') return;
    recordar(ev.target.checked);
    if (recordado) contar('recordarme-activado');
    pintarSesion();
    avisar(recordado ? 'Listo: se recordará en esta computadora.' : 'Ya no se guarda en esta computadora.');
  });
  $('sesion').addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('#salir');
    if (!b || !confirmar(b, 'Sí, salir y borrar')) return;
    contar('salir-y-borrar');
    salir();
    volverAlEjemplo();
    avisar('Saliste. Tus datos se borraron de esta computadora.');
  });

  // Abrir a otro alumno recordado en esta computadora.
  $('guardados').addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-abrir]');
    if (!b) return;
    abrirSesion(b.dataset.abrir);
    if (usarTexto(estado.texto, false)) { guardar(); $('meta').value = estado.meta; cargado(); }
  });

  // Otra pestaña cambió lo recordado de este alumno: se actualiza aquí también.
  window.addEventListener('storage', function (ev) {
    if (ev.key !== K_PERFILES || !recordado || !estado.cui) return;
    var p = perfiles()[estado.cui];
    if (!p) { recordado = false; pintarSesion(); return; }
    estado = normal(copia(p));
    escribir(sessionStorage, K_SESION, estado);
    if (estado.texto) usarTexto(estado.texto, false);
    redibujar();
  });

  // ---------- instalar como app ----------
  var instalable = null;
  var enApp = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    instalable = ev;
    $('instalar').hidden = false;
  });
  $('instalar').onclick = function () {
    if (!instalable) return;
    instalable.prompt();
    instalable.userChoice.then(function (r) {
      if (r.outcome === 'accepted') avisar('Mis Notas se instaló en tu dispositivo.');
      instalable = null;
      $('instalar').hidden = true;
    });
  };
  window.addEventListener('appinstalled', function () { $('instalar').hidden = true; contar('app-instalada'); });

  // En iPhone no hay botón de instalar: se explica una vez cómo hacerlo.
  var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  var vistoIOS = false;
  try { vistoIOS = localStorage.getItem('notasUnsa.ios') === '1'; } catch (e) { /* nada */ }
  function mostrarIOS() { if (esIOS && !enApp && !vistoIOS) $('ios').hidden = false; }
  $('iosCerrar').onclick = function () {
    $('ios').hidden = true;
    vistoIOS = true;
    try { localStorage.setItem('notasUnsa.ios', '1'); } catch (e) { /* nada */ }
  };

  // Aviso de privacidad en la primera visita. No bloquea nada; se cierra con «Entendido».
  var vistoAviso = false;
  try { vistoAviso = localStorage.getItem('notasUnsa.aviso') === '1'; } catch (e) { /* nada */ }
  if (!vistoAviso) $('avisoPriv').hidden = false; else mostrarIOS();
  $('avisoOk').onclick = function () {
    $('avisoPriv').hidden = true;
    try { localStorage.setItem('notasUnsa.aviso', '1'); } catch (e) { /* nada */ }
    mostrarIOS();
  };

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo sin conexión */ }); });
  }

  // ---------- inicio ----------
  ponerTema(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  $('metodoFav').hidden = esCel;
  $('tituloCopiar').textContent = esCel ? 'Copia y pega tus notas' : '¿No funcionó el botón? Copia y pega';

  var mostrar = false;
  if (desdeEnlace()) {
    setTimeout(function () { avisar('Notas cargadas desde la extranet.'); }, 300);
  } else if (!(estado.texto && usarTexto(estado.texto, false))) {
    usarTexto(EJEMPLO, false);
    esEjemplo = true;
    mostrar = true;
  }
  render();
  $('carga').hidden = !mostrar;
  $('abrirCarga').setAttribute('aria-expanded', String(mostrar));
  $('abrirCarga').textContent = mostrar ? 'Cerrar instrucciones' : 'Actualizar notas';
})();
