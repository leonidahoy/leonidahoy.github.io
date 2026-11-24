# Tarea diaria: resumen de GTA VI

Instrucciones para el agente que publica cada mañana el resumen de **Leónida Hoy** (https://leonidahoy.github.io/, español en `/` e inglés en `/en/`).
El dueño del repositorio autoriza **commit y push directo a `main`** (así se publica la web). Nada de pull requests ni otras ramas.

**Cada ejecución es independiente:** no te bases en lo que recuerdes de ejecuciones anteriores (búsquedas, conclusiones o reglas). Las reglas y las noticias cambian: haz siempre todos los pasos con este documento recién leído.

**Ahorra cuota:** sin subagentes, sin leer archivos que aquí no se indican, máximo 6 búsquedas web para el resumen (más, por la mañana, las 2 de «Lo que se descubre del juego» y las 2 de clips, y las 2 de trucos los lunes), sin abrir páginas web salvo que una búsqueda no aclare un dato, respuestas cortas.

## Pasos

1. **Repo.** (Ambos modos.) Si ya tienes el repo en tu directorio de trabajo (la sesión dedicada lo trae), usa esa copia: `git checkout main && git pull --ff-only origin main`. Si no, llama a `add_repo` (owner `leonidahoy`, repo `leonidahoy.github.io`, access `push`). Si no la ves entre tus herramientas, búscala con ToolSearch (consulta `add_repo`) y llámala: sin ella el `git push` final falla. Si no hay copia local: `git clone --depth 20 https://github.com/leonidahoy/leonidahoy.github.io && cd leonidahoy.github.io`. Trabaja en `main`.
2. **Elige el modo.** `HOY=$(TZ=Europe/Madrid date +%F)`.
   - Si **no existe** `content/briefs/$HOY.json` → **modo MAÑANA**: crea el resumen del día (pasos 3–11).
   - Si **ya existe** → **modo TARDE** (ver sección «Modo TARDE» más abajo): añade solo lo nuevo de las últimas 12 horas.
3. **Qué se publicó ya.** Lee solo el JSON más reciente de `content/briefs/` (es la referencia del formato y del tono) y lista títulos anteriores: `grep -h '"title"' content/briefs/*.json | tail -60`.
4. **Busca.** Calcula las fechas en inglés: `HOY_EN=$(TZ=Europe/Madrid date +'%B %-d %Y')` y `AYER_EN=$(TZ=Europe/Madrid date -d yesterday +'%B %-d %Y')`. Lanza estas 4 en el mismo turno, en modo `extended` (las genéricas tipo «news today» devuelven páginas viejas):
   - `GTA 6 news $HOY_EN`
   - `GTA 6 news $AYER_EN`
   - `GTA 6 Rockstar update OR announcement OR trailer $AYER_EN`
   - `GTA 6 leak OR rumor OR insider November` (rumores)
   Con lo que encuentres, como mucho 2 búsquedas más (`standard`): una para confirmar el tema más fuerte y otra de rumores en español (`GTA 6 rumores filtración`). Fuentes que suelen tener la actualidad con fecha: Insider Gaming, VGC, IGN, GameSpot, Kotaku, Eurogamer, PC Gamer, Dexerto, VideoCardz, VGTimes, GamePro (directo), 3DJuegos, Vandal, Rockstar Newswire.
   **Objetivo: que la web tenga movimiento cada día.** Publica siempre que tengas al menos 1 noticia o 1 rumor nuevos para la web (ver «Qué cuenta como nuevo»). Solo si de verdad no hay nada nuevo, no publiques y explica qué buscaste.
5. **Escribe** `content/briefs/$HOY.json` siguiendo el esquema de abajo.
6. **Verifica:** `node scripts/check-brief.mjs content/briefs/$HOY.json`. Si da errores, corrige exactamente lo que dice y repite hasta que diga «✓ … listo». Los avisos «⚠» no bloquean, pero léelos.
7. **Construye:** `node scripts/build.mjs`. Debe decir `idiomas: es, en` y no `sin inglés`.
8. **Guía (rara vez):** solo si cambió un dato confirmado (fecha, precio, plataformas, PC, tamaño, FPS), actualiza `content/guide.json` y `content/guide.en.json` (y su `updated`), con fuente.
9. **Publica:** `git add content && git commit -m "Resumen GTA VI $HOY" && git push origin main`. Si da 403, vuelve a llamar a `add_repo` y reintenta; si persiste, dilo claramente. Si es error de red, reintenta hasta 4 veces esperando 2, 4, 8 y 16 s.
10. **Comprueba la publicación:** espera con un bucle `until` (máximo 4 min) a que `git fetch -q --depth 1 origin gh-pages && git log -1 --format=%s origin/gh-pages` muestre `Publicar <sha corto de tu commit>`. Si no aparece, dilo.
11. **Responde** en español, breve: titular; cada noticia y cada rumor (con su fiabilidad) en una línea; los 3 posts en español y en inglés.

## Modo TARDE (la tarea se ejecuta a las 6:36 y a las 18:36)

Objetivo: cobertura cada 12 horas sin repetir nada. Máximo 4 búsquedas.

1. Lee `content/briefs/$HOY.json` (lo publicado esta mañana) y los títulos de días anteriores (`grep -h '"title"' content/briefs/*.json | tail -60`).
2. Busca en el mismo turno, modo `extended`: `GTA 6 news $HOY_EN`, `GTA 6 Rockstar $HOY_EN` y `GTA 6 leak OR rumor OR insider $HOY_EN`.
3. Quédate solo con lo **nuevo de las últimas ~12 horas** que **no** esté ya en el archivo ni en días anteriores.
   - **Si no hay nada nuevo:** no toques nada y termina diciendo «Sin novedades esta tarde». (Es lo normal algunos días; no fuerces contenido.)
4. Si hay novedades, **añade sin borrar ni cambiar lo de la mañana** (cambiar un título rompería su enlace):
   - noticias nuevas → al **final** de `more` (máximo 8 en total en el día);
   - si una novedad es más importante que todo lo de la mañana, igualmente va a `more`, y puedes reescribir `title`, `summary` y `lead` del día para destacarla;
   - rumores nuevos → al final de `rumors` (máximo 6);
   - lo mismo, en el **mismo orden**, en `en.more` / `en.rumors` (y `en.title`/`en.summary`/`en.lead` si los cambiaste);
   - no toques `stories`, `biggest`, `posts` ni `context`.
5. Pasos 6, 7, 9, 10 y 11 igual que por la mañana, con el mensaje de commit `Resumen GTA VI $HOY (tarde)`. En la respuesta, lista solo lo añadido.

## Notas de la prensa (`content/reviews.json`)

Desde que se levante el embargo de análisis (previsto el 18 de noviembre de 2026) y durante unas semanas, en **cada** ejecución:
1. Busca (dentro de tu límite de búsquedas) `GTA 6 review score` y `GTA 6 análisis nota`.
2. Añade a `content/reviews.json` cada análisis **nuevo** de un medio reconocido: `{"outlet": "IGN", "score": 10, "max": 10, "url": "https://…análisis concreto…", "date": "AAAA-MM-DD"}`. `score` y `max` son números (por ejemplo 9.5 sobre 10, o 92 sobre 100). Actualiza `updated` con la fecha de hoy.
3. Solo la puntuación y el enlace: **nunca copies texto del análisis**. Nada de notas filtradas, de usuarios o de webs sin nombre. No repitas medios que ya estén.
4. `node scripts/build.mjs` valida el archivo. Incluye `content/reviews.json` en el commit (`git add content`).
5. Si es la noticia del día (por ejemplo, «GTA VI arrasa en la prensa»), cuéntala también en el resumen como noticia, con las fuentes.

## Después del lanzamiento (desde el 19 de noviembre de 2026): prioridades

El juego ya está a la venta. Lo que más se busca ahora, por este orden: **problemas y parches** (servidores, descargas, errores, actualizaciones), **ventas y récords**, **GTA Online** (fecha y novedades), **versión de PC**, **contenido y secretos confirmados** (zonas, misiones, duración, coches, emisoras), **notas y opinión de la prensa**. Prioriza esas noticias si son nuevas y tienen fuente. Escribe los títulos con «GTA VI» o «GTA 6» y el dato clave al principio.

- **Nada de spoilers de la historia** en titulares ni en `change`/`plain`. Si una noticia trata de la trama, cuéntala sin desvelar nada y avisa en `detail` («sin spoilers»).
- **Trucos, códigos o guías**: solo si los publica un medio reconocido o Rockstar, contados con tus palabras y con la fuente. Nada de exploits que rompan las normas del juego ni de métodos para conseguir dinero o ventajas en el modo online saltándose las reglas.

**Notas:** en cada ejecución revisa también `content/reviews.json` → añade análisis nuevos de medios reconocidos y, si cambian, actualiza los `aggregates` (Metacritic/OpenCritic) con la cifra y la fuente que la publica. Si no encuentras la URL del análisis concreto pero un medio fiable publica la nota, añade `"via": "Nombre del medio"` y su URL.

## Lo que se descubre del juego (cada día, en modo MAÑANA)

El juego ya ha salido: la web debe renovarse con lo que se va sabiendo. Además de las 6 búsquedas del resumen, en **modo MAÑANA** haz **2 búsquedas más** (`extended`, en el mismo turno):
- `GTA 6 easter egg OR secret OR discovered $AYER_EN` (secretos, guiños, curiosidades, récords)
- `GTA 6 patch OR update OR bug OR outage $AYER_EN` (actualizaciones y problemas)
En **modo TARDE** no hagas búsquedas extra: añade aquí solo lo que ya te hayan dado las búsquedas de la tarde.

**A) Secretos y descubrimientos (`content/descubrimientos.json`).** Añade al **principio** de `items` cada hallazgo **nuevo** (que no esté ya) que haya contado al menos **un medio identificable** (GameSpot, IGN, Dexerto, Kotaku, Eurogamer, Vandal, 3DJuegos, VidaExtra, PC Gamer, Polygon…):
`{"id": "slug-corto", "date": "AAAA-MM-DD", "cat": "easter|reference|curiosity|tip|secret|record|tech", "title": {"es": "…", "en": "…"}, "text": {"es": "…", "en": "…"}, "sources": [{"name": "Medio", "url": "https://…"}]}`
- `easter` (easter egg), `reference` (guiño a otra obra o juego), `curiosity` (curiosidad), `tip` (detalle útil para jugar; puedes añadir `"link": "consejos"` u otro id de `content/guias.json`), `secret` (lugar o secreto del mapa), `record` (ventas, jugadores, récords), `tech` (rendimiento, gráficos, técnica).
- Texto con tus palabras, 2–3 frases: qué es, dónde (sin coordenadas exactas si no importan) y por qué es curioso. **Nada de spoilers de la historia** (ni misiones, ni finales, ni giros), nada de glitches, trampas online, mods ni archivos filtrados o «datamines», nada sexual ni violento en detalle. Si un medio contradice a otro, dilo (como en el de Dexter).
- Si una noticia del resumen **es** un descubrimiento, puede ir en los dos sitios.
- Pon `updated` con la fecha de hoy si añades algo.

