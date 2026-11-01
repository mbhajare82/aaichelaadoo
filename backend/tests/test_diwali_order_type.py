# AaicheLadau Diwali/Regular order type tests: settings deadline, catalog diwali_open, order validation, admin orders order_type
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "mbhajare@gmail.com", "password": "Laado@5wzuqCFi"}
mdb = MongoClient("mongodb://localhost:27017")["test_database"]
RESTORE = {"india_per_kg": 250, "abroad_extra_per_kg": 450, "rounding": "round_up", "diwali_deadline": "2026-11-05"}
CUSTOMER = {"name": "TEST User", "phone": "9999999999", "address": "123 Test Street", "city": "Pune",
            "pincode": "411001", "country": "India"}


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module", autouse=True)
def restore_settings(H):
    yield
    requests.put(f"{API}/admin/settings", json=RESTORE, headers=H)


@pytest.fixture(scope="module")
def cart_items():
    prods = requests.get(f"{API}/catalog").json()["products"]
    p = next(p for p in prods if p["in_stock"])
    return [{"kind": "product", "id": p["id"], "grams": 250, "qty": 1}]


def order(items, otype=None):
    body = {"items": items, "destination": "india", "customer": CUSTOMER}
    if otype:
        body["order_type"] = otype
    return requests.post(f"{API}/orders", json=body)


# Settings + catalog flag
class TestDeadlineOpen:
    def test_settings_default_and_catalog_open(self, H):
        r = requests.put(f"{API}/admin/settings", json=RESTORE, headers=H)
        assert r.status_code == 200
        assert r.json()["diwali_deadline"] == "2026-11-05"
        s = requests.get(f"{API}/catalog").json()["settings"]
        assert s["diwali_open"] is True and s["diwali_deadline"] == "2026-11-05"
        assert s["india_per_kg"] == 250 and s["abroad_extra_per_kg"] == 450 and s["rounding"] == "round_up"

    def test_diwali_order_passes_validation(self, cart_items):
        r = order(cart_items, "diwali")
        assert r.status_code == 503, r.text
        assert "not set up" in r.json()["detail"]

    def test_regular_and_default_pass(self, cart_items):
        assert order(cart_items, "regular").status_code == 503
        assert order(cart_items).status_code == 503

    def test_invalid_order_type(self, cart_items):
        assert order(cart_items, "festival").status_code == 422

    def test_invalid_deadline_format(self, H):
        bad = {**RESTORE, "diwali_deadline": "05-11-2026"}
        assert requests.put(f"{API}/admin/settings", json=bad, headers=H).status_code == 422
        missing = {k: v for k, v in RESTORE.items() if k != "diwali_deadline"}
        assert requests.put(f"{API}/admin/settings", json=missing, headers=H).status_code == 422

    def test_settings_requires_auth(self):
        assert requests.put(f"{API}/admin/settings", json=RESTORE).status_code == 401


# Deadline passed
class TestDeadlineClosed:
    def test_close_and_validate(self, H, cart_items):
        r = requests.put(f"{API}/admin/settings", json={**RESTORE, "diwali_deadline": "2026-10-01"}, headers=H)
        assert r.status_code == 200 and r.json()["diwali_deadline"] == "2026-10-01"
        assert requests.get(f"{API}/catalog").json()["settings"]["diwali_open"] is False
        r = order(cart_items, "diwali")
        assert r.status_code == 400
        assert r.json()["detail"].startswith("Diwali orders are closed now")
        assert order(cart_items, "regular").status_code == 503

    def test_deadline_today_is_open(self, H, cart_items):
        today = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
        requests.put(f"{API}/admin/settings", json={**RESTORE, "diwali_deadline": today}, headers=H)
        assert requests.get(f"{API}/catalog").json()["settings"]["diwali_open"] is True
        assert order(cart_items, "diwali").status_code == 503

    def test_restore(self, H):
        r = requests.put(f"{API}/admin/settings", json=RESTORE, headers=H)
        assert r.json() == {**r.json(), **RESTORE}
        assert requests.get(f"{API}/catalog").json()["settings"]["diwali_open"] is True


# Admin orders include order_type
class TestAdminOrders:
    def test_admin_orders_order_type(self, H):
        base = {"customer": CUSTOMER, "destination": "india",
                "lines": [{"kind": "product", "id": "x", "name": "Besan Laddu", "grams": 250, "qty": 1,
                           "unit_price": 175, "line_total": 175, "weight_g": 250}],
                "subtotal": 175, "weight_g": 250, "delivery_fee": 250, "total": 425, "status": "paid",
                "created_at": datetime.now(timezone.utc).isoformat()}
        mdb.orders.delete_many({"id": {"$in": ["ALPYT01", "ALPYT02"]}})
        mdb.orders.insert_many([{**base, "id": "ALPYT01", "order_type": "diwali"}, {**base, "id": "ALPYT02"}])
        try:
            data = requests.get(f"{API}/admin/orders", headers=H).json()
            m = {o["id"]: o for o in data}
            assert m["ALPYT01"]["order_type"] == "diwali"
            assert "order_type" not in m["ALPYT02"]
            assert all("_id" not in o for o in data)
        finally:
            mdb.orders.delete_many({"id": {"$in": ["ALPYT01", "ALPYT02"]}})
