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
    assert result == datetime(
        2026,
        10,
        14,
        0,
        0,
        tzinfo=APP_TIMEZONE,
    )


def test_start_of_day_colombia_with_aware_datetime() -> None:
    aware_datetime = datetime(
        2026,
        10,
        15,
        3,
        0,
        tzinfo=UTC,
    )

    result = start_of_day_colombia(aware_datetime)

    assert result == datetime(
        2026,
        10,
        14,
        0,
        0,
        tzinfo=APP_TIMEZONE,
    )


def test_start_of_day_colombia_with_naive_datetime() -> None:
    naive_datetime = datetime(
        2026,
        10,
        14,
        18,
        0,
    )

    result = start_of_day_colombia(naive_datetime)

    assert result == datetime(
        2026,
        10,
        14,
        0,
        0,
        tzinfo=APP_TIMEZONE,
    )


def test_to_colombia_converts_naive_utc_datetime() -> None:
    naive_utc = datetime(
        2026,
        10,
        14,
        5,
        0,
    )

    result = to_colombia(naive_utc)

    assert result == datetime(
        2026,
        10,
        14,
        0,
        0,
        tzinfo=APP_TIMEZONE,
    )


def test_to_utc_requires_timezone_info() -> None:
    naive_datetime = datetime(
        2026,
        10,
        14,
        0,
        0,
    )

    with pytest.raises(
        ValueError,
        match="El datetime debe incluir información de zona horaria",
    ):
        to_utc(naive_datetime)


def test_to_utc_converts_aware_datetime() -> None:
    colombia_time = datetime(
        2026,
        10,
        14,
        0,
        0,
        tzinfo=APP_TIMEZONE,
    )

    expected_utc = datetime(
        2026,
        10,
        14,
        5,
        0,
        tzinfo=UTC,
    )

    assert to_utc(colombia_time) == expected_utc