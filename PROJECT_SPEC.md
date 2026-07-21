Build an Interactive Captive UAS Final-Approach Test-System Planner
Act as a multidisciplinary engineering team consisting of:
•	Mechanical systems engineer
•	Crane and rigging engineer
•	Structural engineer
•	Cable-dynamics analyst
•	Vehicle/trolley dynamics engineer
•	Brake-system engineer
•	Instrumentation and controls engineer
•	Test-range safety engineer
•	Frontend web application engineer
•	Technical illustrator
•	Cost estimator and procurement specialist
Develop a complete preliminary engineering plan and an interactive browser-based application for a portable captive UAS and sensor-suite final-approach test facility.
The application must model, visualize, and compare system configurations involving:
•	A crane-supported elevated launch point
•	Flexible cable lengths greater than 1,000 ft
•	High-point elevations up to 250 ft
•	An instrumented trolley carrying interchangeable UAS, seeker, EO/IR, radar, RF, or inert test articles
•	A controlled downhill approach
•	Adjustable line sag and pretension
•	Progressive braking and ground-level capture
•	Portable ballast and anchor systems
•	Repeatable setup, testing, teardown, and relocation
This application is a preliminary design and planning tool, not a substitute for a licensed engineer, crane manufacturer, qualified rigger, certified lift director, structural engineer, or site-specific safety review. Clearly identify all calculations that require professional validation.
________________________________________
1. Core Design Architecture
Use the following baseline architecture, but allow comparison against alternatives.
Preferred baseline
The preferred architecture is an independent two-leg load system terminating at an elevated master node:
1.	A mobile crane supports a rated hook load cell and a steel master delta ring or engineered master-link assembly.
2.	The launch-side support line terminates independently at the master ring.
3.	The downhill main test line terminates independently at the master ring.
4.	The two lines do not run continuously over a crane pulley.
5.	Each ground-end line terminates through:
o	Load cell or dynamometer
o	Heavy-duty turnbuckle or controlled tensioning device
o	Rated shackles and master links
o	Engineered steel anchor frame
o	Ecology-block ballast array
o	Supplemental ground anchors or driven pins where permitted
6.	The crane primarily controls high-point elevation.
7.	Static line tension is held by mechanical rigging, not by an electric vehicle winch brake.
8.	A WARN-class electric winch may be used for initial positioning, controlled setup, or trolley retrieval, but must not be treated as the sole static or dynamic load-holding device.
9.	The trolley travels down the main span to a progressive ground brake and independent backup capture system.
10.	The crane may be lowered between runs for ground-level reloading if that is determined to be the safest reset option.
Alternative architecture comparison
Also evaluate:
•	Continuous main line through a suspended swivel snatch block
•	Independent launch line and test line connected to a master ring
•	Crane-lowered reset
•	Separate recovery line and recovery winch
•	Motorized trolley return
•	Tow-back trolley
•	Ground-based secondary line
•	Dual-line trolley for improved roll stability
•	Portable mast versus mobile crane
•	Steel wire rope versus HMPE/Dyneema
•	Hybrid steel support cable with synthetic tension or recovery lines
For each architecture, provide:
•	Advantages
•	Disadvantages
•	Crane load implications
•	Rope wear and heating concerns
•	Setup complexity
•	Reset time
•	Portability
•	Failure modes
•	Approximate cost
•	Recommended use case
•	Final recommendation
________________________________________
2. Required Interactive Inputs
Create a left-side or collapsible input panel. Every input must include:
•	Label
•	Units
•	Tooltip
•	Reasonable default
•	Allowable range
•	Warning when outside a reasonable preliminary-design range
Site geometry
•	Horizontal test span: 500–2,000 ft
•	Total available cable length
•	High-point elevation: 25–250 ft
•	Crane base-to-hook horizontal radius
•	Crane boom length
•	Crane hook height
•	Launch-side anchor horizontal offset from high point
•	Brake-side anchor location
•	Ground elevation difference
•	Desired approach angle
•	Brake-zone length
•	Capture-zone length
•	Required minimum payload ground clearance
•	Available site width
•	Wind direction relative to test-line axis
Cable properties
Allow either selection from presets or manual entry:
•	Material:
o	HMPE/Dyneema
o	AmSteel-type 12-strand HMPE
o	Galvanized wire rope
o	Compacted wire rope
o	Custom
•	Diameter
•	Linear mass
•	Minimum breaking strength
•	Manufacturer working-load recommendation
•	Elastic modulus or effective axial stiffness
•	Constructional stretch
•	Long-term creep allowance
•	Temperature limit
•	Minimum sheave D:d ratio
•	Friction coefficient at sheaves
•	Aerodynamic drag coefficient
•	Projected diameter
•	Splice efficiency
•	Termination efficiency
•	Desired design factor
•	Pretension
•	Initial unstretched line length
•	Target center sag
•	Allowable tension range
Do not hard-code vendor properties as certified facts. Include clearly labeled example presets and require users to verify them against current manufacturer data.
Trolley and test article
•	Trolley mass
•	Test-article mass
•	Total moving mass
•	Payload center-of-gravity offset
•	Payload vertical drop below trolley
•	Wheel diameter
•	Number of wheels
•	Wheel bearing resistance
•	Rolling-resistance coefficient
•	Wheel groove radius
•	Aerodynamic frontal area
•	Drag coefficient
•	Payload yaw area
•	Payload side area
•	Maximum permitted sway angle
•	Maximum permitted roll angle
•	Maximum permitted acceleration
•	Maximum permitted deceleration
•	Desired terminal speed
•	Maximum allowable speed
•	Launch latch location
•	Brake engagement position
Crane and rigging
•	Crane-rated capacity at working radius
•	Allowable hook load
•	Crane manufacturer dynamic allowance
•	Hook-block mass
•	Crane load-cell capacity
•	Master-ring mass
•	Rigging mass
•	Launch-leg tension
•	Main-span tension
•	Included angle between lines
•	Out-of-plane angle
•	Side-load warning threshold
•	Maximum allowed hook offset from resultant load line
•	Master-link WLL
•	Shackle WLL
•	Turnbuckle WLL
•	Load-cell range
•	Sling angle
•	Sling length
•	Dynamic amplification factor
Anchor system
•	Ecology-block dimensions
•	Number of blocks per anchor
•	Weight per block
•	Block arrangement
•	Steel frame mass
•	Ground coefficient of friction
•	Ground slope
•	Supplemental driven-anchor capacity
•	Ground-anchor angle
•	Number of ground anchors
•	Load distribution between ballast and ground anchors
•	Allowable sliding displacement
•	Allowable overturning margin
•	Safety factor against sliding
•	Safety factor against overturning
Brake system
•	Brake type
•	Brake engagement speed
•	Moving mass
•	Desired stopping distance
•	Maximum deceleration
•	Brake stroke
•	Friction coefficient
•	Normal-force range
•	Hydraulic cylinder bore
•	Hydraulic stroke
•	Orifice size
•	Accumulator pressure
•	Eddy-current brake gap
•	Brake-disc dimensions
•	Cable-drum radius
•	Shock-absorber force curve
•	Backup arrestor stroke
•	Backup-catch engagement point
•	Brake anchor capacity
•	Maximum allowable peak force
Environment
•	Air density
•	Temperature
•	Steady crosswind
•	Gust speed
•	Gust factor
•	Wind profile with elevation
•	Rain/wet-line condition
•	Ice contamination flag
•	Temperature derating
•	Ground-condition preset
________________________________________
3. Required Engineering Models
Implement transparent preliminary calculations. Display equations, assumptions, units, and intermediate results.
Use SI internally where practical, but allow immediate switching between:
•	US customary units
•	SI units
3.1 Static cable sag
Provide at least three selectable models:
1.	Parabolic approximation
2.	Elastic catenary approximation
3.	Segmented numerical cable model
Calculate:
•	Cable profile
•	Lowest point
•	Midspan sag
•	Horizontal tension
•	Vertical reaction at each end
•	Total tension along cable
•	Elongation
•	Required unstretched cable length
•	Ground clearance
•	Sensitivity to pretension
•	Sensitivity to payload location
•	Sensitivity to temperature and creep
Clearly state when the parabolic approximation is not appropriate.
3.2 Moving trolley sag
Calculate cable displacement with the trolley at selectable positions:
•	Launch
•	10% span
•	25% span
•	50% span
•	75% span
•	Brake entry
•	Final stop
Show:
•	Local cable angle at trolley
•	Left and right cable-leg tension
•	Vertical load reaction
•	Horizontal reaction
•	Cable deflection
•	Trolley clearance
•	Change in crane hook resultant
•	Change in anchor reactions
Include an animation slider that moves the trolley along the line.
3.3 Crane resultant load
For independent launch and test-line legs, calculate vector forces at the master ring:
•	Force magnitude on each line
•	Horizontal and vertical components
•	In-plane resultant
•	Out-of-plane resultant
•	Hook load
•	Hook-line angle
•	Required crane-hook position for vertical alignment
•	Bending/side-load warning
•	Dynamic-amplified hook load
•	Margin to crane-rated capacity
Display a force-vector diagram at the master ring.
Provide warnings such as:
•	Hook not aligned with resultant
•	Out-of-plane load present
•	Crane chart capacity exceeded
•	Dynamic margin insufficient
•	Included angle produces excessive hook load
•	Rigging WLL exceeded
Do not suggest that a crane is automatically permitted to accept side loading. Require crane-company approval.
3.4 Trolley motion model
Calculate trolley motion using a time-step numerical model.
Include:
•	Gravity component along cable
•	Changing cable slope
•	Rolling resistance
•	Bearing losses
•	Aerodynamic drag
•	Crosswind force
•	Payload sway
•	Cable motion
•	Optional active speed-control force
•	Brake engagement
•	Trolley acceleration
•	Velocity
•	position versus time
•	kinetic energy
•	estimated transit time
Allow selection of:
•	Free gravity run
•	Passive drag-controlled trolley
•	Active mechanical brake
•	Eddy-current brake
•	Hydraulic brake
•	Regenerative or motor-controlled trolley
•	Constant-speed control target
•	Speed-limited descent
Show plots for:
•	Position versus time
•	Velocity versus time
•	Acceleration versus time
•	Cable tension versus time
•	Crane hook load versus time
•	Brake force versus time
•	Payload sway angle versus time
•	Ground clearance versus position
3.5 Sway model
Provide both simplified and advanced modes.
Simplified mode
Model the payload as a damped pendulum below the trolley.
Inputs:
•	Drop length
•	Payload mass
•	Initial yaw or sway angle
•	Crosswind
•	Damping
•	Trolley acceleration
•	Brake deceleration
Outputs:
•	Lateral sway angle
•	Longitudinal pitch angle
•	Maximum displacement
•	Clearance envelope
•	Time to settle
Advanced preliminary mode
Use a coupled lateral cable-and-payload lumped-mass model.
Include:
•	Distributed cable mass
•	Trolley mass
•	Suspended payload
•	Crosswind
•	Gust
•	Trolley acceleration
•	Brake impulse
•	Cable lateral stiffness
•	Damping
Display a straight-on/front view of cable sway and payload envelope.
Clearly label this as a preliminary lumped-parameter model requiring validation against specialized cable-dynamics software or physical testing.
3.6 Brake-energy calculation
Calculate:
•	Trolley kinetic energy at brake entry
•	Gravitational energy remaining through brake zone
•	Energy to be dissipated
•	Average stopping force
•	Peak stopping force
•	Average deceleration
•	Peak deceleration
•	Required brake stroke
•	Estimated heat generation
•	Brake reset time
•	Anchor reaction
•	Backup arrestor load if primary brake fails
Allow the user to compare multiple brake concepts side by side.
________________________________________
4. Required 2D Visualizations
Use HTML5 Canvas, SVG, or a combination. Prefer SVG for crisp engineering diagrams and Canvas for animation if needed.
View A: Side elevation
Show:
•	Ground line
•	Crane base
•	Crane boom
•	Hook
•	Hook load cell
•	Master delta ring
•	Launch anchor
•	Launch line
•	Main test line
•	Static sag curve
•	Moving loaded sag curve
•	Trolley
•	Payload envelope
•	Brake zone
•	Capture zone
•	Brake anchor
•	Ecology blocks
•	Ground anchors
•	Turnbuckles
•	Load cells
•	Force arrows
•	Dimensions
•	Approach angle
•	Lowest cable point
•	Ground-clearance dimension
•	Crane radius
•	Hook height
•	Cable span
Allow toggles for:
•	Unloaded cable
•	Loaded cable
•	Dynamic envelope
•	Force vectors
•	Dimensions
•	Safety zones
•	Brake stroke
•	Payload swing envelope
•	Crane-rated load margin
•	Anchor reaction arrows
View B: Front/straight-on view
Show:
•	Crane centerline
•	Boom plane
•	Hook and master ring
•	Main line centerline
•	Cable lateral sway
•	Trolley lateral offset
•	Payload swing
•	Wind vector
•	Safety corridor
•	Maximum sway envelope
•	Out-of-plane force
•	Crane side-load warning
•	Required site width
Use animation or a slider to show sway versus time.
View C: Top/site-plan view
Show:
•	Crane footprint
•	Outriggers
•	Boom centerline
•	Launch anchor
•	Brake anchor
•	Cable corridor
•	Ecology-block arrays
•	Ground-anchor locations
•	Operator zones
•	Restricted areas
•	Instrumentation trailers
•	Camera locations
•	Emergency egress
•	Winch location
•	Brake-service area
View D: Force diagram
Show the master ring as a node with:
•	Launch-line vector
•	Main-line vector
•	Crane-hook vector
•	Resultant
•	Included angle
•	Out-of-plane component
•	Dynamic factor
•	Numeric force labels
View E: Brake-detail diagram
Show:
•	Trolley brake lug
•	Capture block
•	Brake-entry funnel
•	Primary progressive brake
•	Secondary catch
•	Brake stroke
•	Load cell
•	Brake anchor
•	Reset mechanism
________________________________________
5. Trolley Design Requirements
Develop three trolley concepts and rank them.
Concept 1: Four-wheel retained trolley
Preferred baseline:
•	Four primary load wheels
•	Upper or lower capture geometry preventing derailment
•	Redundant side-retention rollers
•	Replaceable wheel liners
•	Sealed bearings
•	Structural frame
•	Lower payload hardpoint
•	Rated swivel
•	Inline payload load cell
•	Secondary retention lanyard
•	Launch lug
•	Brake lug
•	Recovery lug
•	Instrument tray
•	Onboard IMU
•	Wheel-speed encoder
•	Independent overspeed device
•	Aerodynamic fairing option
Concept 2: Dual-carriage articulated trolley
Use two short wheel carriages connected by an articulated frame.
Benefits to evaluate:
•	Improved stability
•	Better cable conformity
•	Longer wheelbase
•	Reduced pitching
•	Better support of long test articles
Concept 3: Dual-line stabilized trolley
Use two parallel support lines and a wide trolley.
Benefits to evaluate:
•	Better roll control
•	Improved sensor pointing
•	Lower payload sway
•	Potentially greater setup complexity
•	Greater load balancing difficulty
For each trolley concept provide:
•	Isometric drawing
•	Side view
•	Front view
•	Component breakdown
•	Suggested materials
•	Wheel material
•	Bearing specification approach
•	Frame design
•	Approximate mass
•	Estimated fabrication cost
•	Payload range
•	Advantages
•	Disadvantages
•	Failure modes
•	Inspection points
•	Proof-test recommendations
•	Maintainability
•	Portability
•	Suitability for different test articles
Do not provide final stamped dimensions without engineering validation.
________________________________________
6. Speed-Control Options
Evaluate and rank these options:
Passive aerodynamic drag
•	Adjustable drag plates
•	Deployable air brake
•	Replaceable drag panels
•	Simple but wind-sensitive
Wheel friction brake
•	Spring-loaded friction pad
•	Adjustable normal force
•	Mechanical governor
•	Heat and wear concerns
Centrifugal overspeed governor
•	Wheel-driven mechanical governor
•	Engages only above set speed
•	Fail-safe mechanical concept
•	Requires custom design and testing
Eddy-current brake
•	Magnets acting on conductive rotating disc or rail
•	Contactless
•	Speed-dependent
•	Heat generated in conductor
•	Requires careful packaging and magnetic-gap control
Hydraulic wheel brake
•	Wheel or axle drives hydraulic pump
•	Adjustable restriction
•	Accumulator or relief valve
•	High controllability
•	More complex
Motor-generator control
•	Wheel-driven motor
•	Electronic load bank
•	Closed-loop speed control
•	Regenerative energy option
•	Requires fail-safe mechanical backup
Recommend the most feasible architecture for a portable test trolley.
The likely preferred architecture should be evaluated as:
•	Low-loss free-running trolley during the measurement zone
•	Passive mechanical or eddy-current overspeed limiter on trolley
•	Primary ground-based progressive brake near the capture end
•	Independent backup arrestor
•	No dependence on wireless command for basic safe stopping
Explain why the main energy-absorbing brake is better placed at the ground capture end than entirely onboard the trolley.
________________________________________
7. Ground Brake Design Concepts
Develop and compare at least four feasible brake systems.
Option A: Progressive friction-rope or friction-bollard brake
•	Trolley engages a capture shuttle
•	Shuttle pulls a controlled rope through friction devices
•	Adjustable wraps or brake packs
•	Simple and resettable
•	Heat and rope-wear analysis required
Option B: Hydraulic capture sled
•	Trolley engages a sliding capture carriage
•	Hydraulic cylinders absorb energy
•	Adjustable metering orifice
•	Accumulator or relief valve
•	Load cell and stroke sensor
•	Strong candidate for repeatability
Option C: Industrial shock-absorber bank
•	Multiple parallel industrial energy absorbers
•	Modular capacity
•	Predictable stroke
•	Limited total energy per cycle
•	Replacement and cooling considerations
Option D: Eddy-current linear brake
•	Conductive fin or rail
•	Permanent magnet arrays
•	Contactless progressive braking
•	Strong speed dependence
•	Higher design and fabrication complexity
For each option calculate preliminary:
•	Required stroke
•	Average force
•	Peak force
•	Energy capacity
•	Heat load
•	Reset method
•	Cost
•	Portability
•	Maintenance
•	Environmental sensitivity
•	Procurement risk
Recommend:
1.	Primary brake concept
2.	Secondary backup arrestor
3.	Final mechanical stop
4.	Instrumentation package
5.	Reset procedure
________________________________________
8. Safety and Interlock Logic
Create an interlock matrix.
Launch shall be inhibited unless all required conditions are satisfied.
Suggested permissives:
•	Crane hook load within approved range
•	Launch-anchor tension within range
•	Brake-anchor tension within range
•	Difference between anchor tensions within allowable tolerance
•	Master-ring geometry in plane
•	Out-of-plane angle below threshold
•	Crane operator ready
•	Lift director ready
•	Brake armed
•	Backup catch armed
•	Trolley launch latch closed
•	Trolley in launch position
•	Recovery equipment clear
•	Personnel-clear status active
•	Range clear
•	Wind below limit
•	Instrumentation recording
•	Cameras recording
•	Payload secure
•	UAS propulsion inhibited or approved test state selected
•	Emergency stops reset
•	No anchor movement detected
•	No loss of sensor communication
•	No overload alarm
•	No brake fault
Display the interlock state clearly as:
•	Green: ready
•	Yellow: advisory
•	Red: launch inhibited
Do not allow software alone to serve as the only safety layer. Recommend mechanical, electrical, and procedural layers.
________________________________________
9. Failure Modes and Effects Analysis
Create a preliminary FMEA table covering at least:
•	Main-line failure
•	Launch-line failure
•	Master-ring failure
•	Crane overload
•	Crane hook misalignment
•	Out-of-plane loading
•	Load-cell failure
•	Turnbuckle loosening
•	Shackle pin loosening
•	Ecology-block sliding
•	Ecology-block overturning
•	Ground-anchor pullout
•	Trolley derailment
•	Wheel bearing seizure
•	Payload detachment
•	Excessive payload sway
•	Overspeed
•	Primary brake failure
•	Backup catch failure
•	Hard-stop impact
•	Recovery-line fouling
•	Winch brake failure
•	Loss of power
•	Loss of communications
•	Unexpected wind gust
•	Cable creep
•	Cable abrasion
•	Cable heat damage
•	Cable contamination
•	Sensor disagreement
•	Operator error
•	Premature launch
•	Incomplete latch engagement
Include:
•	Cause
•	Effect
•	Severity
•	Detectability
•	Likelihood
•	Existing controls
•	Recommended mitigation
•	Inspection method
•	Abort criterion
________________________________________
10. Bill of Materials
Generate a detailed preliminary BOM divided into:
Purchased engineered components
•	Main support cable
•	Launch support cable
•	Factory-spliced terminations
•	Master delta ring or engineered master-link assembly
•	Crane hook load cell
•	Launch-anchor load cell
•	Brake-anchor load cell
•	Load-cell displays/transmitters
•	Rated shackles
•	Rated swivels
•	Turnbuckles
•	Chain hoists or come-alongs
•	Wire-rope or synthetic slings
•	Chafe guards
•	Protective sleeves
•	Trolley bearings
•	Trolley wheels
•	Overspeed brake components
•	Hydraulic cylinders
•	Hydraulic accumulator
•	Relief valves
•	Flow-control valves
•	Industrial shock absorbers
•	Brake load cell
•	Linear position sensor
•	Wheel-speed encoder
•	IMU
•	GPS receiver
•	Data acquisition system
•	E-stop stations
•	Interlock PLC
•	Control enclosure
•	Cameras
•	Weather station
•	Anemometers
•	Radios
•	Electrical power system
•	Batteries
•	Chargers
•	Winches
•	Fairleads
•	Recovery hardware
•	Launch latch actuator
•	Brake actuator
•	Safety pins
•	Retention lanyards
•	Lighting and warning devices
Fabricated components
•	Master-ring spreader assembly if required
•	Trolley frame
•	Interchangeable payload cradle
•	Brake capture sled
•	Brake-entry funnel
•	Brake anchor frame
•	Launch anchor frame
•	Ecology-block tie frames
•	Winch mounting plate
•	Ground-anchor brackets
•	Load-cell mounting adapters
•	Sensor brackets
•	Guarding
•	Transport racks
•	Storage containers
Civil/site items
•	Ecology blocks
•	Steel ground stakes
•	Helical anchors or engineered soil anchors
•	Crane mats
•	Outrigger mats
•	Site survey markers
•	Barricades
•	Fencing
•	Signs
•	Ground protection
•	Temporary access road materials
Spares and consumables
•	Spare shackles
•	Spare turnbuckles
•	Spare cable sleeves
•	Spare trolley wheels
•	Spare bearings
•	Spare brake pads
•	Hydraulic fluid
•	Spare hoses
•	Load-cell cables
•	Batteries
•	Fasteners
•	Cotter pins
•	Locking pins
•	Inspection paint
•	Rope-cleaning materials
•	Weather covers
For each BOM entry include:
•	Item number
•	Description
•	Function
•	Quantity
•	Preliminary required rating
•	Preferred material
•	Buy versus fabricate
•	Example manufacturer category
•	Estimated unit cost range
•	Estimated extended cost
•	Lead-time category
•	Inspection or certification requirement
•	Criticality
•	Notes
Do not invent exact part numbers unless verified. Clearly mark example manufacturers and products as candidates requiring confirmation.
________________________________________
11. Cost Model
Create a live cost-estimate panel.
Allow the user to set:
•	Budget target
•	Crane rental per day
•	Engineering cost
•	Fabrication labor rate
•	Number of test days
•	Number of trolley configurations
•	Number of payload cradles
•	Anchor configuration
•	Brake concept
•	Instrumentation level
•	Contingency percentage
Display cost categories:
•	Engineering
•	Crane and lift planning
•	Rigging
•	Cable system
•	Anchors
•	Trolley
•	Payload interfaces
•	Brake system
•	Instrumentation
•	Controls
•	Safety equipment
•	Site preparation
•	Transport
•	Spares
•	Contingency
Use a default target budget of $200,000, but show:
•	Minimum prototype
•	Recommended system
•	Fully instrumented system
Warn when the selected configuration exceeds budget.
________________________________________
12. Reports and Export
Provide buttons to export:
•	Complete design summary as PDF
•	Input configuration as JSON
•	Results as CSV
•	BOM as CSV
•	Crane-load summary
•	Anchor-load summary
•	Brake-energy summary
•	Safety/interlock summary
•	Preliminary FMEA
•	Crane-company information sheet
•	Management summary
•	Test-card draft
•	Site-layout SVG or PNG
The crane-company report should prominently display:
•	Crane hook height
•	Required radius
•	Hook-load range
•	Maximum predicted hook load
•	Dynamic amplification assumption
•	Launch and test-line forces
•	Included angle
•	Out-of-plane force
•	Rigging weight
•	Master-ring assembly weight
•	Crane-required working envelope
•	Lift duration
•	Whether crane remains loaded during test
•	Reset approach
•	Wind limit
•	Required engineered lift-plan questions
•	Assumptions requiring crane-company approval
________________________________________
13. User Interface Requirements
Build a professional engineering dashboard.
Layout
•	Header with project title and configuration name
•	Left input panel
•	Center visualization area
•	Right results and warnings panel
•	Bottom charts or expandable tabs
•	Responsive desktop-first design
•	Light engineering color scheme
•	High-contrast warning colors
•	Print-friendly report mode
Tabs
1.	Geometry
2.	Cable
3.	Trolley
4.	Crane
5.	Anchors
6.	Brake
7.	Dynamics
8.	Sway
9.	Safety
10.	BOM
11.	Cost
12.	Reports
Visualization controls
•	Play/pause trolley animation
•	Trolley-position slider
•	Time slider
•	Zoom
•	Pan
•	Reset view
•	Side/front/top-view selector
•	Static/dynamic toggle
•	Loaded/unloaded cable toggle
•	Force-vector toggle
•	Safety-envelope toggle
•	Unit selector
•	Scenario comparison
Scenario presets
Include:
•	60 ft × 300 ft development test
•	100 ft × 500 ft intermediate test
•	200 ft × 1,000 ft full test
•	250 ft × 1,250 ft equivalent-slope test
•	250 ft × 1,500 ft long-span test
•	Custom configuration
________________________________________
14. Technical Implementation
Build the application as a maintainable frontend project.
Preferred stack:
•	React
•	TypeScript
•	Vite
•	SVG and/or HTML5 Canvas
•	Plotly, D3, or another robust chart library
•	Zustand or React Context for application state
•	Zod for input validation
•	Vitest for calculation tests
•	Playwright for basic user-interface tests
Alternative: produce a single self-contained HTML file only if requested, but the primary deliverable should be a structured project.
Required code organization
•	/src/components
•	/src/calculations
•	/src/models
•	/src/visualizations
•	/src/data
•	/src/reports
•	/src/types
•	/src/tests
Separate calculations from display code.
Every engineering calculation must:
•	State units
•	Validate inputs
•	Avoid divide-by-zero and invalid geometry
•	Return warnings
•	Include test cases
•	Expose assumptions
•	Provide intermediate values
Use deterministic calculations. Do not hide engineering formulas in UI components.
________________________________________
15. Validation Tests
Write automated tests for:
•	Unit conversions
•	Straight-line geometry
•	Approach angle
•	Cable-length consistency
•	Parabolic sag
•	Catenary convergence
•	Force-vector addition
•	Included-angle resultant
•	Crane capacity margin
•	Anchor sliding
•	Anchor overturning
•	Trolley gravitational acceleration
•	Drag force
•	Brake energy
•	Stopping distance
•	Pendulum sway
•	Warning thresholds
•	Invalid-input handling
Include benchmark hand calculations in comments or documentation.
________________________________________
16. Deliverables
Produce these deliverables in order:
1.	Assumptions and requirements summary
2.	Architecture comparison
3.	Recommended system architecture
4.	Calculation methodology
5.	Preliminary safety review
6.	Application folder structure
7.	Functional React/TypeScript application
8.	Calculation unit tests
9.	Example scenarios
10.	Preliminary BOM
11.	Cost model
12.	Crane-company data sheet
13.	Management summary
14.	README with installation and use instructions
15.	List of unresolved engineering questions
Do not stop after providing a design narrative. Generate the actual application code.
After generating the application:
1.	Install dependencies.
2.	Run the development build.
3.	Fix compilation errors.
4.	Run tests.
5.	Fix failed tests.
6.	Inspect the displayed application.
7.	Confirm that the side, front, top, force, and brake views render.
8.	Verify that changing height, span, trolley mass, cable properties, sag, wind, and brake stroke updates the results.
9.	Verify that unsafe inputs produce clear warnings.
10.	Provide a final summary of completed features and remaining limitations.
________________________________________
17. Baseline Example Configuration
Load this default configuration on startup:
•	Horizontal main span: 1,000 ft
•	High point: 200 ft
•	Maximum configurable height: 250 ft
•	Total available site length: 1,500 ft
•	Main test-line diameter: 0.5 in
•	Cable material: generic HMPE pending manufacturer confirmation
•	Initial line pretension: 2,500 lbf
•	Trolley mass: 75 lb
•	Test-article mass: 225 lb
•	Total moving mass: 300 lb
•	Payload drop below trolley: 5 ft
•	Target approach angle: approximately 11 degrees
•	Brake zone: 50 ft
•	Capture zone: 20 ft
•	Primary brake: hydraulic progressive capture sled
•	Backup brake: independent energy-absorbing arrestor
•	High-point load cell: 0–20,000 lbf preliminary range
•	Anchor load cells: 0–20,000 lbf preliminary range
•	Brake load cell: 0–20,000 lbf preliminary range
•	Crane capacity: user input required
•	Ecology blocks per ground station: 5
•	Block weight: user input required
•	Ground friction coefficient: 0.5 initial placeholder
•	Steady crosswind: 10 mph
•	Gust: 20 mph
•	Design dynamic amplification factor: 1.5 preliminary
•	Budget target: $200,000
Mark every placeholder that requires field measurement, manufacturer data, or professional approval.
________________________________________
18. Decision Guidance
At the top of the final design report, clearly state:
•	Which architecture is recommended
•	Which trolley is recommended
•	Which brake is recommended
•	Which recovery/reset method is recommended
•	Why those choices are most feasible
•	Which five risks dominate the design
•	Which calculations must be independently verified
•	Which data the crane company must receive
•	Which physical subsystem should be tested first
•	What can be validated with a 60 ft crane
•	What cannot be validated until the full-height test
Favor safe, inspectable, mechanically fail-safe, commercially supportable designs over unnecessarily complex automation.
Critical Modeling Correction — Actual Cable Geometry and Dynamic Load Path
Do not model the main test line as a fixed straight line at an assumed 11-degree angle.
The nominal value of approximately 11.3 degrees applies only to the straight geometric line between a point 200 ft high and a ground point 1,000 ft away:
[
\theta_{\text{nominal}}=\tan^{-1}\left(\frac{200}{1000}\right)
]
This is only a site-layout reference. It is not the actual cable slope seen by the trolley.
The application must calculate the actual cable profile and local slope using:
•	Horizontal anchor separation
•	Ground elevation differences
•	Crane-supported master-node position
•	Unstretched cable length
•	Elastic elongation
•	Initial pretension
•	Cable self-weight
•	Trolley position
•	Trolley and payload weight
•	Aerodynamic loading
•	Crosswind
•	Temperature
•	Cable creep allowance
•	Brake force
•	Dynamic trolley acceleration
•	Movement of the crane-supported master node
•	Anchor compliance
•	Rigging elasticity
Actual cable-profile requirements
For every operating condition, calculate and display:
•	Unloaded cable profile
•	Cable profile with trolley at launch
•	Cable profile with trolley at selected position
•	Cable profile at maximum predicted dynamic displacement
•	Lowest cable point
•	Local cable slope at the trolley
•	Left-side cable angle at the trolley
•	Right-side cable angle at the trolley
•	Cable tension immediately uphill of the trolley
•	Cable tension immediately downhill of the trolley
•	Cable tension at the master node
•	Cable tension at the brake anchor
•	Elastic cable elongation
•	Remaining ground clearance
•	Payload ground-clearance envelope
•	Change in profile caused by temperature, wind, and creep
The trolley’s acceleration shall use the local tangent angle of the calculated cable profile, not the average site angle.
Cable solution hierarchy
Provide three selectable calculation modes:
1. Preliminary parabolic model
Use for rapid early estimates when:
•	Sag is small relative to span
•	Cable slope is moderate
•	Elastic effects are limited
•	Distributed loading is approximately uniform
Display a warning when these assumptions are not satisfied.
2. Elastic catenary model
Use cable self-weight, axial stiffness, unstretched length, support coordinates, and pretension to solve the static cable shape.
Calculate:
•	Horizontal tension component
•	Vertical reactions
•	Total tension along the cable
•	Cable elongation
•	Sag
•	Local slope
•	Support reactions
3. Segmented nonlinear cable model
Use this as the preferred calculation mode for loaded and dynamic cases.
Represent the cable as multiple connected elements or lumped masses with:
•	Axial stiffness
•	Cable mass
•	Gravity
•	Aerodynamic drag
•	Structural damping
•	Trolley point load
•	Payload motion
•	Support constraints
•	Anchor compliance
•	Master-node movement
•	Brake forces
•	Time-dependent trolley position
Allow the user to select numerical resolution, such as:
•	20 cable elements
•	50 cable elements
•	100 cable elements
•	200 cable elements
Display a convergence warning if increasing the element count changes peak load or sag beyond a selected tolerance.
Master-node geometry
The elevated master node supported by the crane must not be treated as automatically fixed directly beneath the crane hook.
Calculate the resultant force from:
•	Launch-side support-line tension
•	Main test-line tension
•	Rigging weight
•	Master-ring weight
•	Load-cell weight
•	Dynamic amplification
•	Out-of-plane wind load
Then calculate:
•	Resultant force magnitude
•	Resultant force direction
•	Horizontal force component
•	Vertical force component
•	Out-of-plane force component
•	Required crane-hook position for a vertical suspension line
•	Actual suspension-line angle
•	Hook offset from the resultant force line
•	Side-load advisory
•	Crane capacity margin
The displayed crane hook and master node must update when geometry or cable tension changes.
Do not assume the launch-side and test-side line tensions are equal when:
•	The lines have different materials
•	The lines have different lengths
•	The trolley is moving
•	The brake is engaged
•	One anchor moves
•	The master node moves
•	Aerodynamic or friction forces are present
Trolley-position load calculation
Provide a position slider from 0% to 100% of the usable main span.
At every trolley position, recalculate:
•	Cable shape
•	Trolley elevation
•	Local cable angle
•	Speed
•	Acceleration
•	Upstream cable tension
•	Downstream cable tension
•	Master-node resultant
•	Crane hook load
•	Launch-anchor reaction
•	Brake-anchor reaction
•	Cable clearance
•	Payload clearance
•	Payload swing
•	Brake-entry energy
The crane load, anchor loads, and cable tension shall update continuously as the trolley moves.
Dynamic simulation correction
Do not estimate dynamic loads solely by multiplying static load by one fixed dynamic factor.
Provide both:
Simplified design-factor mode
Apply a user-selected preliminary dynamic amplification factor to calculated static reactions.
Time-domain dynamic mode
Calculate changing force through the run using numerical time steps.
Include:
•	Gravity acceleration along the local cable tangent
•	Cable elastic response
•	Trolley acceleration
•	Rolling resistance
•	Aerodynamic drag
•	Crosswind
•	Payload pendulum motion
•	Cable lateral motion
•	Brake engagement
•	Brake force ramp
•	Trolley-wheel braking
•	Overspeed governor activation
•	Anchor compliance
•	Master-node movement
•	Structural damping
Report both:
•	Calculated dynamic peak
•	Design load after applying the required engineering safety margin
Clearly distinguish:
•	Predicted load
•	Selected design load
•	Hardware WLL
•	Proof-test load
•	Minimum breaking strength
Front-view sway calculation
The straight-on visualization must calculate lateral movement rather than draw a cosmetic sway curve.
Include:
•	Cable side drag
•	Trolley side area
•	Payload side area
•	Crosswind
•	Gust loading
•	Trolley yaw
•	Suspended payload pendulum motion
•	Cable lateral stiffness
•	Cable damping
•	Offset center of gravity
•	Brake-induced oscillation
•	Master-node lateral displacement
Display:
•	Cable centerline
•	Deflected cable
•	Maximum lateral envelope
•	Payload swing envelope
•	Crane boom plane
•	Resultant force plane
•	Out-of-plane angle
•	Required safety-corridor width
•	Side-load warning
Brake calculation correction
Brake forces must feed back into the entire cable and crane model.
When the trolley enters the brake zone, recalculate:
•	Cable tension
•	Crane hook resultant
•	Anchor reactions
•	Master-node displacement
•	Payload pitch and sway
•	Cable stretch
•	Brake-sled movement
•	Brake-anchor load
•	Backup-catch demand
Do not treat the brake system as an isolated subsystem.
The brake model must include remaining gravitational energy as the trolley continues descending through the stopping distance.
Calculate total energy to dissipate as the combination of:
•	Trolley kinetic energy at brake entry
•	Payload kinetic energy
•	Rotating wheel energy
•	Gravitational potential-energy change through the brake stroke
•	Cable elastic energy released or absorbed
•	Aerodynamic energy losses
•	Rolling-resistance losses
Geometry input correction
Use separate inputs for:
•	Horizontal ground distance
•	Cable unstretched length
•	Crane hook coordinates
•	Master-node coordinates
•	Launch-anchor coordinates
•	Brake-anchor coordinates
•	Ground elevation profile
•	Desired nominal approach angle
•	Desired cable sag
•	Desired pretension
Do not infer cable length solely from horizontal span and height.
Warn when:
•	Specified cable length cannot reach the supports
•	Cable is excessively long for the requested sag
•	Required pretension exceeds the cable or rigging design range
•	Ground clearance becomes negative
•	The trolley encounters an uphill local cable segment
•	The brake zone is located beyond the usable cable profile
•	The master node cannot hang under the crane hook
•	Crane radius must change to align with the resultant
Required visualization labels
In the side view, show both:
•	Nominal geometric chord
•	Calculated cable profile
Use different line styles and label them clearly.
Display:
•	Nominal approach angle
•	Actual local trolley angle
•	Actual loaded cable sag
•	Trolley elevation
•	Minimum ground clearance
•	Current cable tension
•	Current crane resultant
•	Current anchor reactions
This distinction must remain visible so users do not confuse the site geometry with the operating cable geometry.
Scenario comparison
Allow two or more scenarios to be overlaid, including:
•	Different high-point elevations
•	Different spans
•	Different cable lengths
•	Different pretensions
•	Different trolley masses
•	Different payload masses
•	Different wind conditions
•	Different brake settings
•	Different cable materials
•	Different master-node locations
For each comparison show:
•	Cable profile
•	Maximum sag
•	Maximum sway
•	Peak cable tension
•	Peak crane hook load
•	Peak anchor load
•	Peak brake force
•	Maximum trolley speed
•	Required stopping distance
•	Minimum ground clearance
Validation and limitations
Include benchmark tests against:
•	Analytical parabolic cable examples
•	Analytical catenary examples
•	Static point-load cable examples
•	Two-force vector resultant examples
•	Energy-based brake hand calculations
•	Simple pendulum sway calculations
Every result screen and exported report must state:
“This application provides preliminary engineering estimates. Final cable dynamics, crane loads, rigging design, anchors, trolley, braking system, wind limits, and operating procedures require validation by appropriately qualified engineers, crane representatives, rigging personnel, and site-safety authorities.”
# EXECUTION MODE — COMPLETE THE PROJECT, DO NOT ONLY DESCRIBE IT

