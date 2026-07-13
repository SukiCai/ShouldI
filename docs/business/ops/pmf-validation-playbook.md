# ShouldI PMF Validation Playbook (90 Days)

This playbook operationalizes the PMF Bible into weekly execution.

## North Star and PMF Metrics

- `meaningful_decisions_completed`
- `returned_for_outcome_update`
- `decision_return_rate` (DRR)
- `avg_confidence_score`
- `calibration_signals`

API source of truth: `GET /v1/metrics/pmf`

## Weekly PMF Review

1. Pull metrics every Monday from `/v1/metrics/pmf`.
2. Segment by surface:
   - Explore contribution to Decide starts
   - Decide completions
   - Outcome Replay returns
3. Identify one bottleneck in the chain:
   - Clarity
   - Confidence
   - Action
   - Outcome Replay
4. Ship one focused improvement before Friday.

## Ship / Kill Rubric

Ship only if a change improves one of:

- first-session clarity
- confidence-to-action conversion
- outcome replay return probability
- calibration quality

Kill or defer if:

- it improves engagement but not outcome quality
- it increases analysis length without increasing clarity
- it depends on long-term DNA before first-session value is obvious

## 90-Day Success Gates

- Users experience `Decision Lens` after one meaningful completed decision.
- Outcome Replay baseline is live (prediction + outcome + reflection).
- DRR improves week over week for the launch cohort.
- Team can explain every shipped feature using:
  - `Will this help someone make a meaningful decision they otherwise would not have made?`