**B) Parches y problemas (`content/parches.json`).**
- **Actualización nueva** (Rockstar la publica o la cuentan medios fiables): añade al principio de `entries` `{"id": "update-x", "date": "…", "type": "update", "state": "notes" | "nonotes", "version": "1.03" (si se sabe), "platforms": ["ps5","xbox"], "title": {…}, "text": {…}, "sources": […]}`. En `text`, resume con tus palabras qué cambia (las notas oficiales) o di que no hay notas.
- **Problema extendido** (caídas, errores que cuentan varios medios, no quejas sueltas de foros): `{"type": "issue", "state": "open", …}`. Cuando se arregle, **no lo borres**: cambia `state` a `fixed` y añade al final del `text` cuándo y cómo se arregló.
- Actualiza `status`: `level` (`ok` si no hay problemas abiertos importantes, `watch` si hay algo en seguimiento, `bad` si hay un problema grave que impide jugar) y su resumen en `es` y `en` (1–2 frases). Pon `updated` con la fecha de hoy.
- Si hubo parche o un problema gordo, suele ser también noticia del día en el resumen.

**C) Verifica** con `node scripts/check-juego.mjs` hasta que diga «✓ juego listo» e incluye los archivos en el commit (`git add content`). En la respuesta, di en una línea qué descubrimientos y parches has añadido. Si no había nada nuevo, no toques estos archivos.