Treat this as a long-horizon engineering software implementation.

Do not respond with only an architecture proposal, sample snippets, pseudocode,
wireframes, or a partial prototype.

Work through the project in executable phases.

## Phase 1 — Requirements audit

Before writing code:

1. Restate the system architecture you understand.
2. Identify contradictory, physically impossible, underspecified, or unsafe assumptions.
3. Create an assumptions register.
4. Create an unresolved-input register.
5. Separate:
   - user-entered values,
   - manufacturer-verified properties,
   - calculated values,
   - provisional engineering assumptions,
   - values requiring crane-company or professional approval.
6. Do not silently invent missing ratings or manufacturer data.
7. Use conservative placeholders only when necessary and label them prominently.

## Phase 2 — Calculation architecture

Create a calculation dependency map showing how these subsystems interact:

- Site geometry
- Ground elevation
- Cable geometry
- Elastic cable properties
- Trolley position
- Payload dynamics
- Wind and sway
- Master-node equilibrium
- Crane resultant load
- Anchor reactions
- Trolley speed
- Brake engagement
- Brake force
- Cable tension during braking
- Payload swing during braking
- Safety limits
- BOM sizing
- Cost model

Prevent circular calculation errors through an iterative solver where required.

Explain:

- solver inputs,
- unknowns,
- residuals,
- convergence criteria,
- maximum iterations,
- failure handling,
- warning thresholds.

