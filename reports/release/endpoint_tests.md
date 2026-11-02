# Légume'Ami — Backend endpoint test matrix

Target: `https://ba8yoci7d8.execute-api.us-east-1.amazonaws.com` (API Gateway `ba8yoci7d8`, Lambda `legumamies-climateshield-api`)
Release SHA: `37d2c67da5e31a14c053fdce74fcd28ae0fddfc0`
Date: 2026-11-01

## Success cases

| Endpoint | Method | HTTP | Notes |
|---|---|---|---|
| `/health` | GET | 200 | `{"status":"ok","service":"legumamies-climateshield-api","version":"0.1.0"}` |
| `/meta` | GET | 200 | 3131 bytes; real rule catalogue with Terres Inovia sourced thresholds, FR↔PY mappings |
| `/assess` | POST | 200 | 15.1 KB. AROME `meteofrance_arome_france_hd` 48 real hours; AIFS `ecmwf_aifs025_ensemble` **51 members**, 7-day rain probabilities; 1 active published rule (pea/flowering); regulatory spraying window sourced to Arrêté du 4 mai 2017 (max wind 25.3 km/h ≥ 19 → not allowed); honest provenance data_kinds |
| `/advisor/ask` | POST | 200 | 3.5 KB in 4.6 s. Real Nova Lite (`amazon.nova-lite-v1:0`) prose grounded in live AROME forecast; **3 real KB citations** (Terres Inovia, KB `C5WRYFYF1O`); `grounded:true`; tools_used = search_documents/get_forecast/explain_risk/explain_harvest; uncertainty from 51 AIFS members; honest limitations (weather-only, no yield/economic claims) |

## Error / edge cases

| Case | HTTP | Expected | Result |
|---|---|---|---|
| `/assess` invalid crop ("banane") | 422 | 422 | PASS |
| `/assess` missing required fields | 422 | 422 | PASS |
| `/assess` GET (wrong method) | 405 | 405 | PASS |
| `/advisor/ask` empty question | 422 | 422 | PASS |
| `/geo/soil` (not deployed) | 404 | 404 | PASS — confirms geo routes EXCLUDED (PR #7 unmerged) |

## Bedrock / cost observations
- One `converse()` + one KB `retrieve()` per advisor request (no duplicate Bedrock calls).
- Nova Lite is AWS's low-cost model; advisor latency ~4.6 s.
- Guardrails: Lambda reserved concurrency = 5; API Gateway `$default` throttle rate 5 / burst 10.

## CloudWatch
- No ERROR log entries during or after the test invocations (last 15 min window checked).
