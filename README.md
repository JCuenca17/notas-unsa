# Mis Notas UNSA

Calculadora no oficial de notas parciales para alumnos de la UNSA. Lee la tabla de
«Consulta de Notas Parciales» de la extranet y dice, por curso, cuánto necesitas en lo
que falta para aprobar.

- **No pide usuario ni clave.** El alumno entra a la extranet como siempre y trae sus notas
  con un botón de favoritos o copiando y pegando la página.
- **Sin servidor.** Todo es HTML/CSS/JS estático; las notas se guardan solo en el
  `localStorage` del navegador del alumno.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Página |
| `styles.css` | Estilos (tema claro por defecto y oscuro con botón) |
| `favicon.svg` | Ícono de la página |
| `parser.js` | Lee el texto de la extranet y calcula (también se usa en Node para las pruebas) |
| `app.js` | Interfaz, botón de favoritos, guardado local |
| `test/parser.test.js` | Pruebas: `node test/parser.test.js` |

## Probar en local

```bash
python -m http.server 8765
# abrir http://localhost:8765
```

El botón de favoritos se genera con la dirección donde está publicada la página, así que
hay que arrastrarlo de nuevo si cambia el dominio.

## Publicar

Cualquier hosting estático sirve (GitHub Pages, Vercel, Netlify). En GitHub Pages:
Settings → Pages → Deploy from branch → `main` / raíz.

## Cómo calcula

- Acumulado = Σ nota × peso.
- Por calificar = 100 % − pesos publicados, como un solo bloque (no se inventa el reparto).
- Mínimo = (meta − acumulado) ÷ peso por calificar, redondeado hacia arriba.
- Probabilidad de aprobar = P(promedio en lo que falta ≥ mínimo), con una normal recortada
  a 0–20: media = promedio del alumno en el curso, desviación = variación de sus notas
  respecto al promedio de cada curso (todos sus cursos juntos), limitada a 2–5 puntos.
- Meta por defecto: 10,5 (se redondea a 11).
