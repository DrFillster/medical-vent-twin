"""Reference-engine adapter contract.

The existing Python implementation should be wrapped, not rewritten, so dynamic
engine regression tests can request comparable quasi-static endpoints.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class ReferenceRequest:
    peep_cm_h2o: float
    vt_l: float
    recruitment_fraction: float

@dataclass(frozen=True)
class ReferenceResult:
    end_expiratory_volume_l: float
    end_inspiratory_volume_l: float
    plateau_pressure_cm_h2o: float


def evaluate_reference(request: ReferenceRequest) -> ReferenceResult:
    raise NotImplementedError("Adapter must call the preserved v0.2 reference model")