## Clips de la comunidad (`content/clips.json`) — cada día, en modo MAÑANA

La web muestra los vídeos más destacados de la comunidad con el **reproductor oficial** de cada plataforma (nunca se descargan ni se vuelven a subir) y siempre con crédito y enlace al original. En **modo MAÑANA** haz **2 búsquedas más** (`extended`, en el mismo turno):
- `GTA 6 youtube clip viral $AYER_EN` (inglés: momentos graciosos, acrobacias, gráficos, exploración)
- `GTA 6 vídeo youtube tiktok español` (español; **prioriza creadores de España**, después Latinoamérica)

Añade al **principio** de `items` entre **2 y 4 clips nuevos** al día (mitad español, mitad inglés si los hay):
`{"id": "slug-corto", "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX", "lang": "es" | "en", "date": "AAAA-MM-DD (hoy)", "cat": "humor|stunts|graphics|explore|easter|tips|music|review", "title": "título tal cual sale en el resultado", "by": "canal o autor si sale en el resultado, si no null", "note": {"es": "una frase tuya sobre qué se ve", "en": "…"}}`

Reglas (el verificador y la publicación lo comprueban):
- **URL exacta de un vídeo concreto** sacada del resultado de búsqueda: YouTube (`/watch?v=`, `/shorts/`, `youtu.be/`), TikTok (`/@usuario/video/123…`) o X (`/usuario/status/123…`). **Nunca inventes ni completes un ID.** Nada de canales, listas, perfiles, Instagram ni Twitch.
- **Solo vídeos de creadores**, no los oficiales de Rockstar (la publicación los descarta), ni resubidas de tráileres, ni vídeos generados con IA que se hagan pasar por el juego.
- **Prohibido:** spoilers de la historia (finales, giros, misiones clave), filtraciones, glitches o trampas para el online, mods, piratería, contenido sexual, violencia explícita recreada, odio o insultos en el título. «Sin spoilers» en el título está bien.
- **Mejor clips cortos y vistosos** (Shorts, TikTok, vídeos de pocos minutos) que directos de horas.
- `note` con tus palabras: qué se ve y por qué merece la pena, sin copiar la descripción del vídeo.
- No repitas un vídeo que ya esté (el verificador lo detecta aunque cambie el formato del enlace).
- **Al publicar, la web pregunta a cada plataforma** el título y el autor reales (así el crédito siempre es correcto). Si un vídeo se ha borrado, es privado o no permite insertarse, no se publica: no hace falta que lo quites tú.

