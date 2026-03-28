# Deploy To Netlify

Эта папка уже подготовлена под нормальный деплой через GitHub.

Что должно быть в репозитории:

- `index.html`
- `app.js`
- `google-script-shim.js`
- `config.js`
- `_redirects`
- `netlify.toml`
- папка `netlify/functions`

Как публиковать:

1. Создай новый репозиторий на GitHub.
2. Скопируй в него все содержимое папки `netlify-site`.
3. В Netlify нажми `Add new site` -> `Import from Git`.
4. Выбери этот репозиторий.
5. Build command оставь пустым.
6. Publish directory укажи `.` или оставь пустым, если Netlify подставит корень проекта.

Почему так:

- при простом drag-and-drop Netlify часто публикует только статику
- серверные функции из `netlify/functions` при таком варианте могут не развернуться
- в результате фронт открывается, а `/.netlify/functions/apps-script-proxy` отвечает `404`

Что уже настроено:

- `config.js` смотрит в `/.netlify/functions/apps-script-proxy`
- `netlify.toml` указывает Netlify, где лежат функции
- `apps-script-proxy.js` проксирует запросы в Google Apps Script
