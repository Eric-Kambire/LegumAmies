# PBC-inspired subseasonal experiment - Results (Bourgogne-Franche-Comté)

_Generated: 2026-10-31T23:01:12.351796+00:00_

## Status

**Reduced, explicitly-labelled PBC-inspired calibration baseline** - NOT the original MIT PBC model (which requires licensed S2S hindcasts + large compute, unavailable here).

## Data (real)

- Observations: ERA5 reanalysis via Open-Meteo archive (`models=era5`), daily 2 m mean temperature (°C) and precipitation (mm), 1991-2024, 5 BFC points averaged.

- Forecast inputs: persistence++-inspired statistical predictors from ERA5 at initialisation (no licensed dynamical S2S hindcasts).

- Lead: weeks 3-4 (valid days 15-28). Event: above upper tercile (train-only thresholds).

## Sample sizes

- warm: {'train': 240, 'val': 40, 'test': 60} (train/val/test); test base rate = 0.483

- wet: {'train': 240, 'val': 40, 'test': 60} (train/val/test); test base rate = 0.317

## Metrics (test split)

| outcome   | model        |   n_train |   n_val |   n_test |   test_base_rate |   brier_score |   brier_skill_score_vs_clim |   expected_calibration_error |
|:----------|:-------------|----------:|--------:|---------:|-----------------:|--------------:|----------------------------:|-----------------------------:|
| warm      | climatology  |       240 |      40 |       60 |           0.4833 |       0.2725  |                     0       |                      0.14987 |
| warm      | raw_forecast |       240 |      40 |       60 |           0.4833 |       0.26761 |                     0.01797 |                      0.16963 |
| warm      | pbc_inspired |       240 |      40 |       60 |           0.4833 |       0.26378 |                     0.03201 |                      0.11126 |
| wet       | climatology  |       240 |      40 |       60 |           0.3167 |       0.21659 |                     0       |                      0.01805 |
| wet       | raw_forecast |       240 |      40 |       60 |           0.3167 |       0.23546 |                    -0.08713 |                      0.16039 |
| wet       | pbc_inspired |       240 |      40 |       60 |           0.3167 |       0.28626 |                    -0.32165 |                      0.19503 |

## Uncertainty (paired bootstrap on test Brier differences)

- **warm** PBC vs climatology: ΔBrier mean -0.0091 (95% CI [-0.0781, +0.0583]) → NOT a demonstrable improvement.

- **warm** PBC vs raw forecast: ΔBrier mean -0.0043 (95% CI [-0.0748, +0.0650]) → NOT a demonstrable improvement.

- **wet** PBC vs climatology: ΔBrier mean +0.0722 (95% CI [+0.0121, +0.1453]) → NOT a demonstrable improvement.

- **wet** PBC vs raw forecast: ΔBrier mean +0.0529 (95% CI [+0.0009, +0.1127]) → NOT a demonstrable improvement.


## Conclusion

Does PBC-inspired calibration demonstrably improve weeks 3-4 forecasting for spring peas in BFC? **Warm: no. Wet: no.** Held-out bootstrap confidence intervals do not support a robust improvement over climatology at this sample size; for precipitation the statistical forecast and its recalibration do not beat climatology. Subseasonal precipitation skill is intrinsically low, and recalibration cannot create skill that the predictors do not contain.


## Limitations

- Small test sample (weeks 3-4, one region) → wide confidence intervals.

- Fixed train-period tercile thresholds are miscalibrated under the observed warming trend (test warm-event frequency >> 1/3).

- The 'raw forecast' is a statistical persistence model, not a dynamical/AI S2S ensemble; this is a methodological demonstration, not a reproduction of MIT PBC.

- Figures and numbers come from real ERA5; no synthetic data were presented as observations.