Verifica con `node scripts/check-clips.mjs` hasta que diga «✓ clips.json listo», pon `updated` con la fecha de hoy e incluye el archivo en el commit (`git add content`). En la respuesta, lista en una línea los clips añadidos (autor y plataforma). Si no encuentras ninguno que cumpla las reglas, no añadas nada.

## Trucos (`content/trucos.json`) — cada lunes por la mañana

**Cuándo:** solo en **modo MAÑANA los lunes** (`[ "$(TZ=Europe/Madrid date +%u)" = 1 ]`), o cualquier día si una búsqueda del resumen saca por sí sola una noticia de trucos nuevos. Máximo **2 búsquedas extra** (`extended`): `GTA 6 cheat codes new` y `trucos GTA 6 nuevos códigos`.

1. Lee `content/trucos.json` (lo ya publicado).
2. **Truco nuevo con código:** solo si **al menos 2 medios o guías especializadas** (GameSpot, IGN, PC Gamer, Game Rant, Eurogamer, Vandal, 3DJuegos, VidaExtra, Polygon…) dan **exactamente la misma secuencia**. Añádelo al final de `cheats` con:
   `{"id": "slug-corto", "status": "coincide", "cat": "money|player|armor|ammo|police|vehicles|world|combat", "added": "AAAA-MM-DD", "name": {"es": "…", "en": "…"}, "effect": {"es": "…", "en": "…"}, "unlock": {"es": "…", "en": "…"}, "seq": ["U","R","D","L",…]}`
   `seq` usa U (arriba), D (abajo), L (izquierda) y R (derecha), en el orden de la cruceta. `unlock` es el requisito para desbloquearlo, contado con tus palabras.