## Phase 3 — Implement the static engineering kernel

Implement and test:

1. Unit conversions
2. Coordinate geometry
3. Nominal chord geometry
4. Parabolic cable model
5. Elastic catenary solver
6. Segmented cable equilibrium model
7. Point-load trolley solution
8. Master-node vector equilibrium
9. Crane resultant calculation
10. Anchor sliding calculation
11. Anchor overturning calculation
12. Cable elongation
13. Ground-clearance calculation

Do not proceed until the calculation tests pass.

## Phase 4 — Implement trolley and dynamic calculations

Implement:

- local cable tangent,
- gravitational force along the cable,
- rolling resistance,
- bearing losses,
- aerodynamic drag,
- crosswind loading,
- speed integration,
- trolley-position integration,
- overspeed control,
- payload pendulum model,
- longitudinal payload swing,
- lateral payload sway,
- cable lateral displacement,
- changing crane load,
- changing anchor reaction.

Use configurable numerical time steps.

Provide warnings for unstable or non-convergent simulations.

## Phase 5 — Implement coupled braking

The brake cannot be calculated separately from the rest of the system.

At every braking time step, update:

- trolley speed,
- trolley position,
- local cable slope,
- cable stretch,
- cable tension,
- anchor reactions,
- crane resultant,
- payload swing,
- brake force,
- brake stroke,
- hydraulic or friction response,
- energy dissipated,
- brake temperature estimate.

