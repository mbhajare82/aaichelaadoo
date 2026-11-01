# AaicheLadau – PRD

## Original problem statement
Build a lead-capture & Maharashtrian Diwali sweets, namkin selling web app called "AaicheLadau" for home made sweets and namkin selling, in Warje Pune, Maharashtra. PUBLIC PAGE: landing page with sweets category, namkin category, healthy food category. There should be combo offers also with inclusion of sweets and namkin with weights limit for each. A chat assistant named "Laado" collects: name, phone, items details, delivery address. Laado answers fee questions (Rs 599 / 999 / 1499 / 1999 per combo offer) from this info only - anything else: "'Aaiche Laado' will call back for serving you...". On chat end, save the lead with a 2-3 line summary and a label: Hot / Warm / Cold. Individual item like types of laadu, namkin etc. can be added into the cart and depending upon the items selected final amount should be calculated. For the delivery in India 250/KG or less than 1KG should be charged while checking out from the cart. For abroad delivery 450/kg should be charged extra. User should be able give testimonials against the orders received about the taste, price, nourishment etc. Kindly integrate Razorpay while checking out and payment process with utmost security. ADMIN DASHBOARD (simple login): lead table with coloured labels; click a lead for the summary and a ready-to-copy WhatsApp follow-up in friendly Indian English. Stats: total leads, hot this week. Design: mobile-first, deep blue + warm yellow, education look. Keep the scope exactly this - simple and reliable, no extra features. Admin should be able to manage (add/modify price of item etc.) quantity in terms of weight of each item using the admin page. Out of stock should be mentioned if item really gets out of stock by considering orders placed. As a customer user should be able to give feedback against the order received. At the bottom of the page please add testimonials across customers and admin should have the ability to publish selected testimonials.

User choices: Claude Sonnet 5.5 (Emergent key); Razorpay test mode first; delivery: both rounding modes picked -> admin setting (default round part-kg up, min 1 kg); abroad = 250 + 450 per kg; fixed combos set by admin.

## Architecture
- FastAPI (server.py) + MongoDB (uuid `id` fields), React + Tailwind + shadcn.
- Laado: SSE streaming chat (claude-sonnet-5-5), history in chat_sessions; /chat/end extracts lead JSON (summary, label, WhatsApp msg).
- Pricing/delivery/stock computed server-side (/cart/quote, /orders). Razorpay order create + signature verify; stock deducted on verified payment.
- Admin JWT (cookie + bearer), bcrypt, brute-force lockout.

## Implemented (2026-11-01)
- Landing: hero, combos, Sweets/Namkin/Healthy tabs, 250g/500g/1kg packs, out-of-stock badges, cart sheet with India/Abroad fee, checkout + Razorpay, feedback form (order ID + phone), published testimonials, Laado chat widget.
- Admin: stats, leads table + detail/WhatsApp copy, items & stock (kg) CRUD, combos CRUD, orders + status, testimonials publish, delivery settings.
- Seed: 11 sample items, 4 sample combos (sample prices/descriptions, editable).

## Implemented (2026-11-01, iteration 2)
- Generated a matching photo for each of the 11 seeded items (saved in frontend/public/images).
- Admin photo upload for items (Emergent object storage, admin-only POST /api/admin/upload, public GET /api/files/{path}); JPG/PNG/WEBP up to 5 MB, file contents checked.
- Generated photos for the 4 combo boxes; combos have an `image` field, shown on combo cards; admin can upload/change combo photos.
- Diwali countdown banner at top of landing (Lakshmi Puja dates 2026-11-08, 2027-10-29, 2028-10-17 IST; shows greeting on the day, hides after last date).

## Pending / Backlog
- P0: Real Razorpay test keys (saved values are invalid placeholders) then test payment success flow.
- P1: Razorpay webhook for payments where browser closes before verify; per-item real photos.
- P2: Explicit CORS origins for production.