3. **Las guías no coinciden** o falta el código: añádelo con `"status": "pendiente"`, `"seq": null`, `"unlock": null` (sale en la web como «en comprobación»). Si un pendiente ya coincide en 2 fuentes, pásalo a `"coincide"` con su `seq` y su `unlock`.
4. **Nunca cambies** `id` ni la secuencia de un truco ya publicado salvo que 2 fuentes digan que estaba mal (en ese caso corrígelo y dilo en la respuesta).
5. Añade a `sources` los medios nuevos que hayas usado (URL de la guía concreta) y pon `updated` con la fecha de hoy.
6. **Prohibido** (el verificador lo bloquea): fallos o «glitches», trucos o dinero para el modo online, mods, hacks, trainers o cualquier cosa que rompa las normas de Rockstar. Solo trucos oficiales del modo historia. Nada de spoilers en el nombre ni el requisito.
7. Verifica con `node scripts/check-trucos.mjs` hasta que diga «✓ trucos.json listo» y sigue con los pasos 7, 9 y 10 (incluye `content/trucos.json` en el commit con `git add content`). En la respuesta, di qué trucos has añadido o confirmado.
8. Si hay trucos nuevos, también pueden ser noticia del día en el resumen (con sus fuentes), por ejemplo: «Descubren el truco de … en GTA 6».

## Guías (`content/guias.json`): consejos, dinero, radio, duración…

Son páginas que no caducan y atraen visitas de Google. **No hace falta buscar nada extra** para ellas:
- Si en tus búsquedas del día aparece un **dato nuevo y confirmado** que afecta a una guía (por ejemplo, Rockstar confirma más emisoras, una cifra de duración oficial o un método de dinero nuevo del modo historia), actualiza esa guía en **español e inglés**, añade la fuente a su `sources` y pon `updated` con la fecha de hoy.
- Escribe con tus palabras, sin spoilers de la historia (nada de nombres de misiones ni giros) y sin nada del modo online, glitches o mods.
- No cambies los `slug` (romperían los enlaces). `node scripts/build.mjs` valida que no falte ningún texto en ningún idioma.

## GTA 6 Online, trofeos, coleccionables y «Mi 100 %»

- **GTA 6 Online** (guía `online` en `content/guias.json`): si Rockstar anuncia algo del multijugador (fecha, nombre, beta…), actualiza su lista `facts` (`"s": "ok"` confirmado, `"no"` sin anunciar, `"rumor"` rumor con quién lo dice), el `quick`, la `faq` y `updated`, en español e inglés y con la fuente. También es noticia del día.
- **Trofeos y coleccionables** (guías `trofeos` y `coleccionables`): corrige una cifra solo si **2 guías especializadas** coinciden en el dato nuevo.
- **«Mi 100 %»** (`content/progreso.json`): cambia un `max` o añade una categoría solo si el dato es oficial o lo confirman 2 guías. **Nunca cambies los `id`**: borrarían el progreso que la gente tiene guardado.

## Test de GTA 6 (`content/quiz.json`) — los lunes, si hay datos nuevos

Junto con los trucos de los lunes: si esa semana se ha **confirmado** algo interesante y sin spoilers (un récord, una emisora nueva, un secreto famoso, un parche importante…), añade **1 o 2 preguntas** al final de `items` (no hace falta buscar nada extra: usa lo que ya está publicado en la web):
`{"id": "slug", "link": "release|guide|leonida|cheats|reviews|finds|clips|patches|guides|news" o "g:<id de guía>", "q": {"es": "…", "en": "…"}, "o": {"es": ["4 opciones"], "en": ["4 opciones"]}, "a": índice de la correcta (0–3), "x": {"es": "explicación breve con el dato", "en": "…"}}`
- Una sola respuesta correcta, sin trampas ni opciones ambiguas; las incorrectas, verosímiles pero claramente falsas.
- El dato tiene que estar ya publicado en la web (en la página a la que apunta `link`).
- Pon `updated` con la fecha de hoy y verifica con `node scripts/check-quiz.mjs` hasta que diga «✓ quiz.json listo».