Validate conservation of energy within a stated numerical tolerance.

## Phase 6 — Implement the user interface

Create a usable desktop engineering application with:

- input panel,
- results panel,
- warnings panel,
- side elevation,
- front elevation,
- top view,
- force-vector view,
- brake-detail view,
- time-history charts,
- scenario comparison,
- BOM,
- cost estimate,
- FMEA,
- reports.

Inputs must update calculations without requiring a page reload.

The UI must remain responsive during higher-resolution simulations.

Use a Web Worker for expensive numerical calculations if needed.

## Phase 7 — Visual verification

After rendering each view:

1. Inspect the application visually.
2. Check for clipped labels.
3. Check for overlapping dimensions.
4. Check that zoom and pan work.
5. Verify cable sag is drawn to scale.
6. Verify nominal chord and calculated cable are visually distinct.
7. Verify front-view sway is calculated, not decorative.
8. Verify force arrows point in the correct direction.
9. Verify trolley movement follows the calculated cable.
10. Verify brake stroke matches the calculated stopping movement.
11. Verify unsafe conditions are visually obvious.

Correct visual defects before continuing.

## Phase 8 — Engineering validation

Create benchmark cases with hand calculations.

At minimum, validate:

- straight-line distance,
- nominal angle,
- parabolic sag,
- catenary shape,
- equal-tension two-line resultant,
- unequal-tension resultant,
- vector direction,
- kinetic energy,
- potential-energy change,
- stopping distance,
- average brake force,
- anchor sliding,
- overturning,
- simple pendulum period,
- wind drag,
- unit conversion.

