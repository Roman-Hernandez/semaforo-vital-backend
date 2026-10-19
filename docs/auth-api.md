# US-12 — Inicio de sesión (API)

## Endpoint

`POST /api/v1/auth/login`

Request JSON:
```json
{"email": "admin@example.com", "password": "<contraseña>"}
```

Success (200):
```json
{"access_token": "<JWT>", "token_type": "bearer"}
```

Invalid credentials or inactive account (401):
```json
{"detail": "Credenciales inválidas"}
```

JWT (HS256): `sub` = MongoDB user ObjectId as string; `role`, `iat`, `exp`. Default expiration: 30 minutes. Protected endpoints must verify the signature, expiration and active user status before allowing access. Do not interpret role claims alone as sufficient authorization.

## Configuration

Set `MONGODB_URI`, `MONGODB_DB`, and a cryptographically random `JWT_SECRET_KEY` (at least 32 characters) in the deployment secret manager. Never commit secrets.

Run `database/mongodb/migrations/002_create_usuarios.js` with an appropriately privileged `mongosh` session **after** backing up and inspecting production data. The script does not create any default administrative accounts. User provisioning, password hashing, lifecycle, and password resets must be handled by a separately authorized administrative workflow. Password hashes must be generated using Argon2; never store plaintext credentials.

The database migration is rerunnable and uses unique email indexes. Deploy with a low-privilege runtime account that can read users, not change schemas. No live migration is performed automatically during API startup.

## Security follow-ups

Apply rate limiting at the API gateway and implement account provisioning, password resets, token validation dependencies, and audit events in their respective stories. Do not log passwords, Authorization headers, or JWTs.