## Reglas legales y de AdSense (obligatorias, por encima de todo lo demás)

La web vive de la publicidad de Google AdSense y debe ser 100 % legal. Si una noticia o rumor no puede contarse cumpliendo esto, **no lo publiques**.

**Derechos de autor**
- Escribe **siempre con tus propias palabras**. Nunca copies ni parafrasees frase a frase un artículo. Como mucho una cita literal **muy breve** (≤20 palabras), entre comillas y atribuida a quien la dijo.
- **No uses ni enlaces imágenes, vídeos, capturas, logotipos, música ni arte** de Rockstar, Take-Two ni de otros medios. La web no lleva imágenes de terceros.
- **No enlaces material filtrado** (vídeos, capturas o archivos del juego filtrados), ni descargas, torrents, cracks, mods que salten protecciones, ROMs o cuentas compartidas. De una filtración solo puedes contar *que existe* y qué ha dicho un medio identificable, enlazando al **medio**, no al material.
- Las fuentes se enlazan a la **noticia del medio**, nunca a webs que copian contenido ajeno.

**Políticas de AdSense**
- Nada de contenido sexual, violencia gráfica, odio, acoso, drogas o armas. Habla del juego como producto (fechas, precios, novedades), sin recrearte en su violencia.
- Nada que facilite actividades ilegales o engaños: no expliques cómo leer códigos ajenos, saltarse protecciones, conseguir el juego gratis, trucos para estafar, etc. Si una noticia trata de eso, cuéntala solo como aviso al consumidor.
- **Titulares honestos**: sin clickbait, sin exagerar, sin afirmar como hecho lo que es rumor. Nada de «gratis», «filtrado completo», «descarga» en titulares.
- Nada de información personal de nadie (direcciones, cuentas privadas), ni ataques a personas concretas (incluidos filtradores o trabajadores de Rockstar).
- Marcas: «GTA», «Rockstar» y nombres del juego solo para identificar de qué se habla. Nunca sugieras que la web es oficial.

El verificador (`check-brief.mjs`) bloquea enlaces y palabras de riesgo y citas largas; si te avisa, reescribe o quita ese elemento.

## Reglas de contenido (obligatorias)

### Qué cuenta como nuevo

Lo importante es que **no esté ya publicado en la web** (compáralo con los títulos de días anteriores), no que sea de hace pocas horas:
- **Noticias** (`stories` y `more`): lo publicado por los medios en los **últimos 3 días**, priorizando lo más reciente. También vale **información útil y todavía vigente** que no hayamos contado aunque se anunciara antes (horarios de desbloqueo, juego en la nube, ediciones, códigos, tamaño, precios, eventos): en ese caso di en `detail` cuándo se anunció.
- **Rumores** (`rumors`): los más comentados de las **últimas 2 semanas** que no tengamos, siempre con fuente con nombre y su fiabilidad. Busca rumores en **cada** ejecución: dan vida a la web.
- **No hace falta una fecha exacta**: basta con que los resultados indiquen que es reciente o que sigue vigente. Si dudas de la fecha de una noticia, no la descartes: pásala a `more` y deja claro en `detail` lo que se sabe.
- Prioridad en `stories`: lo confirmado más reciente e importante. Si hay menos de 5 noticias, pon las que haya (mínimo 1).
- **Nunca inventes** datos, cifras, citas ni URLs. Cada `url` debe ser una dirección que hayas visto en los resultados de búsqueda y que apunte al **artículo concreto** (no a buscadores, acortadores ni portadas). **No hace falta abrir la página:** basta con que el dato y la URL aparezcan en los resultados de búsqueda y el resultado indique que es reciente. Si una web no carga, no la descartes por eso.
- **Redacción propia.** Resume con tus palabras. Nunca copies frases del medio (como mucho, una cita muy breve entre comillas y atribuida). Esto es lo que hace legal la web.
- **No repitas** noticias ni rumores ya publicados. Si hay novedad real sobre un tema anterior, escribe un título nuevo que cuente esa novedad.
- **Estimaciones** de terceros (ventas, reservas, presupuestos) siempre marcadas como estimaciones.
- **Rumores:** solo los más comentados, siempre con fuente con nombre (insider conocido o medio identificable) y nunca mezclados con las noticias. Fiabilidad:
  - `alta`: insider con buen historial **y** verificado por un medio por su cuenta.
  - `media`: medio fiable con fuentes anónimas, o indicios indirectos (documentos, finanzas).
  - `baja`: filtrador sin historial, dataminers o una sola cuenta sin eco en medios.
