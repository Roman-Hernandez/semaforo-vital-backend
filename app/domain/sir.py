"""SIR determinista, población cerrada y tasas constantes por día. Sin dependencias numéricas."""
from dataclasses import dataclass
from math import ceil, isfinite
from time import perf_counter

from app.domain.errors import ApplicationError


class InvalidSIRInput(ApplicationError):
    pass


@dataclass(frozen=True, kw_only=True)
class SIRSettings:
    poblacion_total: float | None = None
    infectados_iniciales: float = 1
    recuperados_iniciales: float = 0
    beta: float = 0.35
    gamma: float = 0.1
    dias_simulacion: int = 120
    paso_tiempo: float = 0.1
    reduccion_beta: float = 0.5

    def __post_init__(self):
        values = (self.infectados_iniciales, self.recuperados_iniciales, self.beta, self.gamma,
                  self.paso_tiempo, self.reduccion_beta)
        if not all(isfinite(value) for value in values):
            raise InvalidSIRInput()
        if min(self.infectados_iniciales, self.recuperados_iniciales, self.beta, self.gamma) < 0:
            raise InvalidSIRInput()
        if max(self.beta, self.gamma) > 5 or not 0.01 <= self.paso_tiempo <= 1 or not 0 <= self.reduccion_beta <= 1:
            raise InvalidSIRInput()
        if type(self.dias_simulacion) is not int or not 1 <= self.dias_simulacion <= 365:
            raise InvalidSIRInput()
        if self.poblacion_total is not None:
            if not isfinite(self.poblacion_total) or not 0 < self.poblacion_total <= 10_000_000:
                raise InvalidSIRInput()
            if self.infectados_iniciales + self.recuperados_iniciales > self.poblacion_total:
                raise InvalidSIRInput()


@dataclass(frozen=True)
class SIRDay:
    dia: int
    susceptibles: float
    infectados: float
    recuperados: float


@dataclass(frozen=True)
class SIRRun:
    metodo: str
    paso_efectivo: float
    tiempo_ejecucion_ms: float
    curva: list[SIRDay]
    pico_infectados: float
    dia_pico: int
    error_maximo_poblacion: float
    sin_negativos: bool


def derivatives(state: tuple[float, float, float], population: float, beta: float, gamma: float):
    susceptible, infected, _ = state
    transmission = beta * susceptible * infected / population
    recovery = gamma * infected
    return -transmission, transmission - recovery, recovery


def solve_sir(settings: SIRSettings, method: str = "RK4") -> SIRRun:
    if settings.poblacion_total is None or method not in ("Euler", "RK4"):
        raise InvalidSIRInput()
    start = perf_counter()
    n = settings.poblacion_total
    state = (n - settings.infectados_iniciales - settings.recuperados_iniciales,
             settings.infectados_iniciales, settings.recuperados_iniciales)
    # Limita el paso para mantener positivos los estados intermedios sin recortar ni inventar población.
    steps_per_day = ceil(1 / min(settings.paso_tiempo, 0.25 / max(settings.beta, settings.gamma, 1)))
    step = 1 / steps_per_day
    curve = [SIRDay(0, *state)]
    max_error = abs(sum(state) - n)
    non_negative = True
    for day in range(1, settings.dias_simulacion + 1):
        for _ in range(steps_per_day):
            k1 = derivatives(state, n, settings.beta, settings.gamma)
            if method == "Euler":
                state = tuple(value + step * delta for value, delta in zip(state, k1))
            else:
                k2 = derivatives(tuple(v + step * k / 2 for v, k in zip(state, k1)), n, settings.beta, settings.gamma)
                k3 = derivatives(tuple(v + step * k / 2 for v, k in zip(state, k2)), n, settings.beta, settings.gamma)
                k4 = derivatives(tuple(v + step * k for v, k in zip(state, k3)), n, settings.beta, settings.gamma)
                state = tuple(v + step * (a + 2*b + 2*c + d) / 6
                              for v, a, b, c, d in zip(state, k1, k2, k3, k4))
            max_error = max(max_error, abs(sum(state) - n))
            non_negative = non_negative and min(state) >= 0
            if not all(isfinite(value) for value in state) or not non_negative or max_error > max(1, n) * 1e-8:
                raise InvalidSIRInput()
        curve.append(SIRDay(day, *state))
    peak = max(curve, key=lambda point: point.infectados)
    return SIRRun(method, step, (perf_counter() - start) * 1000, curve,
                  peak.infectados, peak.dia, max_error, non_negative)
