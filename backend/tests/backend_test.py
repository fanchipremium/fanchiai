"""FANCHI AI Car Wrap Visualizer - backend API tests."""
import base64
import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

CAR_IMAGE_PATH = "/tmp/car.jpg"

REQUIRED_FIELDS = ["id", "name", "color_name", "color_code", "material", "finish", "gradient_css"]


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def car_b64():
    with open(CAR_IMAGE_PATH, "rb") as f:
        return base64.b64encode(f.read()).decode()


@pytest.fixture(scope="session")
def first_product(api):
    r = api.get(f"{BASE_URL}/api/catalog", timeout=30)
    return r.json()["products"][0]


# --- Root / Catalog ---
class TestCatalog:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/", timeout=30)
        assert r.status_code == 200
        assert "message" in r.json()

    def test_catalog_structure(self, api):
        r = api.get(f"{BASE_URL}/api/catalog", timeout=30)
        assert r.status_code == 200
        data = r.json()
        products = data["products"]
        assert isinstance(products, list) and len(products) > 0
        ids = set()
        for p in products:
            for f in REQUIRED_FIELDS:
                assert f in p and p[f], f"product {p.get('id')} missing {f}"
            assert p["material"] in ["PET", "TPU", "PVC"], p["material"]
            assert p["gradient_css"].startswith("linear-gradient")
            assert p["id"] not in ids, "duplicate product id"
            ids.add(p["id"])
        assert "_id" not in products[0]


# --- Generate wrap: validation / error handling ---
class TestGenerateWrapValidation:
    def test_missing_body_returns_422(self, api):
        r = api.post(f"{BASE_URL}/api/generate-wrap", json={}, timeout=60)
        assert r.status_code == 422

    def test_missing_product_fields_returns_422(self, api, car_b64):
        r = api.post(f"{BASE_URL}/api/generate-wrap",
                     json={"image_base64": car_b64, "product": {"id": "X"}}, timeout=60)
        assert r.status_code == 422

    def test_bad_base64_returns_structured_error(self, api, first_product):
        r = api.post(f"{BASE_URL}/api/generate-wrap",
                     json={"image_base64": "not-a-valid-base64!!!", "product": first_product},
                     timeout=180)
        assert r.status_code in (400, 422, 500, 502, 503), r.status_code
        body = r.json()
        detail = body.get("detail")
        assert isinstance(detail, dict), f"detail not structured: {body}"
        assert "code" in detail and "message" in detail
        assert detail["message"] in (
            "Unable to generate your FANCHI wrap visual right now. Please try again.",
            "FANCHI AI is currently busy. Please try again in a moment.",
        ), detail

    def test_empty_image_returns_structured_error(self, api, first_product):
        r = api.post(f"{BASE_URL}/api/generate-wrap",
                     json={"image_base64": "", "product": first_product}, timeout=180)
        assert r.status_code != 200
        detail = r.json().get("detail")
        assert isinstance(detail, dict) and "code" in detail, r.text[:300]


# --- Generate wrap: real Gemini generation ---
class TestGenerateWrapReal:
    def test_generate_success(self, api, car_b64, first_product):
        r = api.post(f"{BASE_URL}/api/generate-wrap",
                     json={"image_base64": car_b64, "product": first_product}, timeout=240)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        data = r.json()
        assert data["image"].startswith("data:image"), data["image"][:60]
        b64part = data["image"].split(",", 1)[1]
        assert len(base64.b64decode(b64part)) > 5000
        assert data["product"]["id"] == first_product["id"]
        assert data["product"]["color_code"] == first_product["color_code"]

    def test_generate_with_data_uri_prefix(self, api, car_b64, first_product):
        r = api.post(f"{BASE_URL}/api/generate-wrap",
                     json={"image_base64": f"data:image/jpeg;base64,{car_b64}",
                           "product": first_product}, timeout=240)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        assert r.json()["image"].startswith("data:image")
