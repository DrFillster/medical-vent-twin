# Mechanical Ventilation Digital Twin

A single-file HTML5 in-browser simulator for pediatric / adult mechanical
ventilation. Two-compartment RC lung model + Recruitment-to-Inflation
ratio titration + mechanical power decomposition + Bohr/temperature shifts
on the Severinghaus curve.

## Live

- **Public URL**: https://vent.defying-logic.com/ (served via Cloudflare
  tunnel from `localhost:8770` on the host).
- **Local URL**: http://127.0.0.1:8770/

## Files

- `index.html` — the entire app (HTML + CSS + JS in one file, no build step).
- `start.sh` — local launcher (`python3 -m http.server 8770 --bind 127.0.0.1`).

## Physiology model

### Three-compartment RC lung (digital twin core)
The lung is modeled as three parallel compartments (Gattinoni & Pesenti 2005):
- **Normal (baby lung)** — always open, normal compliance, low shunt.
- **Recruitable** — opens sigmoidally with PEEP; opens more easily in high
  recruiters (lower opening pressure). Contributes residual V/Q mismatch even
  when fully open (recruited ARDS tissue is not normal tissue).
- **Consolidated** — never opens; permanent shunt. Fraction scales with
  severity (shunt) and inversely with recruitability — low recruiters have
  more non-openable tissue (Gattinoni 2005 CT data).

The three fractions sum to 1. Effective shunt for gas exchange:

    eff_shunt = fNormal · shuntNormal
              + fRecruitable · openness  · shuntRecruitedResidual
              + fRecruitable · (1-openness) · 1.0
              + fConsolidated · 1.0

This is the key fix vs. a naive two-compartment model: the consolidated
compartment gives a *floor* on eff_shunt that no amount of PEEP can remove,
and the residual V/Q mismatch in opened recruitable tissue prevents eff_shunt
from collapsing toward normal-lung baseline. Calibration target: eff_shunt
≈ 0.65 · true_shunt at moderate PEEP, matching Bellani 2016 LUNG SAFE P/F
distributions per Berlin ARDS grade.

### Oxygen-hemoglobin dissociation
Severinghaus curve with P50 shifts for temperature, Bohr effect (pH),
chronic 2,3-DPG, and carboxyhemoglobin artifact on pulse oximetry.

### Gas exchange
Iso-shunt diagram (Shapiro / West / Feiner) with `PaO2 = P/F_baseline · FiO2^0.6`.
The 0.6 exponent captures the plateau effect at high shunt.

### Mechanical power
Gattinoni: `MP = 0.098 · RR · Vt · (Ppeak − 0.5·ΔP)`, J/min.
Decomposed into elastic and resistive components; MP/ΔP ratio surfaces
flow-resistive work vs strain work.

### PEEP titration (decremental trial)
Steps PEEP 20→4 in 2-cmH2O decrements after a recruitment maneuver.
Computes the static P/V curve, inflection pressure (Pflex), and
Recruitment-to-Inflation ratio per Chen 2020 (AJRCCM). Pflex is the
PEEP at which Crs is maximal (Hickling 2001, AJRCCM); R/I uses the
endpoints of the curve, not the area under it, per Chen's derivation.

## Presets

| Preset | Crs | Shunt | Recruitability | Default PEEP / FiO₂ |
|---|---|---|---|---|
| Normal | 80 | 0.05 | 0.10 | 5 / 0.30 |
| Mild ARDS | 55 | 0.15 | 0.40 | 8 / 0.40 |
| Moderate ARDS | 35 | 0.28 | 0.60 | 10 / 0.55 |
| Severe ARDS | 18 | 0.50 | 0.50 | 14 / 0.80 |

## Citations

- ARDSNet ARMA trial — Brower et al, *NEJM* 342:1301-8 (2000)
- Driving pressure — Amato et al, *NEJM* 372:747-55 (2015)
- Baby lung + recruitability concept — Gattinoni & Pesenti, *Intensive Care Med* 31:776-84 (2005)
- Mechanical power — Gattinoni et al, *Anesthesiology* 124:441-50 (2016)
- MP VILI threshold — Serpa Neto et al, *Crit Care Med* 46:762-7 (2018)
- R/I ratio — Chen et al, *AJRCCM* 201:178-87 (2020)
- Decremental PEEP / best-compliance Pflex — Hickling, *AJRCCM* 163:69-78 (2001)
- R/I and dynamic strain — *PMID 38963617* (2025)
- Berlin ARDS definition — Ranieri et al, *JAMA* 307:2526-33 (2012)
- LUNG SAFE cohort — Bellani et al, *JAMA* 315:788-800 (2016)
- Computational lung modelling review — Neelakantan et al, *J R Soc Interface* 19:20220062 (2022)

## Local run

```bash
cd ~/medical-vent-twin
python3 -m http.server 8770 --bind 127.0.0.1
# open http://127.0.0.1:8770/
```

## Cloudflare tunnel

The `mission-control` tunnel on this host exposes:
- `mission-control.defying-logic.com` → `localhost:3000`
- `vent.defying-logic.com` → `localhost:8770`  ← this app

Config in `~/.cloudflared/config.yml`. DNS CNAME was registered via
`cloudflared tunnel route dns mission-control vent.defying-logic.com`.