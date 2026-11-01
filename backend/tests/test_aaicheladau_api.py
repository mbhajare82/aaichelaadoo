# AaicheLadau backend regression tests: auth, catalog, quote/delivery, orders(503), feedback, chat/leads, admin CRUD
import os
import time
import uuid
import json
import pytest
import requests
from datetime import datetime, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "mbhajare@gmail.com", "password": "Laado@5wzuqCFi"}
mdb = MongoClient("mongodb://localhost:27017")["test_database"]


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def catalog():
    return requests.get(f"{API}/catalog").json()


def pid(catalog, name):
    return next(p for p in catalog["products"] if p["name"] == name)["id"]


# --- Auth
class TestAuth:
    def test_login_sets_httponly_cookie(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN["email"]
        sc = r.headers.get("set-cookie", "")
        assert "access_token=" in sc and "HttpOnly" in sc

    def test_bad_login_401(self):
        r = requests.post(f"{API}/auth/login", json={"email": f"TEST_{uuid.uuid4().hex[:6]}@x.com", "password": "nope"})
        assert r.status_code == 401

    def test_bruteforce_lockout(self):
        em = f"test_lock_{uuid.uuid4().hex[:6]}@x.com"
        codes = [requests.post(f"{API}/auth/login", json={"email": em, "password": "x"}).status_code for _ in range(6)]
        assert codes[:5] == [401] * 5 and codes[5] == 429, codes
        mdb.login_attempts.delete_many({"identifier": {"$regex": "test_lock_"}})

    def test_bcrypt_hash(self):
        u = mdb.users.find_one({"email": ADMIN["email"]})
        assert u["password_hash"].startswith("$2b$")

    def test_me(self, H):
        assert requests.get(f"{API}/auth/me", headers=H).json()["email"] == ADMIN["email"]

    @pytest.mark.parametrize("path", ["/admin/stats", "/admin/leads", "/admin/products", "/admin/combos",
                                      "/admin/orders", "/admin/testimonials", "/admin/settings"])
    def test_admin_401(self, path):
        assert requests.get(f"{API}{path}").status_code == 401


# --- Catalog & quote
class TestCatalog:
    def test_catalog(self, catalog):
        assert len(catalog["combos"]) == 4
        assert sorted(c["price"] for c in catalog["combos"]) == [599, 999, 1499, 1999]
        assert {p["category"] for p in catalog["products"]} == {"sweets", "namkin", "healthy"}
        p = catalog["products"][0]
        assert [x["grams"] for x in p["packs"]] == [250, 500, 1000]

    def test_quote_round_up_and_abroad(self, catalog):
        b = pid(catalog, "Besan Laddu")
        items = [{"kind": "product", "id": b, "grams": 1000, "qty": 1}, {"kind": "product", "id": b, "grams": 500, "qty": 1}]
        q = requests.post(f"{API}/cart/quote", json={"items": items, "destination": "india"}).json()
        assert q["weight_g"] == 1500 and q["subtotal"] == 1050 and q["delivery_fee"] == 500
        q = requests.post(f"{API}/cart/quote", json={"items": items, "destination": "abroad"}).json()
        assert q["delivery_fee"] == 1400

    def test_min_1kg(self, catalog):
        b = pid(catalog, "Besan Laddu")
        q = requests.post(f"{API}/cart/quote", json={"items": [{"kind": "product", "id": b, "grams": 250, "qty": 1}]}).json()
        assert q["delivery_fee"] == 250 and q["subtotal"] == 175

    def test_exact_rounding(self, catalog, H):
        orig = requests.get(f"{API}/admin/settings", headers=H).json()
        try:
            r = requests.put(f"{API}/admin/settings", headers=H, json={**orig, "rounding": "exact"})
            assert r.json()["rounding"] == "exact"
            b = pid(catalog, "Besan Laddu")
            items = [{"kind": "product", "id": b, "grams": 1000, "qty": 1}, {"kind": "product", "id": b, "grams": 500, "qty": 1}]
            q = requests.post(f"{API}/cart/quote", json={"items": items, "destination": "india"}).json()
            assert q["delivery_fee"] == 375
        finally:
            requests.put(f"{API}/admin/settings", headers=H, json={k: orig[k] for k in ("india_per_kg", "abroad_extra_per_kg", "rounding")})

    def test_combo_quote(self, catalog):
        c = next(c for c in catalog["combos"] if c["price"] == 599)
        q = requests.post(f"{API}/cart/quote", json={"items": [{"kind": "combo", "id": c["id"], "qty": 1}]}).json()
        assert q["subtotal"] == 599 and q["weight_g"] == 500 and q["delivery_fee"] == 250

    def test_invalid_pack(self, catalog):
        b = pid(catalog, "Besan Laddu")
        q = requests.post(f"{API}/cart/quote", json={"items": [{"kind": "product", "id": b, "grams": 300, "qty": 1}]}).json()
        assert q["errors"]

    def test_order_503(self, catalog):
        b = pid(catalog, "Besan Laddu")
        r = requests.post(f"{API}/orders", json={"items": [{"kind": "product", "id": b, "grams": 250, "qty": 1}],
                                                 "destination": "india",
                                                 "customer": {"name": "TEST_x", "phone": "9999999999", "address": "abcdef",
                                                              "city": "Pune", "pincode": "411058"}})
        assert r.status_code == 503 and "not set up" in r.json()["detail"]


# --- Feedback
class TestFeedback:
    @pytest.fixture(scope="class", autouse=True)
    def order(self):
        mdb.orders.delete_many({"id": "ALTEST02"})
        mdb.testimonials.delete_many({"order_id": "ALTEST02"})
        mdb.orders.insert_one({"id": "ALTEST02", "customer": {"name": "TEST_Cust", "phone": "9999999999", "address": "x",
                               "city": "Pune", "pincode": "411058", "country": "India"}, "destination": "india",
                               "lines": [{"kind": "product", "id": "x", "name": "Besan Laddu", "grams": 250, "qty": 1,
                                          "unit_price": 175, "line_total": 175, "weight_g": 250}],
                               "subtotal": 175, "weight_g": 250, "delivery_fee": 250, "total": 425, "status": "paid",
                               "created_at": datetime.now(timezone.utc).isoformat()})
        yield
        mdb.orders.delete_many({"id": "ALTEST02"})
        mdb.testimonials.delete_many({"order_id": "ALTEST02"})

    fb = {"order_id": "altest02", "phone": "+91 99999 99999", "name": "TEST_Cust", "taste": 5, "price": 4, "nourishment": 5,
          "comment": "TEST_ lovely laddu"}

    def test_wrong_phone(self):
        r = requests.post(f"{API}/testimonials", json={**self.fb, "phone": "1111111111"})
        assert r.status_code == 404

    def test_submit_dup_publish(self, H):
        r = requests.post(f"{API}/testimonials", json=self.fb)
        assert r.status_code == 200, r.text
        r = requests.post(f"{API}/testimonials", json=self.fb)
        assert r.status_code == 400 and "already" in r.json()["detail"]
        t = next(t for t in requests.get(f"{API}/admin/testimonials", headers=H).json() if t["order_id"] == "ALTEST02")
        assert t["published"] is False
        assert not any(x["id"] == t["id"] for x in requests.get(f"{API}/testimonials").json())
        requests.patch(f"{API}/admin/testimonials/{t['id']}", headers=H, json={"published": True})
        pub = requests.get(f"{API}/testimonials").json()
        m = [x for x in pub if x["id"] == t["id"]]
        assert m and "phone" not in m[0]

    def test_stats_revenue_includes_paid(self, H):
        s = requests.get(f"{API}/admin/stats", headers=H).json()
        assert s["paid_orders"] >= 1 and s["revenue"] >= 425


# --- Admin CRUD
class TestAdminCRUD:
    def test_product_crud_and_stock(self, H):
        body = {"name": "TEST_Item", "category": "healthy", "description": "d", "image": "", "price_per_kg": 800, "stock_grams": 400}
        p = requests.post(f"{API}/admin/products", headers=H, json=body).json()
        try:
            cp = next(x for x in requests.get(f"{API}/catalog").json()["products"] if x["id"] == p["id"])
            assert cp["in_stock"] and [k["in_stock"] for k in cp["packs"]] == [True, False, False]
            assert cp["packs"][0]["price"] == 200
            r = requests.put(f"{API}/admin/products/{p['id']}", headers=H, json={**body, "stock_grams": 0, "price_per_kg": 1000})
            assert r.json()["price_per_kg"] == 1000
            cp = next(x for x in requests.get(f"{API}/catalog").json()["products"] if x["id"] == p["id"])
            assert cp["in_stock"] is False
            # combo using it -> out of stock
            c = requests.post(f"{API}/admin/combos", headers=H, json={"name": "TEST_Combo", "price": 111,
                                                                     "items": [{"product_id": p["id"], "grams": 250}]}).json()
            cc = next(x for x in requests.get(f"{API}/catalog").json()["combos"] if x["id"] == c["id"])
            assert cc["in_stock"] is False
            r = requests.put(f"{API}/admin/combos/{c['id']}", headers=H, json={"name": "TEST_Combo2", "price": 222, "active": False,
                                                                              "items": [{"product_id": p["id"], "grams": 250}]})
            assert r.status_code == 200
            assert not any(x["id"] == c["id"] for x in requests.get(f"{API}/catalog").json()["combos"])
            requests.delete(f"{API}/admin/combos/{c['id']}", headers=H)
            assert not any(x["id"] == c["id"] for x in requests.get(f"{API}/admin/combos", headers=H).json())
        finally:
            requests.delete(f"{API}/admin/products/{p['id']}", headers=H)
        assert not any(x["id"] == p["id"] for x in requests.get(f"{API}/admin/products", headers=H).json())

    def test_order_status_change(self, H):
        mdb.orders.insert_one({"id": "ALTEST03", "customer": {"name": "TEST_C", "phone": "1", "address": "x", "city": "P",
                               "pincode": "1", "country": "India"}, "destination": "india", "lines": [], "subtotal": 0,
                               "weight_g": 0, "delivery_fee": 0, "total": 0, "status": "paid", "created_at": datetime.now(timezone.utc).isoformat()})
        try:
            requests.patch(f"{API}/admin/orders/ALTEST03", headers=H, json={"status": "delivered"})
            o = next(o for o in requests.get(f"{API}/admin/orders", headers=H).json() if o["id"] == "ALTEST03")
            assert o["status"] == "delivered"
            assert requests.patch(f"{API}/admin/orders/ALTEST03", headers=H, json={"status": "bogus"}).status_code == 422
        finally:
            mdb.orders.delete_many({"id": "ALTEST03"})


# --- Chat & leads
class TestChat:
    def test_chat_stream_and_end(self, H):
        sid = f"TEST_{uuid.uuid4().hex}"
        try:
            r = requests.post(f"{API}/chat/message", json={"session_id": sid, "message": "Hi I am TEST_Ravi, phone 9876543210. What is price of Mini Faral Box?"},
                              stream=True, timeout=90)
            assert r.status_code == 200
            text = ""
            for line in r.iter_lines():
                if line.startswith(b"data: "):
                    ev = json.loads(line[6:])
                    text += ev.get("delta", "")
            print("REPLY1:", text)
            assert "599" in text
            r = requests.post(f"{API}/chat/message", json={"session_id": sid, "message": "What is the weather in Mumbai today?"}, stream=True, timeout=90)
            t2 = "".join(json.loads(l[6:]).get("delta", "") for l in r.iter_lines() if l.startswith(b"data: "))
            print("REPLY2:", t2)
            assert "will call back" in t2
            e = requests.post(f"{API}/chat/end", json={"session_id": sid}, timeout=90).json()
            assert e["saved"] and e["lead_id"]
            lead = requests.get(f"{API}/admin/leads/{e['lead_id']}", headers=H).json()
            print("LEAD:", {k: lead[k] for k in ("name", "phone", "label", "summary", "whatsapp_message")})
            assert lead["label"] in ("Hot", "Warm", "Cold") and lead["summary"] and lead["whatsapp_message"]
            assert requests.post(f"{API}/chat/message", json={"session_id": sid, "message": "hi"}).status_code == 400
        finally:
            mdb.leads.delete_many({"session_id": sid})
            mdb.chat_sessions.delete_many({"session_id": sid})

    def test_end_empty(self):
        assert requests.post(f"{API}/chat/end", json={"session_id": "TEST_nonexist"}).json()["saved"] is False
