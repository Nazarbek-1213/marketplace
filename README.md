# 2cbazar

Marketplace and seller portal starter, with a FastAPI API, PostgreSQL, JWT authentication, and Nginx routing for `2cnzrbk.uz` and `seller.2cnzrbk.uz`.

## Features

- Marketplace: email one-time-code sign-in, product search/categories, shopping cart, and order placement.
- Marketplace categories are loaded from available product inventory; selecting a category filters the catalog.
- Buyers can review purchased products after checkout or later from their purchase history. Reviews are limited to verified buyers, shown on product cards, and available publicly.
- Buyers and sellers can view and edit their profile name, phone, gender, and birth date from `GET/PATCH /api/auth/me`.
- Marketplace categories open in a slide-in sidebar; choosing a category filters products and updates the hero image.
- Seller portal: email-code registration followed by username/password setup, username/password sign-in, and product management.
- Sellers can add up to three JPEG, PNG, or WebP product photos (5 MB each); files are validated and persisted in a Docker volume.
- Seller analytics: weekly and monthly revenue, orders, items sold, daily trend, and best-selling products, based on the seller's own placed orders.
- Analytics periods cover the last 7 or 30 days, use Uzbekistan time, and compare against the previous matching period.
- 30-day access JWTs and 60-day, single-use rotating refresh JWTs.
- Hashed, expiring email codes, attempt limits, password hashing, role checks, product stock checks, and order persistence.
- Docker Compose services for PostgreSQL, both React/Vite sites, FastAPI, and Nginx.

## Run with Docker

1. Copy `.env.example` to `.env`.
2. Set `POSTGRES_PASSWORD`, `JWT_SECRET`, `OTP_SECRET`, and SMTP values in `.env`. Use separate random secrets of at least 32 characters for `JWT_SECRET` and `OTP_SECRET`; leave no example values in production.
3. Point both domains to the server's IP address.
4. Start the services:

   ```sh
   docker compose up --build -d
   ```

The HTTP sites are served at `http://2cnzrbk.uz` and `http://seller.2cnzrbk.uz`; API documentation is at `http://2cnzrbk.uz/docs`.

The included Nginx configuration handles HTTP routing. Before accepting real passwords or tokens on a public server, configure TLS certificates and redirect both domains to HTTPS; the included Nginx configuration does not provision certificates or enable HTTPS.

## Local API development

From `backend`, install `requirements.txt` and run:

```sh
uvicorn app.main:app --reload
```

By default the API uses a local SQLite database. In development without SMTP, the six-digit email code is written to the API log; it is never returned in the HTTP response. Production requires SMTP configuration.

Run each frontend in a separate terminal:

```sh
cd frontend/marketplace
npm install
npm run dev
```

```sh
cd frontend/seller
npm install
npm run dev
```

Both local Vite servers proxy `/api` requests and uploaded images to FastAPI on `localhost:8000`.

## API outline

- `POST /api/auth/marketplace/request-code`, `POST /api/auth/marketplace/verify`
- `POST /api/auth/seller/request-code`, `POST /api/auth/seller/register`, `POST /api/auth/seller/login`
- `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `PATCH /api/auth/me`
- `GET /api/categories`, `GET /api/products`, `GET /api/products/{id}`
- `GET /api/products/{id}/reviews`, `POST /api/reviews`, `GET /api/reviews/mine`
- `GET /api/seller/products`, `POST /api/seller/products`, `GET /api/seller/analytics?period=weekly|monthly`
- `POST /api/seller/uploads` (seller JWT, multipart `files`, up to three images)
- `POST /api/orders`, `GET /api/orders`

Payments, delivery provider integrations, and order administration are not yet integrated.