For each benchmark, display:

- expected value,
- calculated value,
- percent difference,
- pass/fail tolerance.

## Phase 9 — Scenario verification

Test these scenarios:

### Scenario A
60 ft height and 300 ft span development system.

### Scenario B
100 ft height and 500 ft span intermediate system.

### Scenario C
200 ft height and 1,000 ft span full system.

### Scenario D
250 ft height and 1,250 ft span equivalent nominal slope.

### Scenario E
250 ft height and 1,500 ft long-span system.

For each scenario, report:

- cable length,
- sag,
- pretension,
- minimum ground clearance,
- maximum trolley speed,
- brake-entry speed,
- required stopping distance,
- peak cable tension,
- peak crane load,
- peak anchor load,
- peak brake force,
- maximum payload sway,
- warnings.

## Phase 10 — BOM and procurement logic

The BOM must be generated from calculated design demands.

Do not merely display a fixed shopping list.

For each component:

1. Calculate the preliminary required load rating.
2. Apply the selected design factor.
3. Select a required minimum WLL.
4. Keep WLL distinct from proof load and breaking strength.
5. State whether the item requires:
   - certification,
   - traceability,
   - manufacturer approval,
   - custom engineering,
   - proof testing,
   - periodic inspection.

Never invent certification or availability.

Use “candidate product category” rather than a specific model where current
verified product data is unavailable.

