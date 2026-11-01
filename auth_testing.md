# Auth testing
- Admin: see /app/memory/test_credentials.md
- POST /api/auth/login returns {token,user} and sets httpOnly cookie access_token
- GET /api/auth/me with cookie or Authorization: Bearer <token>
- All /api/admin/* require auth (401 otherwise)
- 5 wrong passwords for same ip+email -> 429 lockout 15 min (avoid locking real admin while testing; use a fake email)
- users stored with field `id` (uuid) and bcrypt `password_hash` ($2b$)