- **Si hay pocas noticias reales**, pon menos (mínimo 1). Mejor 3 noticias buenas que 5 forzadas. `more` y `rumors` pueden ir vacíos (`[]`).
- **Español de España**, claro y directo. Inglés natural (no traducción literal).
- **Nombres:** la web se llama «Leónida Hoy». En los textos en español escribe el estado del juego como «Leónida» (con tilde); en el bloque `en`, «Leonida» (sin tilde, como Rockstar en inglés). Nunca cambies las URL de las fuentes.

## Esquema

Límites que comprueba el verificador: `title` ≤110 caracteres, `summary` ≤200, `change` ≤330, `plain` ≤220, `detail` ≤60 palabras, `why` ≤200, cada post ≤220. `stories` 1–5, `more` 0–4 por la mañana (hasta 8 tras la tarde), `rumors` 0–4 por la mañana (hasta 6 tras la tarde), `posts` exactamente 3, `context` 0–3.

```json
{
  "date": "AAAA-MM-DD",
  "title": "Titular de la historia más grande",
  "summary": "Una frase que resume el día (≤200 car.).",
  "lead": "Dos frases de entrada para la portada.",
  "stories": [
    {
      "tag": "Actualización",
      "title": "Título claro de la noticia",
      "change": "Qué cambió, en una línea, con el dato concreto (para fans).",
      "plain": "Lo mismo en palabras simples para quien no sigue el juego.",
      "detail": "2–3 frases con los detalles, redacción propia, ≤60 palabras.",
      "why": "Una frase: por qué le importa al lector.",
      "sources": [{ "name": "Nombre del medio", "url": "https://medio.com/articulo-concreto" }]
    }
  ],
  "biggest": 0,
  "more": [],
  "rumors": [
    {
      "title": "Lo que dice el rumor",
      "change": "Qué se dice y quién, dejando claro que no está confirmado.",
      "plain": "En palabras simples.",
      "detail": "Contexto: de dónde sale, si hay versiones contrarias.",
      "why": "Qué supondría si se cumple.",
      "who": "Insider o medio que lo dice",
      "reliability": "alta | media | baja",
      "sources": [{ "name": "Medio", "url": "https://..." }]
    }
  ],
  "posts": ["Post 1 (≤220 car.)", "Post 2", "Post 3"],
  "context": [
    { "title": "Algo de días anteriores", "text": "Breve explicación.", "date": "AAAA-MM-DD", "sources": [{ "name": "Medio", "url": "https://..." }] }
  ],
  "en": {
    "title": "...", "summary": "...", "lead": "...",
    "stories": [{ "tag": "...", "title": "...", "change": "...", "plain": "...", "detail": "...", "why": "..." }],
    "more": [],
    "rumors": [{ "title": "...", "change": "...", "plain": "...", "detail": "...", "why": "...", "who": "..." }],
    "posts": ["...", "...", "..."],
    "context": [{ "title": "...", "text": "..." }]
  }
}
```

En `en` van **los mismos elementos en el mismo orden**, sin `sources`, `date` ni `reliability` (se reutilizan del español).

`tag` habituales: Actualización, Lanzamiento, Evento, Tráiler, Jugabilidad, Mapa, Música, Negocio, Estudio, Polémica, Aviso, Impacto · en inglés: Update, Launch, Event, Trailer, Gameplay, Map, Music, Business, Studio, Controversy, Heads-up, Impact.