## Phase 11 — Trolley concept selection

Generate and score at least three trolley concepts using a weighted trade study.

Evaluation criteria:

- derailment resistance,
- payload stability,
- brake compatibility,
- wheel loading,
- cable wear,
- construction complexity,
- maintainability,
- portability,
- reset time,
- cost,
- inspectability,
- suitability for up to 300 lb total moving mass.

Output:

- weighted decision matrix,
- recommended concept,
- rationale,
- unresolved engineering risks,
- components to buy,
- components to fabricate,
- prototype test sequence.

## Phase 12 — Brake concept selection

Generate and score:

- hydraulic capture sled,
- industrial shock-absorber bank,
- controlled friction-rope brake,
- eddy-current linear brake.

Evaluate:

- energy capacity,
- peak force,
- stroke,
- repeatability,
- adjustability,
- reset time,
- heat management,
- portability,
- cost,
- failure behavior,
- inspectability,
- procurement risk.

Recommend:

- primary brake,
- backup arrestor,
- final stop,
- overspeed limiter,
- instrumentation.

Provide a preliminary design calculation for the recommended system.

## Phase 13 — Safety deliverables

Generate:

- preliminary hazard analysis,
- FMEA,
- interlock matrix,
- pre-test checklist,
- post-test inspection checklist,
- crane-company data sheet,
- abort criteria,
- weather limits placeholder table,
- rigging inspection register,
- load-cell calibration register,
- test configuration record.

