# ScanPro Backend Guidelines & Agent Rules (Antigravity & Copilot)

## 📌 Backend Overview
Node.js + Express 5 + TypeScript + Prisma ORM (MySQL) + Backblaze B2 (AWS S3 SDK) + JWT Auth.

---

## 🏗️ Architecture Standards (`/scanpro_backend/src/`)
Modular Layered Architecture:
```
src/
├── app.ts                  # Express app setup, middlewares, and route registration
├── server.ts               # HTTP server listener and graceful shutdown
├── config/
│   ├── env.ts              # Zod validated environment variables
│   ├── prisma.ts           # Prisma Client singleton
│   ├── aws.ts              # S3 / Backblaze B2 Client
│   └── swagger.ts          # OpenAPI / Swagger UI configuration
├── common/
│   ├── errors/             # AppError, BadRequestError, UnauthorizedError, etc.
│   └── utils/              # Response envelope helper, token utils
├── middlewares/
│   ├── auth.middleware.ts       # JWT authentication & req.user injection
│   ├── error.middleware.ts      # Global centralized error handler
│   ├── rate-limit.middleware.ts # Rate limiting (bypassed in development)
│   ├── validation.middleware.ts # Zod schema request validation
│   └── logger.middleware.ts     # Request/response logging
└── modules/
    ├── auth/               # controller, dto, routes, service, validation
    ├── documents/          # controller, dto, repository, routes, service, validation
    ├── folders/            # controller, dto, repository, routes, service, validation
    ├── uploads/            # controller, dto, routes, service, validation
    ├── users/              # controller, dto, routes, service, validation
    └── health/             # controller, routes
```

---

## 🚫 Backend Cardinal Rules for AI Agents
1. **Never Rewrite Working Endpoints**: Modify only the specific endpoint, service method, or schema requested by the user.
2. **Strict Zod Request Validation**: Every POST, PUT, PATCH, and parameterized GET route MUST use `validate()` middleware with a strict Zod schema.
3. **Standard Response Envelope**: Always format responses using the standard envelope:
   ```json
   {
     "success": true,
     "message": "Operation successful",
     "data": { ... }
   }
   ```
4. **Database Safety & Mandatory Migrations**:
   - Multi-table operations MUST use `prisma.$transaction`.
   - Never write raw unescaped SQL queries.
   - Whenever `prisma/schema.prisma` is updated and requires a DB change, ALWAYS create a corresponding migration under `prisma/migrations/` (using `npx prisma migrate dev` / `--create-only` or reviewed SQL matching `prisma/migrations/`, without altering already-applied migrations) and run `npx prisma generate` + `npx prisma validate`. Production deployment runs `npx prisma migrate deploy`—never skip migrations or rely on `prisma db push`.
5. **No Breaking API Contracts**: Keep response keys and HTTP status codes consistent with what the Flutter frontend (`/scanpro`) expects.
6. **Environment & Security**:
   - Never hardcode API keys or secrets in source code.
   - Always run `npx tsc --noEmit` to verify type-safety before finishing edits.
