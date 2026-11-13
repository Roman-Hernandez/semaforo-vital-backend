import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.errors import ERROR_CATALOG, register_error_handlers
from app.domain.errors import ApplicationError
from app.main import _request_hits, app


@pytest.mark.parametrize("exception, definition", list(ERROR_CATALOG.items()))
def test_error_catalog_produces_stable_public_responses(exception, definition):
    test_app = FastAPI()
    register_error_handlers(test_app)

    @test_app.get("/error")
    def fail():
        raise exception("private database detail")

    response = TestClient(test_app).get("/error")
    assert response.status_code == definition.status
    assert response.json() == {"code": definition.code, "detail": definition.message}
    assert "private" not in response.text
    if definition.status == 401:
        assert response.headers["WWW-Authenticate"] == "Bearer"


def test_unexpected_error_has_no_internal_details():
    test_app = FastAPI()
    register_error_handlers(test_app)

    @test_app.get("/error")
    def fail():
        raise RuntimeError("secret=do-not-expose")

    response = TestClient(test_app, raise_server_exceptions=False).get("/error")
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert "secret" not in response.text


def test_missing_catalog_entry_falls_back_to_internal_error():
    test_app = FastAPI()
    register_error_handlers(test_app)

    @test_app.get("/error")
    def fail():
        raise ApplicationError("private")

    response = TestClient(test_app).get("/error")
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"


def test_route_errors_use_the_same_response_contract():
    test_app = FastAPI()
    register_error_handlers(test_app)

    @test_app.get("/exists")
    def exists():
        return {}

    client = TestClient(test_app)
    assert client.get("/missing").json()["code"] == "ROUTE_NOT_FOUND"
    response = client.post("/exists")
    assert response.status_code == 405
    assert response.json()["code"] == "METHOD_NOT_ALLOWED"
    assert "GET" in response.headers["allow"]


def test_openapi_declares_success_types_and_error_codes():
    _request_hits.clear()
    schema = TestClient(app).get("/openapi.json").json()
    route = schema["paths"]["/api/v1/mi-albergue/dashboard"]["get"]
    assert route["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith("/DashboardResponse")
    example = route["responses"]["403"]["content"]["application/json"]["examples"]["SHELTER_ACCESS_DENIED"]
    assert example["value"]["code"] == "SHELTER_ACCESS_DENIED"
    assert "ErrorResponse" in schema["components"]["schemas"]
    _request_hits.clear()
