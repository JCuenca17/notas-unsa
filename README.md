# Mis Notas UNSA

**https://jcuenca17.github.io/notas-unsa/**

Calculadora no oficial de notas parciales para alumnos de la UNSA. Lee la tabla de
«Consulta de Notas Parciales» de la extranet y muestra, por curso, la nota acumulada,
el mínimo que necesitas en lo que falta y la probabilidad de aprobar.

- **No pide usuario ni clave.** El alumno entra a la extranet como siempre y trae sus notas
  con un botón de favoritos, copiando y pegando, o con Ctrl + V sobre la página.
- **Sin servidor.** Todo es HTML/CSS/JS estático; las notas y los porcentajes del sílabo se
  guardan solo en el `localStorage` del navegador del alumno.
- **Instalable (PWA).** Se instala desde Chrome, Edge o Android con «Instalar app», y en
  iPhone con Compartir → Agregar a inicio. Abre sin conexión.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Página |
| `styles.css` | Estilos (tema claro por defecto y oscuro con botón) |
| `parser.js` | Lee el texto de la extranet y calcula (también se usa en Node para las pruebas) |
| `app.js` | Interfaz, botón de favoritos, porcentajes pendientes, guardado local, instalación |
| `manifest.webmanifest`, `icons/` | Datos e íconos para instalar la app |
| `sw.js` | Service worker: guarda la app para que abra sin conexión |
| `favicon.svg` | Ícono de la pestaña |
| `test/parser.test.js` | Pruebas: `node test/parser.test.js` |

## Probar en local

```bash
python -m http.server 8765
# abrir http://localhost:8765
```

## Publicar cambios

GitHub Pages publica la rama `main` desde la raíz. Antes de subir cambios, **sube `VERSION`
en `sw.js`** (por ejemplo `mis-notas-v2`) para que quienes tienen la app instalada reciban
la versión nueva.

El botón de favoritos se genera con la dirección donde está publicada la página; si cambia
el dominio, hay que arrastrarlo de nuevo.

## Cómo calcula

- Nota acumulada = Σ nota × peso de lo publicado.
- Lo que falta = 100 % − pesos publicados. Se propone repartido en enteros (de 5 en 5 si se
  puede) entre las evaluaciones que aún no aparecen, hasta el 3.er parcial; el alumno lo
  corrige con su sílabo.
- Mínimo = (meta − acumulado − notas simuladas) ÷ peso sin nota, redondeado hacia arriba.
- Probabilidad de aprobar = P(promedio en lo que falta ≥ mínimo), con una normal recortada
  a 0–20: media = promedio del alumno en el curso, desviación = variación de sus notas
  respecto al promedio de cada curso (todos sus cursos juntos), limitada a 2–5 puntos.
- Meta por defecto: 10,5 (se redondea a 11).
