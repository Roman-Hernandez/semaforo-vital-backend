from datetime import UTC, date, datetime

import pytest

from app.core.config import settings
from app.core.timezone import (
    APP_TIMEZONE,
    now_colombia,
    start_of_day_colombia,
    to_colombia,
    to_utc,
)


def test_app_timezone_default() -> None:
    assert settings.app_timezone == "America/Bogota"


def test_now_colombia_uses_configured_timezone() -> None:
    current = now_colombia()
    assert current.tzinfo == APP_TIMEZONE


def test_start_of_day_colombia_with_date() -> None:
    result = start_of_day_colombia(date(2026, 10, 14))
    assert result == datetime(2026, 10, 14, 0, 0, tzinfo=APP_TIMEZONE)


def test_start_of_day_colombia_with_aware_datetime() -> None:
    result = start_of_day_colombia(datetime(2026, 10, 15, 3, 0, tzinfo=UTC))
    assert result == datetime(2026, 10, 14, 0, 0, tzinfo=APP_TIMEZONE)


def test_start_of_day_colombia_with_naive_datetime() -> None:
    result = start_of_day_colombia(datetime(2026, 10, 14, 18, 0))
    assert result == datetime(2026, 10, 14, 0, 0, tzinfo=APP_TIMEZONE)


def test_to_colombia_converts_naive_utc_datetime() -> None:
    result = to_colombia(datetime(2026, 10, 14, 5, 0))
    assert result == datetime(2026, 10, 14, 0, 0, tzinfo=APP_TIMEZONE)


def test_to_utc_requires_timezone_info() -> None:
    with pytest.raises(ValueError):
        to_utc(datetime(2026, 10, 14, 0, 0))


def test_to_utc_converts_aware_datetime() -> None:
    colombia_time = datetime(2026, 10, 14, 0, 0, tzinfo=APP_TIMEZONE)
    assert to_utc(colombia_time) == datetime(2026, 10, 14, 5, 0, tzinfo=UTC)
