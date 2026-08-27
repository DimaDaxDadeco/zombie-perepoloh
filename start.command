#!/bin/bash
# Двойной клик по этому файлу запускает игру.
# Локальный сервер нужен потому, что браузеры не грузят ES-модули по file://

cd "$(dirname "$0")" || exit 1

PORT=8321

# Если сервер уже запущен на этом порту — просто открываем браузер.
if ! nc -z localhost "$PORT" 2>/dev/null; then
  python3 -m http.server "$PORT" >/dev/null 2>&1 &
  sleep 1
fi

open "http://localhost:$PORT/index.html"

echo "Игра открыта в браузере: http://localhost:$PORT"
echo "Это окно можно закрыть, когда наиграетесь (сервер остановится)."
wait
