# Routing

Маршрутизация трафика OLCRTC-контейнеров через внешние прокси. Позволяет управлять тем, как трафик контейнеров направляется наружу: через прокси, напрямую или блокируется.

## Что такое Routing

По умолчанию каждый OLCRTC-контейнер отправляет трафик напрямую (outbound `freedom`). Routing позволяет изменить это поведение: направлять трафик через внешний SOCKS/VLESS прокси, блокировать соединения с определёнными адресами или пропускать определённые домены напрямую.

Реализация основана на [Xray-core](https://xtls.github.io/) - отдельный контейнер `olcwave-xraycore` запускает Xray с вашей конфигурацией. OLCRTC-контейнеры подключаются к нему через локальный SOCKS5 прокси на порту `10808`.

## Как это работает

```
OLCRTC контейнер -> socks5:10808 -> olcwave-xraycore -> outbound (proxy/direct/block)
```

Когда routing включён:

1. Backend собирает полную конфигурацию Xray из вашего JSON, автоматически добавляя `dns` и `inbounds`.
2. Запускается контейнер `olcwave-xraycore` с этой конфигурацией.
3. Все существующие OLCRTC-контейнеры **асинхронно** перезапускаются с параметром `UPSTREAM_SOCKS=host.docker.internal:10808`, который перенаправляет их исходящий трафик через XrayCore. Перезапуск выполняется параллельно (до 10 контейнеров одновременно) и не блокирует API.
4. Новые контейнеры автоматически получают этот параметр при запуске.

При отключении routing:

1. Контейнер `olcwave-xraycore` останавливается.
2. Все OLCRTC-контейнеры **асинхронно** перезапускаются без `UPSTREAM_SOCKS` (прямое подключение).

## Структура конфигурации

Вы пишете JSON с двумя обязательными секциями:

```json
{
  "routing": {
    "rules": [
      {
        "domain": ["geosite:ru"],
        "outboundTag": "direct"
      },
      {
        "ip": ["geoip:private"],
        "outboundTag": "block"
      }
    ]
  },
  "outbounds": [
    { "tag": "direct", "protocol": "freedom" },
    { "tag": "block", "protocol": "blackhole" }
  ]
}
```

### Обязательные поля

| Поле               | Требование                                           |
| ------------------ | ---------------------------------------------------- |
| `routing.rules`    | Массив, должен содержать минимум одно правило        |
| `outbounds`        | Массив, должен содержать минимум один outbound       |

### Автоматически генерируемые поля

Backend сам добавляет `dns` и `inbounds` при сохранении. **Не указывайте их в конфигурации** - они будут проигнорированы.

Сгенерированные секции:

```json
{
  "dns": {
    "servers": [{ "address": "1.1.1.1" }],
    "queryStrategy": "IPIfNonMatch"
  },
  "inbounds": [
    {
      "tag": "socks",
      "listen": "0.0.0.0",
      "port": 10808,
      "protocol": "socks",
      "settings": { "auth": "noauth", "udp": true },
      "sniffing": {
        "enabled": true,
        "destOverride": ["http", "tls", "fakedns"]
      }
    }
  ]
}
```

Если вы всё же укажете `dns` или `inbounds` в конфигурации, frontend покажет предупреждение, но сохранение будет разрешено. Backend перезапишет эти поля.

## Валидация

Backend выполняет серверную валидацию JSON перед сохранением:

* **Ошибки** (блокируют сохранение, возвращают HTTP 400/422):
  * Невалидный JSON
  * `routing.rules` отсутствует или пуст
  * `outbounds` отсутствует или пуст
  * Невалидные ссылки на geotags (geoip/geosite) - коды проверяются по списку доступных тегов

* **Предупреждения** (сохранение разрешено):
  * `dns` присутствует - будет проигнорирован
  * `inbounds` присутствует - будет проигнорирован

Frontend также выполняет клиентскую валидацию JSON перед отправкой (проверяет JSON-синтаксис, обязательные секции).

## Включение и отключение

### Включение

1. Откройте страницу **Routing** в боковом меню.
2. Нажмите переключатель **Enable routing**.
3. Вставьте JSON-конфигурацию в текстовое поле.
4. Нажмите **Save & Enable**.

### Редактирование

Когда routing уже включён:

1. Отредактируйте JSON в текстовом поле.
2. Нажмите **Save**.

При сохранении все OLCRTC-контейнеры перезапускаются с новой конфигурацией.

### Отключение

1. Переключите **Disable routing** в заголовке страницы.
2. Подтвердите отключение.

Все OLCRTC-контейнеры перезапускаются без upstream прокси.

## Примеры конфигураций

Примеры доступны в репозитории: [`docs/routing_examples/`](https://github.com/invdevv/olcwave/tree/master/docs/routing_examples)

Также доступны прямо из UI через кнопку **Examples** в редакторе routing.

### Обход блокировок через SOCKS5

Направляет трафик к заблокированным сайтам через внешний SOCKS5-прокси, российские сайты - напрямую:

```json
{
  "routing": {
    "domainMatcher": "hybrid",
    "domainStrategy": "IPIfNonMatch",
    "rules": [
      {
        "domain": ["habr.com", "4pda.to", "4pda.ru"],
        "outboundTag": "proxy"
      },
      {
        "domain": ["geosite:category-ru"],
        "outboundTag": "direct"
      },
      {
        "domain": ["geosite:private"],
        "outboundTag": "block"
      },
      {
        "ip": ["geoip:private"],
        "outboundTag": "block"
      }
    ]
  },
  "outbounds": [
    {
      "tag": "proxy",
      "protocol": "socks",
      "settings": {
        "servers": [
          {
            "address": "YOUR_SOCKS_HOST",
            "port": 1080,
            "users": [
              { "user": "USERNAME", "pass": "PASSWORD" }
            ]
          }
        ]
      }
    },
    { "tag": "direct", "protocol": "freedom" },
    { "tag": "block", "protocol": "blackhole" }
  ]
}
```

### Обход блокировок через VLESS + Reality

Тот же принцип, но через VLESS с Reality:

```json
{
  "routing": {
    "domainMatcher": "hybrid",
    "domainStrategy": "IPIfNonMatch",
    "rules": [
      {
        "domain": ["habr.com", "4pda.to", "4pda.ru"],
        "outboundTag": "proxy"
      },
      {
        "domain": ["geosite:category-ru"],
        "outboundTag": "direct"
      },
      {
        "domain": ["geosite:private"],
        "outboundTag": "block"
      },
      {
        "ip": ["geoip:private"],
        "outboundTag": "block"
      }
    ]
  },
  "outbounds": [
    {
      "tag": "proxy",
      "protocol": "vless",
      "settings": {
        "vnext": [
          {
            "address": "IP",
            "port": 0,
            "users": [
              {
                "id": "00000000-0000-0000-0000-000000000000",
                "encryption": "none",
                "flow": "xtls-rprx-vision"
              }
            ]
          }
        ]
      },
      "streamSettings": {
        "network": "tcp",
        "tcpSettings": {},
        "security": "reality",
        "realitySettings": {
          "serverName": "www.example.org",
          "publicKey": "CHANGE_W_PUBLIC_KEY",
          "shortId": "aabb",
          "fingerprint": "firefox"
        }
      }
    },
    { "tag": "direct", "protocol": "freedom" },
    { "tag": "block", "protocol": "blackhole" }
  ]
}
```

## Архитектура

### XrayCore контейнер

Новый компонент системы - Docker-контейнер `olcwave-xraycore`, собираемый из `backend/xraycore/`. Содержит:

* Alpine Linux + Xray-core v26.3.27
* Конфигурация передаётся через переменную окружения `CONFIG`
* Порт `10808` (TCP/UDP) публикуется на хост

### Upstream Proxy

При enabled routing каждый OLCRTC-контейнер получает переменную окружения:

```
UPSTREAM_SOCKS=host.docker.internal:10808
```

Go-прокси внутри контейнера (`proxy.go`) использует её для перенаправления всего исходящего трафика через XrayCore.

### Database

Конфигурация routing хранится в таблице `routing` в PostgreSQL (одна запись с `id=1`). Состояние включённости routing хранится в `RuntimeSettings.xray_routing_enabled`.

## API

Routing управляется через эндпоинты `/api/routing/*`:

| Метод    | Путь              | Описание                                |
| -------- | ----------------- | --------------------------------------- |
| `GET`    | `/routing/enabled`  | Возвращает `true/false`                 |
| `GET`    | `/routing/config`   | Возвращает сохранённый JSON             |
| `POST`   | `/routing/config`   | Создаёт routing (首次 включение)         |
| `PUT`    | `/routing/config`   | Обновляет конфигурацию                  |
| `DELETE` | `/routing/config`   | Отключает и удаляет конфигурацию        |
| `GET`    | `/routing/logs`     | Логи контейнера olcwave-xraycore        |

Все эндпоинты требуют авторизацию администратора.

## Ограничения

* Одна конфигурация routing на весь инстанс - нельзя иметь несколько независимых routing-схем.
* Порты `10808` TCP и UDP должны быть доступны на хосте для работы XrayCore.
* При включении/отключении/обновлении routing все OLCRTC-контейнеры перезапускаются асинхронно. API-ответ возвращается немедленно, перезапуск выполняется в фоне (параллельно, до 10 контейнеров одновременно).
* Routing экспериментальная функция. При проблемах отключите routing - контейнеры продолжат работу напрямую.
