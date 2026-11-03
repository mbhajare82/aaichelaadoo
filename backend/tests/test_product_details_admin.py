# Product details (ingredients/nutrition) + admin item management (add/edit/price/delete) tests
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "mbhajare@gmail.com", "password": "Laado@5wzuqCFi"}
HEALTHY = ["Dink Laddu", "Nachni Laddu", "Roasted Makhana Chivda"]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip("admin login failed")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def catalog():
    r = requests.get(f"{BASE_URL}/api/catalog")
    assert r.status_code == 200
    return r.json()


# Seeded content/nutrition
class TestSeededDetails:
    def test_all_products_have_ingredients(self, catalog):
        for p in catalog["products"]:
            if p["name"].startswith("TEST_"):
                continue
            assert isinstance(p.get("ingredients"), list) and len(p["ingredients"]) > 0, p["name"]

    def test_healthy_have_nutrition(self, catalog):
        by = {p["name"]: p for p in catalog["products"]}
        for n in HEALTHY:
            nut = by[n]["nutrition"]
            assert nut and nut["energy_kcal"] > 0 and "protein_g" in nut
        assert by["Dink Laddu"]["nutrition"]["energy_kcal"] == 480

    def test_sweets_namkin_no_nutrition(self, catalog):
        for p in catalog["products"]:
            if p["category"] != "healthy" and not p["name"].startswith("TEST_"):
                assert not p.get("nutrition"), p["name"]

    def test_no_mongo_id(self, catalog):
        assert all("_id" not in p for p in catalog["products"])


# Admin CRUD
class TestAdminProductCRUD:
    pid = None

    def test_auth_required(self):
        r = requests.post(f"{BASE_URL}/api/admin/products", json={"name": "TEST_x", "category": "sweets", "price_per_kg": 1, "stock_grams": 1})
        assert r.status_code == 401

    def test_validation(self, admin):
        r = admin.post(f"{BASE_URL}/api/admin/products", json={"name": "TEST_bad", "category": "healthy", "price_per_kg": 0, "stock_grams": 100})
        assert r.status_code == 422
        r = admin.post(f"{BASE_URL}/api/admin/products", json={"name": "TEST_bad", "category": "healthy", "price_per_kg": 100, "stock_grams": 100, "nutrition": {"energy_kcal": -5}})
        assert r.status_code == 422

    def test_create_healthy(self, admin):
        body = {"name": "TEST_Oats Laddu API", "category": "healthy", "description": "d", "image": "",
                "price_per_kg": 950, "stock_grams": 5000, "active": True,
                "ingredients": ["Oats", "Jaggery", "Ghee"],
                "nutrition": {"energy_kcal": 400, "protein_g": 10, "carbs_g": 55, "fat_g": 15, "fibre_g": 8, "sugar_g": 20}}
        r = admin.post(f"{BASE_URL}/api/admin/products", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d and d["ingredients"] == ["Oats", "Jaggery", "Ghee"]
        TestAdminProductCRUD.pid = d["id"]
        cat = requests.get(f"{BASE_URL}/api/catalog").json()
        p = next(x for x in cat["products"] if x["id"] == d["id"])
        assert p["nutrition"]["energy_kcal"] == 400
        assert any(pk["grams"] == 250 and pk["price"] > 0 for pk in p["packs"])

    def test_edit_price_keeps_details(self, admin):
        pid = TestAdminProductCRUD.pid
        cur = next(x for x in admin.get(f"{BASE_URL}/api/admin/products").json() if x["id"] == pid)
        r = admin.put(f"{BASE_URL}/api/admin/products/{pid}", json={**cur, "price_per_kg": 1100})
        assert r.status_code == 200
        d = r.json()
        assert d["price_per_kg"] == 1100 and d["ingredients"] == ["Oats", "Jaggery", "Ghee"]
        assert d["nutrition"]["protein_g"] == 10

    def test_edit_404(self, admin):
        r = admin.put(f"{BASE_URL}/api/admin/products/nope", json={"name": "TEST_x", "category": "sweets", "price_per_kg": 1, "stock_grams": 1})
        assert r.status_code == 404

    def test_delete(self, admin):
        pid = TestAdminProductCRUD.pid
        r = admin.delete(f"{BASE_URL}/api/admin/products/{pid}")
        assert r.status_code == 200
        cat = requests.get(f"{BASE_URL}/api/catalog").json()
        assert all(x["id"] != pid for x in cat["products"])
        assert admin.delete(f"{BASE_URL}/api/admin/products/{pid}").status_code == 404

    def test_delete_combo_item_blocked(self, admin, catalog):
        besan = next(p for p in catalog["products"] if p["name"] == "Besan Laddu")
        r = admin.delete(f"{BASE_URL}/api/admin/products/{besan['id']}")
        assert r.status_code == 400
        assert "combo" in r.json()["detail"].lower()
        cat = requests.get(f"{BASE_URL}/api/catalog").json()
        assert any(x["id"] == besan["id"] for x in cat["products"])
