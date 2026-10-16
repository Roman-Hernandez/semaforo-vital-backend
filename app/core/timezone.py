from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings


APP_TIMEZONE = ZoneInfo(settings.app_timezone)


def now_colombia() -> datetime:
    """
    Retorna el instante actual con zona horaria America/Bogota.
    """
    return datetime.now(APP_TIMEZONE)


def start_of_day_colombia(value: date | datetime) -> datetime:
    """
    Retorna las 00:00:00 del día indicado en America/Bogota.

    Ejemplo:
    2026-10-14 00:00:00-05:00

    Al persistirse como BSON Date en MongoDB corresponde a:
    2026-10-14T05:00:00.000Z
    """

    if isinstance(value, datetime):

        if value.tzinfo is not None:
            target_date = value.astimezone(APP_TIMEZONE).date()
        else:
            target_date = value.date()

    else:
        target_date = value

    return datetime.combine(
        target_date,
        time.min,
        tzinfo=APP_TIMEZONE,
    )


def to_colombia(value: datetime) -> datetime:
    """
    Convierte un datetime a America/Bogota.

    Si MongoDB/PyMongo retorna un datetime sin tzinfo,
    se interpreta como UTC antes de realizar la conversión.
    """

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.astimezone(APP_TIMEZONE)


def to_utc(value: datetime) -> datetime:
    """
    Convierte un datetime consciente de zona horaria a UTC.
    """

    if value.tzinfo is None:
        raise ValueError(
            "El datetime debe incluir información de zona horaria."
        )

    return value.astimezone(timezone.utc)