"""Ajuste por mínimos cuadrados de las ecuaciones integradas SIR sobre observaciones S/I/R."""
from dataclasses import dataclass
from datetime import date
from itertools import pairwise
from math import isfinite, sqrt

from app.domain.sir import SIRSettings, solve_sir


@dataclass(frozen=True)
class SIRObservation:
    fecha: date
    poblacion: int | None
    infectados: int
    recuperados: int | None
    registro_casos_id: str
    registro_poblacion_id: str | None

    susceptibles: int | None = None

    def __post_init__(self):
        value = None if self.poblacion is None or self.recuperados is None else self.poblacion - self.infectados - self.recuperados
        object.__setattr__(self, "susceptibles", value)


@dataclass(frozen=True)
class EstimatedSIR:
    beta: float
    gamma: float
    error_ajuste_infectados: float
    intervalos_utilizados: int
    metodo: str = "Minimos cuadrados de flujos SIR integrados con regla trapezoidal"


class InsufficientSIRHistory(ValueError):
    pass


class IncompatibleSIRHistory(ValueError):
    pass


def estimate_sir(observations: list[SIRObservation]) -> EstimatedSIR:
    if len(observations) < 4:
        raise InsufficientSIRHistory("Se necesitan al menos 4 observaciones en fechas diferentes")
    if any(row.poblacion is None or row.recuperados is None for row in observations):
        raise InsufficientSIRHistory("Faltan población histórica o recuperados observados")
    population = observations[0].poblacion
    if population <= 0 or any(row.poblacion != population for row in observations):
        raise IncompatibleSIRHistory("La población cambió: el SIR cerrado requiere una serie de población constante")
    if any(min(row.infectados, row.recuperados, row.susceptibles) < 0 for row in observations):
        raise IncompatibleSIRHistory("Los casos activos y recuperados no pueden superar la población")
    beta_numerator = beta_denominator = gamma_numerator = gamma_denominator = 0.0
    for left, right in pairwise(observations):
        days = (right.fecha - left.fecha).days
        if days <= 0 or days > 3:
            raise InsufficientSIRHistory("Se requieren fechas distintas, con intervalos de hasta 3 días")
        transmissions = left.susceptibles - right.susceptibles
        recoveries = right.recuperados - left.recuperados
        if transmissions < 0 or recoveries < 0:
            raise IncompatibleSIRHistory("La serie implica reinfecciones, entradas o correcciones incompatibles con SIR cerrado")
        exposure = days * (left.susceptibles * left.infectados + right.susceptibles * right.infectados) / (2 * population)
        infected_time = days * (left.infectados + right.infectados) / 2
        beta_numerator += exposure * transmissions
        beta_denominator += exposure * exposure
        gamma_numerator += infected_time * recoveries
        gamma_denominator += infected_time * infected_time
    if beta_denominator <= 0 or gamma_denominator <= 0:
        raise InsufficientSIRHistory("No hay exposición suficiente para estimar las tasas de transmisión y recuperación")
    if gamma_numerator <= 0:
        raise InsufficientSIRHistory("No hay recuperaciones observadas para estimar la tasa de recuperación")
    beta = beta_numerator / beta_denominator
    gamma = gamma_numerator / gamma_denominator
    if not all(isfinite(value) and 0 <= value <= 5 for value in (beta, gamma)):
        raise IncompatibleSIRHistory("Las tasas estimadas están fuera del rango operativo del modelo")
    first, last = observations[0], observations[-1]
    fitted = solve_sir(SIRSettings(poblacion_total=population, infectados_iniciales=first.infectados,
        recuperados_iniciales=first.recuperados, beta=beta, gamma=gamma,
        dias_simulacion=(last.fecha - first.fecha).days, reduccion_beta=0))
    squared_errors = [(row.infectados - fitted.curva[(row.fecha - first.fecha).days].infectados) ** 2 for row in observations]
    return EstimatedSIR(beta, gamma, sqrt(sum(squared_errors) / len(squared_errors)), len(observations) - 1)
