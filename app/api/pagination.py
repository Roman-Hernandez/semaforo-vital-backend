from datetime import date, timedelta
from typing import Annotated

from fastapi import Depends, Query, Request
from pydantic import BaseModel, ConfigDict

from app.core.timezone import start_of_day_colombia
from app.domain.pagination import InvalidListQuery, ListFilters, Pagination


class PageResponse[T](BaseModel):
    model_config = ConfigDict(from_attributes=True)
    items: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_previous: bool


def pagination_params(request: Request, page: Annotated[int, Query(ge=1, le=1_000_000)] = 1,
                      page_size: Annotated[int, Query(ge=1, le=100)] = 20) -> Pagination:
    if "limite" in request.query_params or "offset" in request.query_params:
        raise InvalidListQuery()
    return Pagination(page, page_size)


def list_filters(q: Annotated[str | None, Query(max_length=100)] = None,
                 desde: date | None = None, hasta: date | None = None) -> ListFilters:
    if desde and hasta and desde > hasta:
        raise InvalidListQuery()
    if hasta == date.max:
        raise InvalidListQuery()
    return ListFilters(q.strip() or None if q is not None else None,
        start_of_day_colombia(desde) if desde else None,
        start_of_day_colombia(hasta + timedelta(days=1)) if hasta else None)


PageParams = Annotated[Pagination, Depends(pagination_params)]
FilterParams = Annotated[ListFilters, Depends(list_filters)]