Clearly mark values requiring approval.

## Phase 14 — Reports and exports

Verify that the application can export:

- configuration JSON,
- result CSV,
- BOM CSV,
- calculation report,
- crane-company report,
- anchor report,
- brake report,
- FMEA,
- management summary,
- site-layout graphic.

Exported reports must contain:

- revision,
- date,
- configuration identifier,
- input values,
- assumptions,
- warnings,
- calculated results,
- unresolved items,
- validation disclaimer.

## Phase 15 — Final completion check

Before declaring the project complete:

1. Install all dependencies.
2. Run the application.
3. Run the production build.
4. Run all automated tests.
5. Repair compilation errors.
6. Repair failed tests.
7. Remove placeholder code that blocks core functionality.
8. Check browser console errors.
9. Verify all required views.
10. Verify scenario save/load.
11. Verify exports.
12. Verify unit switching.
13. Verify invalid-input handling.
14. Verify unsafe-condition warnings.
15. Document all known limitations.

Do not claim a calculation is validated unless a corresponding test exists.

# REQUIRED OUTPUT BEHAVIOR

Work autonomously through the phases.

Do not repeatedly ask for permission to proceed.

Ask a question only when progress is impossible without an answer.

When information is missing:

- use a clearly labeled provisional assumption,
- continue implementation,
- record it in the unresolved-input register.

