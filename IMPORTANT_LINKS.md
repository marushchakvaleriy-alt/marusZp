# 🔗 Важливі посилання проекту

## 🌐 Production (Fly.io)

### Frontend (сайт для користувачів)

**URL:** `https://maruszp-frontend.fly.dev`

### Backend (API сервер)

**URL:** `https://maruszp-backend.fly.dev`

### 🔧 Важливі ендпоінти Backend

| Endpoint | URL | Призначення |
|----------|-----|-------------|
| **Міграція БД** | `https://maruszp-backend.fly.dev/fix-db` | Додає нові поля до бази даних (запускати після оновлень моделей) |
| **API Docs** | `https://maruszp-backend.fly.dev/docs` | Інтерактивна документація API |
| **Health Check** | `https://maruszp-backend.fly.dev/` | Перевірка, чи працює сервер |

## 📊 Fly Dashboard

**URL:** `https://fly.io/dashboard/`

Тут можна:

- Переглядати логи серверів
- Перезапускати сервіси (machines)
- Змінювати змінні середовища і секрети
- Моніторити використання ресурсів

## 🔑 Доступи

### Admin акаунт

- **Логін:** `admin`
- **Пароль:** `admin` *(змініть на продакшні!)*

### PostgreSQL Database

- База даних на Fly.io: `maruszp-db`
- Знайти URL: У терміналі команда `fly secrets list -a maruszp-backend`
- Внутрішній формат (між додатками Fly): `postgres://username:password@maruszp-db.flycast:5432/database`

## 📝 Важливі команди

### Локальна розробка

```bash
# Backend
cd backend
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

### Після змін в моделях (додали нові поля)

1. **Локально:** Відкрити `http://localhost:8000/fix-db`
2. **На продакшні:** Відкрити `https://maruszp-backend.fly.dev/fix-db`

### Деплой (оновлення на Fly.io)

```bash
# Для бекенду:
cd backend
fly deploy -a maruszp-backend

# Для фронтенду:
cd frontend
fly deploy -a maruszp-frontend
```

## ⚠️ Troubleshooting

### Не можу увійти на продакшні

1. Перевірте чи backend працює: `https://maruszp-backend.fly.dev/`
2. Запустіть міграцію: `https://maruszp-backend.fly.dev/fix-db`
3. Очистіть кеш браузера (Ctrl+Shift+Delete)

### Помилка при деплої

- Перегляньте логи в терміналі після помилки.
- Перевірте логи в Fly Dashboard.
- Перевірте чи всі Secrets/Environment Variables встановлені правильно (через CLI `fly secrets list`).

## 📅 Останні оновлення

- **2026-02-11:** Додана система прав доступу для менеджерів (5 прав: колонки + дашборди)
- **2026-02-11:** Спрощено сторінку "Провини конструкторів" (прибрано статистику і кнопки)

---

**💡 Порада:** Додайте цей документ в `.gitignore` після того, як запишете реальні паролі та чутливі дані!
