from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from test_albergues import SUPER, FakeAlbergueRepository, _user, sembrar

from app.api import deps
from app.api.errors import register_error_handlers
from app.api.v1.endpoints.albergues import router
from app.core.timezone import start_of_day_colombia
from app.domain.pagination import InvalidListQuery, ListFilters, Page, Pagination
from app.domain.users import UserRole
from app.infrastructure.database.pagination import filtered_query, paginate_find
from app.infrastructure.repositories.mongo_albergue_repository import (
    MongoAlbergueRepository,
)


@pytest.mark.parametrize("page,size", [(0, 20), (1, 0), (1, 101), (True, 20), (1, 1.5), (1000001, 10)])
def test_domain_rejects_invalid_pagination(page, size):
    with pytest.raises(InvalidListQuery):
        Pagination(page, size)


def test_empty_last_and_out_of_range_metadata():
    empty = Page.create([], Pagination(), 0)
    assert empty.total_pages == 0
    assert not empty.has_next
    assert not empty.has_previous
    last = Page.create(["final"], Pagination(3, 2), 5)
    assert last.total_pages == 3
    assert last.has_previous
    assert not last.has_next
    beyond = Page.create([], Pagination(5, 2), 5)
    assert beyond.items == []
    assert beyond.page == 5
    assert beyond.total == 5


def test_shared_mongo_page_counts_same_scope_and_limits_before_mapping():
    collection = MagicMock()
    collection.count_documents.return_value = 31
    cursor = collection.find.return_value.sort.return_value.skip.return_value.limit.return_value
    cursor.__iter__.return_value = iter([{"id": "x"}])
    query = {"albergue_id": "propio"}
    page = paginate_find(collection, query, Pagination(2, 10), [("fecha", -1), ("_id", -1)], lambda row: row["id"])
    assert page.items == ["x"]
    assert page.total == 31
    assert page.total_pages == 4
    collection.count_documents.assert_called_once_with(query)
    collection.find.assert_called_once_with(query)
    collection.find.return_value.sort.assert_called_once_with([("fecha", -1), ("_id", -1)])
    collection.find.return_value.sort.return_value.skip.assert_called_once_with(10)
    collection.find.return_value.sort.return_value.skip.return_value.limit.assert_called_once_with(10)


def test_filters_escape_search_and_dates_are_not_applied_after_pagination():
    since = start_of_day_colombia(date(2026, 11, 1))
    until = start_of_day_colombia(date(2026, 11, 18))
    query = filtered_query({"albergue_id": "propio"}, ListFilters(".*", since, until), ("nombre",), "fecha")
    assert query["albergue_id"] == "propio"
    assert query["$or"] == [{"nombre": {"$regex": r"\.\*", "$options": "i"}}]
    assert query["fecha"] == {"$gte": since, "$lt": until}


@pytest.fixture
def api():
    repository = FakeAlbergueRepository()
    a = sembrar(repository, "ALB-001")
    sembrar(repository, "ALB-002")
    sembrar(repository, "ALB-003", activo=False)
    app = FastAPI()
    register_error_handlers(app)
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[deps.get_albergue_repository] = lambda: repository
    app.dependency_overrides[deps.get_current_user] = lambda: SUPER
    return TestClient(app), app, a


def test_api_pages_are_stable_and_filters_change_total(api):
    client, _, _ = api
    first = client.get("/api/v1/albergues?page=1&page_size=2").json()
    last = client.get("/api/v1/albergues?page=2&page_size=2").json()
    assert first["total"] == last["total"] == 3
    assert first["has_next"]
    assert last["has_previous"]
    assert {row["id"] for row in first["items"]}.isdisjoint(row["id"] for row in last["items"])
    filtered = client.get("/api/v1/albergues?activo=true&page_size=1").json()
    assert filtered["total"] == 2
    assert filtered["total_pages"] == 2
    search = client.get("/api/v1/albergues?q=ALB-002").json()
    assert search["total"] == 1
    assert search["items"][0]["codigo_albergue"] == "ALB-002"
    assert client.get("/api/v1/albergues?page=99").json()["items"] == []


def test_admin_total_does_not_reveal_other_shelters(api):
    client, app, shelter = api
    app.dependency_overrides[deps.get_current_user] = lambda: _user(UserRole.SHELTER_ADMIN, shelter.id)
    page = client.get("/api/v1/albergues").json()
    assert page["total"] == 1
    assert [row["id"] for row in page["items"]] == [shelter.id]


@pytest.mark.parametrize("query", ["page=0", "page_size=101", "page=abc", "limite=30", "offset=0",
                                    "desde=2026-11-18&hasta=2026-11-01", "q=" + "a" * 101])
def test_api_rejects_invalid_or_legacy_query(api, query):
    client, _, _ = api
    assert client.get("/api/v1/albergues?" + query).status_code == 422


def test_public_alert_total_counts_only_published_alerts_of_active_shelters():
    db = MagicMock()
    db.alertas.aggregate.return_value = iter([{"items": [], "total": [{"value": 7}]}])
    page = MongoAlbergueRepository(db).page_public_alerts(Pagination(2, 2), ListFilters(), active=True)
    assert page.total == 7
    assert page.total_pages == 4
    pipeline = db.alertas.aggregate.call_args.args[0]
    assert pipeline[0] == {"$match": {"publica": True, "activa": True}}
    assert pipeline[1]["$lookup"]["pipeline"][0] == {"$match": {"activo": True}}
    assert pipeline[-1]["$facet"]["total"] == [{"$count": "value"}]
    assert pipeline[-1]["$facet"]["items"][:2] == [{"$skip": 2}, {"$limit": 2}]


def test_summary_route_uses_global_aggregate_and_requires_super(api):
    from app.domain.albergues import ShelterSummary

    client, app, shelter = api
    repository = app.dependency_overrides[deps.get_albergue_repository]()
    repository.summary = MagicMock(return_value=ShelterSummary(30, 29, 28, 3, 2, 3000, 1, 75.0))
    response = client.get("/api/v1/albergues/resumen")
    assert response.status_code == 200
    assert response.json()["total_registrados"] == 30
    repository.summary.assert_called_once_with()
    app.dependency_overrides[deps.get_current_user] = lambda: _user(UserRole.SHELTER_ADMIN, shelter.id)
    assert client.get("/api/v1/albergues/resumen").status_code == 403
    repository.summary.assert_called_once_with()