Maintain these project files:

- REQUIREMENTS.md
- ASSUMPTIONS.md
- CALCULATION_METHODS.md
- VALIDATION.md
- SAFETY_LIMITATIONS.md
- PROCUREMENT_NOTES.md
- CHANGELOG.md
- README.md

At the end, provide:

1. Completed functionality
2. Test results
3. Calculation limitations
4. Safety limitations
5. Unresolved engineering decisions
6. Recommended next physical test
7. Exact commands to run the application

________________________________________
# PLATFORM SCOPE EXTENSION (v2, Milestones 6–17)

The specification above defines the CUFTS application and remains the
authoritative requirement set for the **CUFTS fixture template**.

From Milestone 6, TALON is additionally a reusable platform for engineering
analysis, visualization, fixture planning, hardware selection, and test-data
correlation. See [ROADMAP_V2.md](ROADMAP_V2.md) for Milestones 6–17.

## Product goals

TALON shall be able to model a wide variety of mechanical and cable-supported
test fixtures; display anticipated trajectories, clearances, loads, motion,
braking, payload orientation, and fixture behavior to engineers, customers, and
operators; let users build systems from reusable engineering components;
maintain a traceable component library; import manufacturer or supplier data
with source, revision, confidence, and verification status; recommend candidate
hardware from calculated demands; produce a bill of materials and procurement
search sheet; generate customer-facing visualizations and operator test
previews; compare predicted with measured test data; and provide a pathway
toward generalized structural analysis and external finite-element solvers.

Supported system types include cable-supported fixtures, crane-supported
systems, moving trolley systems, suspended payloads, drop fixtures, rail
fixtures, tower-supported systems, tow systems, sensor and seeker test
fixtures, UAS test systems, and other mechanical test arrangements.

TALON remains an engineering planning and analysis platform. It shall never
claim to replace licensed engineering review, crane-company approval, certified
load charts, rigging approval, structural certification, range-safety approval,
or manufacturer data.

## Engineering governance

1. Never describe preliminary analysis as certified or approved.
2. Never mark a result acceptable when required data is missing, a solver
   failed, a model is outside its applicability range, a critical property is
   unverified, a required rating is unknown, a calculated load exceeds a
   rating, or a critical risk is unresolved.
3. Never silently replace missing values with zero.
4. Never silently use example or estimated manufacturer properties as verified.
5. Preserve the original source value separately from any engineering derating.
6. Every calculated result identifies solver, solver version, fidelity level,
   units, coordinate system, assumptions, input sources, verification status,
   convergence status, applicability status, and unresolved limitations.
7. Keep engineering calculations independent from React components.
8. Use SI internally and convert only at defined interfaces.
9. Preserve deterministic and reproducible results.
10. Add analytical benchmarks before declaring a new solver complete.
11. Clearly distinguish reduced-order dynamics from full finite-element
    analysis.
12. Never use online product data as certified without user verification.

## Analysis fidelity levels

Every analysis carries a visible level: **Level 0 Screening**, **Level 1
Preliminary Design**, **Level 2 Advanced Preliminary**, **Level 3 External
Validated Analysis**. Level 3 shall not be claimed unless an external solver
result has actually been imported and identified. The existing TALON v1 solvers
are Level 1.

Every result panel and report shall display analysis level, solver, validation
state, input confidence, applicability, and certification status.

## Generalized project architecture (implemented, M6)

A `Project` contains identity, customer, test program, configuration template,
site, geometry, coordinate systems, materials, components, nodes, elements,
supports, constraints, loads, load cases, load combinations, moving bodies,
analysis cases, analysis runs, risks, assumptions, test data, reports, bill of
materials, revisions, and review status.

**Coordinate systems.** Global, local element, crane, trolley-path, wind,
payload-body, sensor, and customer/range reference. Every vector result states
its coordinate system.

**Nodes** may represent anchors, crane hooks, master rings, trolley positions,
supports, frame joints, sensor points, payload attachment points, brake
attachment points, and ground contact points.

**Elements.** Cable, elastic cable, segmented cable, truss, rigid link, linear
spring, nonlinear spring, viscous damper, point mass, rigid body, pulley or
sheave, brake-force element, contact or stop element, and support element.
Beam, frame, shell-export, and solid-export types are declared for
forward compatibility and export only; TALON does not analyze them.

**Fixture templates** are assemblies of reusable model entities rather than
separate custom solvers. The catalogue is declared with honest status; a
template that is not implemented cannot be instantiated. CUFTS is the first
implemented template and its results are unchanged.

**Immutable analysis runs.** A completed run preserves project, fixture,
scenario and schema revisions, solver version, source commit, component-library
revision, input snapshot, settings, units, coordinate systems, date, author,
results, warnings, applicability, convergence, validation status, risks, and
report revision. A previous analysis report remains reproducible after later
software changes.

## Future finite-element path

The architecture shall support future 2D truss, 2D frame, 3D truss, nonlinear
cable/truss, modal, and transient structural analysis, plus external solver
export and import.

Not implemented initially, and documented as future external-solver
integrations: solid meshing, shell meshing, complex contact, material
plasticity, fracture, and commercial-solver replacement. TALON is a
model-building, load-generation, fixture-configuration, visualization,
traceability, procurement, and reporting front end.
