# Netlify Frontend

Эта папка содержит статическую версию фронтенда для Netlify.

Что нужно сделать:

1. Открой `config.js`
2. Вставь в `apiBaseUrl` URL твоего Apps Script web app
3. Загрузи содержимое этой папки в Netlify

Файлы:

- `index.html` — статическая версия интерфейса
- `app.js` — логика интерфейса
- `google-script-shim.js` — совместимость с `google.script.run` через `fetch`
- `config.js` — конфиг с URL API

Важно:

- `код.js` остаётся в Apps Script
- если браузер упрётся в CORS на прямом запросе к Apps Script, следующим шагом нужно будет добавить прокси-слой
