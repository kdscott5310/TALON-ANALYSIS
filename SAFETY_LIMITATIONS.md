# Safety & Model Limitations

**This application provides preliminary engineering estimates only.**
Final cable dynamics, crane loads, rigging design, anchors, trolley,
braking system, wind limits, and operating procedures require validation
by appropriately qualified engineers, crane representatives, rigging
personnel, and site-safety authorities.

No result in this tool authorizes a physical test.

## Model limitations

### Cable statics
- Parabolic approximation: self-weight distributed per horizontal
  projection, cable perfectly flexible (no bending stiffness), no
  elastic elongation, no wind/temperature geometry effects.
- Horizontal tension is set from pretension on the unloaded cable and
  reused for loaded/dynamic cases (geometric stiffening under the moving
  load is neglected). The app warns when sag/span exceeds 8% or chord
  slope exceeds 30°, where the approximation degrades.
- Elastic-catenary and segmented nonlinear cable models are **not
  implemented** in this release.

### Trolley dynamics
- Point-mass trolley. Payload pendulum sway, wheel rotating inertia, and
  lateral / out-of-plane cable motion are **not modeled**.
- The cable path is treated as quasi-static (fixed during a run); cable
  inertia and longitudinal waves are neglected.
- Motion is one-directional; a stall before the brake zone is reported
  rather than modeling reverse roll.

### Braking
- Brake force follows an idealized law (constant force, linear ramp, or
  velocity-proportional). Real hydraulic/eddy-current/friction hardware
  response requires manufacturer data and physical testing.
- The user-entered dynamic amplification factor is applied to the peak
  brake force as a **preliminary** brake-anchor/cable demand. A coupled
  cable–brake transient analysis is future work.

### Anchors
- Sliding uses Coulomb friction on a rigid block cluster on level ground;
  uplift credits dead weight only (no soil/helical anchors).
- Block weight and ground friction are provisional field inputs.

## Inputs that require professional / manufacturer validation

The following are **user inputs**. The tool never supplies certified
values. Where a rating is not entered, the dependent check reports
*insufficient information* — it is never treated as zero or acceptable.

| Input | Must be validated by |
|---|---|
| Crane rated capacity at radius, side-load & dynamic allowances | Crane manufacturer / lift director (load chart) |
| Cable MBS, linear mass, stiffness, creep, temperature limits | Cable manufacturer certificate |
| Ecology-block weight | Field weigh / supplier data |
| Ground friction coefficient | Geotechnical assessment / field test |
| Brake hardware capacity & force-vs-stroke curve | Brake component manufacturer |
| Trolley structural rating | Trolley design + proof test |
| Rigging (master ring, shackles, turnbuckles) WLL | Rigging supplier certificates |
| Dynamic amplification factor | Qualified engineer |

## Calculations requiring independent verification

Even where a benchmark passes in the Validation tab (confirming the
numerical kernel matches its own hand calculation), the following must be
independently verified by qualified professionals before use:

- Loaded cable tension and profile under the real (non-parabolic) cable
  behavior.
- Crane hook load including manufacturer dynamic allowances and any
  permitted side loading.
- Anchor stability against site-specific soil, slope, and weather.
- Brake energy absorption, peak force, and reset behavior against actual
  hardware.
- Wind, gust, and out-of-plane loading limits.
- All operating procedures, interlocks, and abort criteria.

## Software limitations

- Passing benchmarks verify the math against closed-form references; they
  do **not** validate the models against real hardware.
- No FMEA, bill of materials, or cost model is included in this release
  (see [TRACEABILITY.md](TRACEABILITY.md)).
- Front/top/brake-detail visualization views are not implemented; the
  side elevation and force diagram are.
