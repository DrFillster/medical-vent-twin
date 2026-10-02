'use strict';

const { humModSource } = require('./hummod_source_identity.js');

const PROVENANCE_SCHEMA = 'vent-model-provenance/v1';

const PROVENANCE_CLASSES = Object.freeze([
  'HUMMOD_EXACT',
  'HUMMOD_ADAPTED',
  'LITERATURE_DIRECT',
  'LITERATURE_CALIBRATED',
  'ENGINEERING_ASSUMPTION',
  'SCENARIO_AUTHORED',
  'MEASURED_OR_USER_SUPPLIED',
  'DERIVED',
  'UNKNOWN',
]);

const PROVENANCE_KINDS = Object.freeze([
  'variable','constant','equation','condition','transition',
  'boundary','topology','interpolation','scenario',
]);

function record(value) {
  return Object.freeze({ clinicalValidation: false, dependsOn: Object.freeze([]), ...value });
}

const MODEL_PROVENANCE = Object.freeze({
  'live.thorax.reference_pleural_pressure': record({
    id:'live.thorax.reference_pleural_pressure', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION',
    module:'clinical_twin_live_hummod_session.js',
    symbol:'LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.referencePleuralPressureCmH2O',
    description:'Reference pleural pressure for the live synthetic aspiration case.',
    source:Object.freeze([{type:'project',statement:'Explicit synthetic phase-1 thorax boundary; not inferred from Berlin severity or recruitability.'}]),
  }),
  'live.thorax.chest_wall_elastance_fraction': record({
    id:'live.thorax.chest_wall_elastance_fraction', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION',
    module:'clinical_twin_live_hummod_session.js',
    symbol:'LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.chestWallElastanceFraction',
    description:'Fraction of passive respiratory-system elastance assigned to the chest wall.',
    source:Object.freeze([{type:'project',statement:'Explicit synthetic phase-1 thorax boundary.'}]),
  }),
  'live.metabolism.tissue_o2_use': record({
    id:'live.metabolism.tissue_o2_use', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION',
    module:'clinical_twin_live_hummod_session.js',
    symbol:'LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.systemic.tissueO2UseMlPerMin',
    description:'Whole-body oxygen-use boundary for the reduced acute gas core.',
    source:Object.freeze([{type:'project',statement:'Fixed phase-1 metabolic boundary; full HumMod tissue metabolism is not running.'}]),
  }),
  'hummod.breathing.dead_space_equation': record({
    id:'hummod.breathing.dead_space_equation', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_breathing.js',
    symbol:'humModLegacyDeadSpaceMl',
    description:'DeadSpace = 0.20 * TidalVolume + 60 mL.',
    source:Object.freeze([humModSource('Structure/Lungs/Breathing.DES','Breathing.DeadSpace')]),
  }),
  'hummod.bronchi.water_vapor_pressure': record({
    id:'hummod.bronchi.water_vapor_pressure', kind:'constant',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_breathing.js',
    symbol:'BRONCHI_VAPOR_PRESSURE_MMHG',
    description:'Bronchial saturated water-vapor pressure boundary.',
    source:Object.freeze([humModSource('Structure/Lungs/Bronchi.DES','Bronchi.VaporPressure')]),
  }),
  'hummod.hemoglobin.p50_model': record({
    id:'hummod.hemoglobin.p50_model', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_chemistry.js',
    symbol:'hemoglobinProperties',
    description:'HumMod hemoglobin P50 response to temperature, pH, PCO2, and carboxyhemoglobin.',
    source:Object.freeze([humModSource('Structure/Hemoglobin/HgbProps.DES','HgbProps.Setup')]),
  }),
  'hummod.acid_base.ph_sid_pco2': record({
    id:'hummod.acid_base.ph_sid_pco2', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_chemistry.js',
    symbol:'phFromPco2Sid',
    description:'HumMod pH relation using pK + log10(SID/PCO2) with source boundary cases.',
    source:Object.freeze([humModSource('Structure/AcidBase/PhGeneral.DES','PhGeneral.Calc')]),
  }),
  'hummod.pulmonary_membrane.interpolation': record({
    id:'hummod.pulmonary_membrane.interpolation', kind:'interpolation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_core_pulmonary_membrane.js',
    symbol:'hermiteSegment',
    description:'Piecewise cubic Hermite interpolation across HumMod pulmonary-membrane recruitment points/slopes.',
    source:Object.freeze([
      humModSource('Structure/Lungs/PulmonaryMembrane.DES','PulmonaryMembrane.Recruitment'),
      {type:'project',statement:'Interpolation algorithm is a browser implementation choice because the DES runtime interpolation was not independently reproduced.'},
    ]),
  }),
  'vent.mechanics.elastic_pressure_law': record({
    id:'vent.mechanics.elastic_pressure_law', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'compartments.js',
    symbol:'elasticPressureAboveAOP',
    description:'Finite-capacity exponential compartment elastic recoil law.',
    source:Object.freeze([{type:'project',statement:'Purpose-built Vent mechanical constitutive law; not derived from HumMod.'}]),
  }),
  'vent.recruitment.open_close_kinetics': record({
    id:'vent.recruitment.open_close_kinetics', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'recruitment.js',
    symbol:'recruitmentRate',
    description:'Bounded opening/closing recruitment kinetics with dead band.',
    source:Object.freeze([{type:'project',statement:'Purpose-built stateful recruitment kinetics; not a direct Chen R/I or HumMod equation.'}]),
  }),
  'vent.recruitment.condition.open': record({
    id:'vent.recruitment.condition.open', kind:'condition',
    class:'ENGINEERING_ASSUMPTION', module:'recruitment.js',
    symbol:'pDist > P_open',
    description:'Recruitment opening branch.',
    source:Object.freeze([{type:'project',statement:'Engineering branch condition; phenotype P_open is separately provenance-tagged.'}]),
  }),
  'vent.recruitment.condition.close': record({
    id:'vent.recruitment.condition.close', kind:'condition',
    class:'ENGINEERING_ASSUMPTION', module:'recruitment.js',
    symbol:'pDist < P_close',
    description:'Derecruitment closing branch.',
    source:Object.freeze([{type:'project',statement:'Engineering branch condition; phenotype P_close is separately provenance-tagged.'}]),
  }),
  'hummod.gas_exchange.oxygen_runtime': record({
    id:'hummod.gas_exchange.oxygen_runtime', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_core_gas_exchange.js',
    symbol:'reduced pulmonary O2 exchange runtime',
    description:'Reduced browser execution of source-aligned HumMod oxygen transport/exchange equations.',
    source:Object.freeze([
      humModSource('Structure/Lungs/LungO2.DES','LungO2'),
      {type:'project',statement:'Runtime topology, solver numerics, and Vent-derived perfusion/recruitment boundaries are adapted for browser execution.'},
    ]),
  }),
  'hummod.gas_exchange.co2_runtime': record({
    id:'hummod.gas_exchange.co2_runtime', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_core_gas_exchange.js',
    symbol:'reduced pulmonary CO2 exchange runtime',
    description:'Reduced browser execution of source-aligned HumMod carbon-dioxide transport/exchange equations.',
    source:Object.freeze([
      humModSource('Structure/Lungs/LungCO2.DES','LungCO2'),
      {type:'project',statement:'Runtime topology and numerical execution are adapted for browser execution.'},
    ]),
  }),
  'hummod.hemodynamics.vascular_primitives': record({
    id:'hummod.hemodynamics.vascular_primitives', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_hemodynamics.js',
    symbol:'VASCULAR_DEFAULTS/stressedVolumePressure/conductanceFlow',
    description:'Source-preserved vascular V0/compliance/conductance constants and pressure/flow primitives.',
    source:Object.freeze([humModSource('Structure/VascularCompartments','SystemicArtys/SystemicVeins/RightAtrium/PulmArty/PulmCapys/PulmVeins/LeftAtrium')]),
  }),
  'hummod.hemodynamics.ventricular_pump': record({
    id:'hummod.hemodynamics.ventricular_pump', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_hemodynamics.js',
    symbol:'ventricularPump/PUMP_DEFAULTS',
    description:'Source-preserved right/left ventricular diastolic/systolic pressure-volume and stroke-volume equations.',
    source:Object.freeze([humModSource('Structure/RightHeartPumping and Structure/LeftHeartPumping','Diastole/Systole/Pumping')]),
  }),
  'live.circulation.reference_boundaries': record({
    id:'live.circulation.reference_boundaries', kind:'boundary',
    class:'HUMMOD_ADAPTED', module:'clinical_twin_live_hummod_session.js',
    symbol:'LIVE_HUMMOD_ENGINEERING_BOUNDARIES.circulation',
    description:'Reference-case initial volumes, heart rate, conductances, and pump multipliers used to initialize the reduced circulation.',
    source:Object.freeze([
      humModSource('Structure/VascularCompartments','source initial volumes/conductances where available'),
      {type:'project',statement:'Systemic venous initial volume and reduced-network boundary composition are adapted engineering boundaries.'},
    ]),
  }),
  'live.gas.reference_boundaries': record({
    id:'live.gas.reference_boundaries', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION', module:'clinical_twin_live_hummod_session.js',
    symbol:'LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas',
    description:'Reference systemic metabolic, pulmonary, blood, and environmental boundaries for the reduced gas runtime.',
    source:Object.freeze([{type:'project',statement:'Explicit reference-case boundaries; individual HumMod-derived constants retain their own source records where applicable.'}]),
  }),
  'thorax.static_elastance_partition': record({
    id:'thorax.static_elastance_partition', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_core_thorax.js',
    symbol:'dPpl = dPaw * Ecw/Ers',
    description:'Passive quasi-static partition of airway-pressure change into pleural and transpulmonary components.',
    source:Object.freeze([{type:'project',statement:'Physiologically motivated reduced coupling relation; not a source-preserved HumMod thorax subsystem.'}]),
    dependsOn:Object.freeze(['live.thorax.chest_wall_elastance_fraction','live.thorax.reference_pleural_pressure']),
  }),
  'circulation.reduced_topology': record({
    id:'circulation.reduced_topology', kind:'topology',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_core_circulation.js',
    symbol:'createHumModArdsCirculation',
    description:'Seven-compartment closed-loop circulation using HumMod vascular/pump primitives with organ beds lumped into effective conductances.',
    source:Object.freeze([
      humModSource('Structure/VascularCompartments','vascular compartments'),
      {type:'project',statement:'Detailed organ circulations are reduced/lumped for the browser runtime.'},
    ]),
  }),
  'circulation.integration_substep': record({
    id:'circulation.integration_substep', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_core_circulation.js',
    symbol:'maxSubstepSec',
    description:'Maximum Euler integration substep used by the reduced circulation.',
    source:Object.freeze([{type:'project',statement:'Numerical integration choice for browser stability; not a HumMod physiological constant.'}]),
  }),
  'circulation.mass_balance_derivatives': record({
    id:'circulation.mass_balance_derivatives', kind:'equation',
    class:'DERIVED', module:'hummod_ards_core_circulation.js',
    symbol:'derivative',
    description:'Compartment volume derivatives from inflow minus outflow.',
    source:Object.freeze([{type:'project',statement:'Conservation-law bookkeeping over the reduced topology.'}]),
    dependsOn:Object.freeze(['circulation.reduced_topology']),
  }),
  'circulation.negative_forward_flow_failure': record({
    id:'circulation.negative_forward_flow_failure', kind:'condition',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_core_circulation.js',
    symbol:'pump.bloodFlowMlPerMin < 0',
    description:'Treat negative source-pump forward flow as entry into a nonphysical domain and expose zero forward flow plus mechanicalPumpFailure.',
    source:Object.freeze([{type:'project',statement:'Safety/terminal-state adaptation; native HumMod pump algebra is preserved as raw output but does not define this clamp.'}]),
  }),
  'circulation.svr_derived': record({
    id:'circulation.svr_derived', kind:'equation',
    class:'DERIVED', module:'hummod_ards_core_circulation.js',
    symbol:'systemicVascularResistanceMmHgMinPerL',
    description:'Derived systemic resistance from arterial-venous pressure difference divided by systemic outflow.',
    source:Object.freeze([{type:'project',statement:'Deterministic derived reporting quantity.'}]),
    dependsOn:Object.freeze(['circulation.reduced_topology']),
  }),
  'circulation.pvr_derived': record({
    id:'circulation.pvr_derived', kind:'equation',
    class:'DERIVED', module:'hummod_ards_core_circulation.js',
    symbol:'pulmonaryVascularResistanceMmHgMinPerL',
    description:'Derived pulmonary resistance from pulmonary arterial-capillary pressure difference divided by pulmonary arterial outflow.',
    source:Object.freeze([{type:'project',statement:'Deterministic derived reporting quantity.'}]),
    dependsOn:Object.freeze(['circulation.reduced_topology']),
  }),
  'oxygen_supply.delivery_equation': record({
    id:'oxygen_supply.delivery_equation', kind:'equation',
    class:'DERIVED', module:'hummod_ards_oxygen_supply_cliff.js',
    symbol:'oxygenDeliveryMlPerMin',
    description:'Oxygen delivery as cardiac output multiplied by arterial oxygen content.',
    source:Object.freeze([{type:'physiology',statement:'Standard oxygen-delivery identity used as a deterministic derived relation.'}]),
  }),
  'oxygen_supply.critical_delivery_equation': record({
    id:'oxygen_supply.critical_delivery_equation', kind:'equation',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_oxygen_supply_cliff.js',
    symbol:'criticalOxygenDeliveryMlPerMin',
    description:'Critical oxygen delivery inferred from requested VO2 divided by the calibrated critical extraction ratio.',
    source:Object.freeze([{type:'literature',citation:'Ward ME. Anesthesiology. 1996;85:817-822.',role:'critical extraction anchors; project applies them as a bounded reduced-order DO2/VO2 relation'}]),
    dependsOn:Object.freeze(['oxygen_supply.critical_extraction_curve']),
  }),
  'oxygen_supply.condition.supply_dependent': record({
    id:'oxygen_supply.condition.supply_dependent', kind:'condition',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_oxygen_supply_cliff.js',
    symbol:'oxygenSupplyDeficitMlPerMin > numerical tolerance',
    description:'Numerical condition flagging supply-dependent oxygen consumption.',
    source:Object.freeze([{type:'project',statement:'Numerical classification around the reduced DO2/VO2 relation.'}]),
    dependsOn:Object.freeze(['oxygen_supply.critical_delivery_equation']),
  }),
  'decompensation.low_svo2_marker': record({
    id:'decompensation.low_svo2_marker', kind:'boundary',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_decompensation_controller.js',
    symbol:'LOW_SVO2_SHOCK_MARKER_FRACTION',
    description:'Low mixed-venous O2 saturation warning marker used by the educational shock-state classifier.',
    source:Object.freeze([{type:'literature',citation:'Critical oxygen-delivery literature summarized in module comments.',role:'engineering marker selected within a reported depleted-extraction range; not a universal clinical threshold'}]),
  }),
  'decompensation.organ_flow_map_marker': record({
    id:'decompensation.organ_flow_map_marker', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_decompensation_controller.js',
    symbol:'ORGAN_FLOW_RISK_MAP_MMHG',
    description:'MAP marker used to enter the compensated-shock teaching state.',
    source:Object.freeze([{type:'project',statement:'Educational state-classification marker; not a validated mortality threshold.'}]),
  }),
  'decompensation.oxygen_debt_integral': record({
    id:'decompensation.oxygen_debt_integral', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_decompensation_controller.js',
    symbol:'oxygenDebtMl += oxygenSupplyDeficitMlPerMin * dtSec / 60',
    description:'Integral of unmet requested aerobic oxygen demand.',
    source:Object.freeze([{type:'project',statement:'Transparent reduced-order injury state based on cumulative unmet VO2.'}]),
  }),
  'decompensation.debt_calibration_minutes': record({
    id:'decompensation.debt_calibration_minutes', kind:'boundary',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_decompensation_controller.js',
    symbol:'COLLAPSE_CALIBRATION_EQUIVALENT_DEBT_MIN',
    description:'Equivalent oxygen-debt time used to normalize severe-shock injury.',
    source:Object.freeze([{type:'literature',citation:'Navarro e Lima et al. J Trauma Acute Care Surg. 2012.',role:'porcine hemorrhagic-collapse timing anchor; not a human survival prediction'}]),
  }),
  'decompensation.myocardial_floor': record({
    id:'decompensation.myocardial_floor', kind:'boundary',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_decompensation_controller.js',
    symbol:'MYOCARDIAL_CONTRACTILITY_FLOOR',
    description:'Severe-shock myocardial contractility floor from experimental elastance ratio.',
    source:Object.freeze([{type:'literature',citation:'Kimmoun et al. Anesthesiology. 2013.',role:'experimental severe shock/lactic-acidosis elastance anchor'}]),
  }),
  'decompensation.condition.map30_duration': record({
    id:'decompensation.condition.map30_duration', kind:'condition',
    class:'LITERATURE_DIRECT', module:'hummod_ards_decompensation_controller.js',
    symbol:'MAP < 30 mmHg for 10 min',
    description:'Experimental cardiovascular-collapse condition.',
    source:Object.freeze([{type:'literature',citation:'Gomez et al. collapse criterion as documented in module comments.',role:'experimental collapse definition'}]),
  }),
  'decompensation.asphyxial_anchor': record({
    id:'decompensation.asphyxial_anchor', kind:'boundary',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_decompensation_controller.js',
    symbol:'ASPHYXIAL_COLLAPSE_ANCHOR',
    description:'Experimental canine asphyxia timing/gas landmarks used to calibrate a reduced asphyxial-collapse clock.',
    source:Object.freeze([{type:'literature',citation:'DeBehnke et al. Resuscitation. 1995;30:169-175.',role:'experimental timing/gas anchor; project constructs the burden interpolation'}]),
  }),
  'decompensation.stage_classifier': record({
    id:'decompensation.stage_classifier', kind:'transition',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_decompensation_controller.js',
    symbol:'classifyStage',
    description:'Educational stable/compensated/oxygen-debt/decompensated/refractory/arrest state machine.',
    source:Object.freeze([{type:'project',statement:'Project-authored teaching-state classifier; not a clinical shock score.'}]),
    dependsOn:Object.freeze(['decompensation.low_svo2_marker','decompensation.organ_flow_map_marker','decompensation.debt_calibration_minutes']),
  }),
  'ards.phenotype.baseline': record({
    id:'ards.phenotype.baseline', kind:'scenario',
    class:'SCENARIO_AUTHORED', module:'presets.js',
    symbol:'presetBaseline',
    description:'Baseline three-compartment mechanics/perfusion/dead-space/AOP parameter set.',
    source:Object.freeze([{type:'project',statement:'Synthetic mechanical teaching phenotype; not fitted patient data.'}]),
  }),
  'ards.phenotype.low_recruitability': record({
    id:'ards.phenotype.low_recruitability', kind:'scenario',
    class:'SCENARIO_AUTHORED', module:'presets.js',
    symbol:'presetPhenotypeLowRecruitability',
    description:'Low-recruitability authored mechanics/perfusion/dead-space/AOP parameter set.',
    source:Object.freeze([{type:'project',statement:'Synthetic mechanical teaching phenotype; not fitted patient data.'}]),
  }),
  'ards.phenotype.moderate_recruitability': record({
    id:'ards.phenotype.moderate_recruitability', kind:'scenario',
    class:'SCENARIO_AUTHORED', module:'presets.js',
    symbol:'presetPhenotypeModerateRecruitability',
    description:'Moderate-recruitability authored mechanics/perfusion/dead-space/AOP parameter set.',
    source:Object.freeze([{type:'project',statement:'Synthetic mechanical teaching phenotype; not fitted patient data.'}]),
  }),
  'ards.phenotype.high_recruitability': record({
    id:'ards.phenotype.high_recruitability', kind:'scenario',
    class:'SCENARIO_AUTHORED', module:'presets.js',
    symbol:'presetPhenotypeHighRecruitability',
    description:'High-recruitability authored mechanics/perfusion/dead-space/AOP parameter set.',
    source:Object.freeze([{type:'project',statement:'Synthetic mechanical teaching phenotype; not fitted patient data.'}]),
  }),
  'vent.recruitment.defaults': record({
    id:'vent.recruitment.defaults', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION', module:'recruitment.js',
    symbol:'OPEN_DEFAULT/CLOSE_DEFAULT/K_OPEN_DEFAULT/K_CLOSE_DEFAULT',
    description:'Fallback opening/closing pressures and kinetic coefficients.',
    source:Object.freeze([{type:'project',statement:'Engineering defaults used only when phenotype-specific recruitment parameters are absent.'}]),
  }),
  'vent.recruitment.feasibility_projection': record({
    id:'vent.recruitment.feasibility_projection', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'recruitment.js',
    symbol:'stepRecruitmentWithFloor',
    description:'Projection preserving finite-capacity volume feasibility during derecruitment.',
    source:Object.freeze([{type:'project',statement:'Numerical/physical invariant rule preventing silent destruction of trapped elastic gas volume.'}]),
  }),
  'autonomic.v12.sympathetic_vascular_components': record({
    id:'autonomic.v12.sympathetic_vascular_components', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_vascular_sympathetic_source_aligned.js',
    symbol:'organ-bed alpha-receptor sympathetic conductance components',
    description:'Source-aligned sympathetic conductance multipliers for visceral/other, skeletal-muscle, and cardiac vascular beds. Diagnostic only; not treated as full systemic vascular conductance because local PO2, ADH, angiotensin, metabolic, viscosity, skin, kidney, and brain controls remain outside this reduced component.',
    source:Object.freeze([
      humModSource('Structure/GITract/GITract-Flow.DES','SympsOnConductance'),
      humModSource('Structure/OtherTissue/OtherTissue-Flow.DES','SympsOnConductance'),
      humModSource('Structure/SkeletalMuscle/SkeletalMuscle-Flow.DES','SympsOnConductance'),
      humModSource('Structure/LeftHeart/LeftHeart-Flow.DES','SympsOnConductance'),
      humModSource('Structure/RightHeart/RightHeart-Flow.DES','SympsOnConductance'),
      {type:'project',statement:'Reduced module exposes component multipliers only and deliberately does not aggregate them into full SVR.'},
    ]),
    dependsOn:Object.freeze(['autonomic.v12.baroreflex_source','autonomic.v12.catecholamine_pools']),
  }),
  'autonomic.v12.ecfv_boundary': record({
    id:'autonomic.v12.ecfv_boundary', kind:'boundary',
    class:'HUMMOD_ADAPTED', module:'hummod_native_reduced_calibration.js',
    symbol:'ECFV.Vol -> catecholamineEcfvMl',
    description:'Explicit extracellular-fluid-volume boundary required to convert HumMod catecholamine pool mass to concentration. Native ECFV is used when present; no synthetic default is permitted.',
    source:Object.freeze([
      humModSource('Structure/H2O/ECFV.DES','ECFV.Vol'),
      {type:'project',statement:'Reduced live runtime imports ECFV as an external boundary instead of executing the full body-water subsystem.'},
    ]),
  }),
  'autonomic.v12.catecholamine_pools': record({
    id:'autonomic.v12.catecholamine_pools', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_catecholamines_source_aligned.js',
    symbol:'NEPool/EpiPool + secretion/clearance + AlphaPool/BetaPool',
    description:'Source-aligned acute NE/Epi pool dynamics and alpha/beta humoral effects with explicit ECFV and fixed-ECFV backward-Euler reduced stepping.',
    source:Object.freeze([
      humModSource('Structure/Nerves/AdrenalNerve.DES','AdrenalNerve.NA(Hz)'),
      humModSource('Structure/Catechols/NESecretion.DES','Rate/Spillover'),
      humModSource('Structure/Catechols/EpiSecretion.DES','Rate'),
      humModSource('Structure/Catechols/NEPool.DES','Mass/[NE]'),
      humModSource('Structure/Catechols/EpiPool.DES','Mass/[Epi]'),
      humModSource('Structure/Catechols/NEClearance.DES','Rate'),
      humModSource('Structure/Catechols/EpiClearance.DES','Rate'),
      humModSource('Structure/Catechols/AlphaPool.DES','Effect'),
      humModSource('Structure/Catechols/BetaPool.DES','Effect'),
      {type:'project',statement:'Uses analytic linear backward-Euler pool update with ECFV held fixed over each coupled step; midodrine branch omitted.'},
    ]),
    dependsOn:Object.freeze(['autonomic.v12.ecfv_boundary','autonomic.v12.baroreflex_source']),
  }),
  'autonomic.v12.low_pressure_receptors': record({
    id:'autonomic.v12.low_pressure_receptors', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_autonomic_source_aligned.js',
    symbol:'LowPressureReceptors.NA -> SympsCNS.LowPressureEffect',
    description:'HumMod low-pressure receptor pathway driven by mean right/left atrial transmural pressure. Source delay semantics preserve RateConst=1/(1440*Tau), Tau=30, interpreted on the minute-based HumMod timebase.',
    source:Object.freeze([
      humModSource('Structure/Nerves/LowPressureReceptors.DES','LowPressureReceptors.NA'),
      humModSource('Structure/Nerves/SympsCNS.DES','LowPressureEffect/ReflexNA'),
      humModSource('Structure/VascularCompartments/RightAtrium.DES','RightAtrium.TMP'),
      humModSource('Structure/VascularCompartments/LeftAtrium.DES','LeftAtrium.TMP'),
    ]),
    dependsOn:Object.freeze(['autonomic.v12.baroreflex_source']),
  }),
  'autonomic.v12.baroreflex_source': record({
    id:'autonomic.v12.baroreflex_source', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_autonomic_source_aligned.js',
    symbol:'Baroreflex + SympsCNS acute subset',
    description:'HumMod baroreflex adaptation/pressure-effect and CNS baroreflex mapping with source minute-based delay semantics preserved; non-baroreflex additive CNS inputs remain neutral in the acute ventilator slice.',
    source:Object.freeze([
      humModSource('Structure/Nerves/Baroreflex.DES','Baroreflex'),
      humModSource('Structure/Nerves/SympsCNS.DES','BaroEffect/NA(Hz)'),
      {type:'project',statement:'ExerciseSymps, CushingResponse, brain fuel/function, A2Pool, and CNSTrophicFactor remain neutralized in this acute subset.'},
    ]),
  }),
  'autonomic.v12.vagus_source': record({
    id:'autonomic.v12.vagus_source', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_autonomic_source_aligned.js',
    symbol:'VagusNerve.NA(Hz)',
    description:'HumMod vagal firing-rate response to SympsCNS firing rate, with no vagal block or clamp applied.',
    source:Object.freeze([humModSource('Structure/Nerves/VagusNerve.DES','VagusNerve.NA(Hz)')]),
  }),
  'autonomic.v12.sa_node_source': record({
    id:'autonomic.v12.sa_node_source', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_autonomic_source_aligned.js',
    symbol:'SANode-Rate.Rate',
    description:'HumMod SA-node parasympathetic and beta-receptor sympathetic chronotropy. Dynamic HumMod beta-pool effect is used when ECFV-backed catecholamine state is available; otherwise an explicit normalized humoral fallback is used.',
    source:Object.freeze([
      humModSource('Structure/Heart/SANode-Rate.DES','SANode-Rate.Rate'),
      humModSource('Structure/Heart/SANode-BetaReceptors.DES','SANode-BetaReceptors.Activity'),
    ]),
  }),
  'autonomic.v12.ventricular_beta_source': record({
    id:'autonomic.v12.ventricular_beta_source', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_autonomic_source_aligned.js',
    symbol:'ventricularBetaActivity',
    description:'HumMod ventricular beta-receptor agonism used as the contractility multiplier. Dynamic HumMod beta-pool effect is used when ECFV-backed catecholamine state is available; otherwise an explicit normalized humoral fallback is used.',
    source:Object.freeze([
      humModSource('Structure/LeftHeart/LeftHeart-BetaReceptors.DES','Activity'),
      humModSource('Structure/RightHeart/RightHeart-BetaReceptors.DES','Activity'),
      humModSource('Structure/LeftHeartPumping/LeftHeartPumping-Systole.DES','Contractility'),
    ]),
  }),
  'autonomic.v12.venous_alpha_source': record({
    id:'autonomic.v12.venous_alpha_source', kind:'equation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_autonomic_source_aligned.js',
    symbol:'SystemicVeins.V0',
    description:'HumMod systemic venous alpha-receptor activity and V0 alpha-effect curve. Dynamic HumMod alpha-pool effect is used when ECFV-backed catecholamine state is available; otherwise an explicit normalized humoral fallback is used; A2 effect remains neutralized.',
    source:Object.freeze([
      humModSource('Structure/Nerves/SystemicVeins-AlphaReceptors.DES','Activity'),
      humModSource('Structure/VascularCompartments/SystemicVeins.DES','V0_Alpha_Effect/V0'),
    ]),
  }),
  'autonomic.target_map': record({
    id:'autonomic.target_map', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'targetMapMmHg',
    description:'Default MAP target driving the reduced baroreflex controller.',
    source:Object.freeze([{type:'project',statement:'Locally selected control target for the reduced browser controller; not a HumMod-preserved set point.'}]),
  }),
  'autonomic.autonomic_tau': record({
    id:'autonomic.autonomic_tau', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'autonomicTauSec',
    description:'First-order lag time constant for sympathetic and parasympathetic tone.',
    source:Object.freeze([{type:'project',statement:'Locally authored controller time constant.'}]),
  }),
  'autonomic.vascular_tau': record({
    id:'autonomic.vascular_tau', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'vascularTauSec',
    description:'First-order lag time constant for vascular responses.',
    source:Object.freeze([{type:'project',statement:'Locally authored controller time constant.'}]),
  }),
  'autonomic.cardiac_tau': record({
    id:'autonomic.cardiac_tau', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'cardiacTauSec',
    description:'First-order lag time constant for chronotropic/inotropic responses.',
    source:Object.freeze([{type:'project',statement:'Locally authored controller time constant.'}]),
  }),
  'autonomic.hypoxic_drive_curve': record({
    id:'autonomic.hypoxic_drive_curve', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'hypoxicDrive = clamp((70 - PaO2) / 45, 0, 1)',
    description:'Reduced chemoreflex hypoxemia drive.',
    source:Object.freeze([{type:'project',statement:'Locally authored transfer function; not a source-preserved HumMod chemoreflex.'}]),
  }),
  'autonomic.hypercapnic_drive_curve': record({
    id:'autonomic.hypercapnic_drive_curve', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'hypercapnicDrive = clamp((PaCO2 - 45) / 35, 0, 1)',
    description:'Reduced chemoreflex hypercapnia drive before HCA calibration terms.',
    source:Object.freeze([{type:'project',statement:'Locally authored transfer function; separate from the literature-calibrated HCA anchor.'}]),
  }),
  'autonomic.reflex_target_equation': record({
    id:'autonomic.reflex_target_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'reflexTarget',
    description:'Weighted MAP, hypoxemia, and hypercapnia drive used as sympathetic target.',
    source:Object.freeze([{type:'project',statement:'Locally authored control equation and weights.'}]),
    dependsOn:Object.freeze(['autonomic.baroreflex_gain','autonomic.hypoxic_drive_curve','autonomic.hypercapnic_drive_curve']),
  }),
  'autonomic.parasympathetic_target_equation': record({
    id:'autonomic.parasympathetic_target_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'parasympathetic target',
    description:'Inverse reduced relation between sympathetic and parasympathetic tone.',
    source:Object.freeze([{type:'project',statement:'Locally authored relation and bounds.'}]),
  }),
  'autonomic.reflex_hr_equation': record({
    id:'autonomic.reflex_hr_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'reflexHrTarget',
    description:'Chronotropic response to sympathetic and parasympathetic tone.',
    source:Object.freeze([{type:'project',statement:'Locally authored chronotropic coefficients and HR bounds.'}]),
  }),
  'autonomic.contractility_equation': record({
    id:'autonomic.contractility_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'contractilityTarget',
    description:'Catecholamine-driven contractility multiplier and bounds.',
    source:Object.freeze([{type:'project',statement:'Locally authored inotropic transfer function; direct acidotic depression is separately literature-calibrated.'}]),
  }),
  'autonomic.systemic_conductance_equation': record({
    id:'autonomic.systemic_conductance_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'reflexArterialConductanceTarget',
    description:'Sympathetic systemic arterial conductance response.',
    source:Object.freeze([{type:'project',statement:'Locally authored vascular transfer function.'}]),
  }),
  'autonomic.venous_v0_equation': record({
    id:'autonomic.venous_v0_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'venousV0Target',
    description:'Sympathetic reduction in effective systemic venous unstressed volume.',
    source:Object.freeze([{type:'project',statement:'Locally authored venoconstriction rule and 14% coefficient.'}]),
  }),
  'autonomic.pulmonary_load_equation': record({
    id:'autonomic.pulmonary_load_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'pulmonaryLoad',
    description:'Pulmonary vascular load from positive thoracic pressure and hypoxemia.',
    source:Object.freeze([{type:'project',statement:'Locally authored pressure/hypoxemia transfer function; HCA multiplier is separately literature-calibrated.'}]),
  }),
  'autonomic.respiratory_acidosis_inotropy': record({
    id:'autonomic.respiratory_acidosis_inotropy', kind:'interpolation',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_autonomic_controller.js',
    symbol:'respiratoryAcidosisContractilityMultiplier',
    description:'Bounded interpolation of direct myocardial depression from respiratory acidosis.',
    source:Object.freeze([{type:'literature',citation:'Biais et al. Anesthesiology. 2012;117:1212-1222.',role:'isolated myocardial-force challenge anchor; interpolation and bounds are project-authored'}]),
  }),
  'autonomic.baroreflex_gain': record({
    id:'autonomic.baroreflex_gain', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'baroreflexGain',
    description:'Gain converting MAP error into reduced sympathetic-drive target.',
    source:Object.freeze([{type:'project',statement:'Locally authored control gain; controller is inspired by HumMod architecture but not a HumMod subsystem.'}]),
  }),
  'autonomic.hypercapnic_acidosis_anchor': record({
    id:'autonomic.hypercapnic_acidosis_anchor', kind:'boundary',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_autonomic_controller.js',
    symbol:'HYPERCAPNIC_ACIDOSIS_ANCHOR',
    description:'Experimental HCA anchor used to calibrate HR/SVR/PVR response.',
    source:Object.freeze([{type:'literature',citation:'Stengl et al. Critical Care. 2013;17:R303.',role:'experimental challenge anchor; project interpolation is not asserted as a universal human response'}]),
  }),
  'oxygen_supply.critical_extraction_curve': record({
    id:'oxygen_supply.critical_extraction_curve', kind:'interpolation',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_oxygen_supply_cliff.js',
    symbol:'criticalExtractionRatioForPaco2',
    description:'Bounded interpolation of critical oxygen-extraction ratio across published hypercapnia anchors.',
    source:Object.freeze([{type:'literature',citation:'Ward ME. Anesthesiology. 1996;85:817-822.',role:'experimental oxygen-transport anchors; interpolation is project-authored'}]),
  }),
  'decompensation.condition.profound_map_arrest': record({
    id:'decompensation.condition.profound_map_arrest', kind:'condition',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_decompensation_controller.js',
    symbol:'meanArterialPressureMmHg < PROFOUND_COLLAPSE_MAP_MMHG for PROFOUND_COLLAPSE_MAP_SEC',
    description:'Experimental profound-hypotension terminal condition used by the educational decompensation controller.',
    source:Object.freeze([{type:'literature',citation:'Gomez et al. collapse criterion as documented in module comments.',role:'experimental collapse anchor; not a patient-specific mortality rule'}]),
  }),
  'decompensation.transition.pea': record({
    id:'decompensation.transition.pea', kind:'transition',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_decompensation_controller.js',
    symbol:'cardiacArrest -> PEA',
    description:'Terminal transition used by reduced browser decompensation model.',
    source:Object.freeze([{type:'project',statement:'Educational/research terminal-state mapping; not a full HumMod rhythm model or validated human mortality prediction.'}]),
  }),
});

function validateProvenanceRecord(x) {
  if (!x || typeof x !== 'object') throw new Error('provenance record must be an object');
  for (const k of ['id','kind','class','module','symbol','description','source']) {
    if (x[k] == null || x[k] === '') throw new Error('provenance record missing ' + k);
  }
  if (!PROVENANCE_CLASSES.includes(x.class)) throw new Error('invalid provenance class: ' + x.class);
  if (!PROVENANCE_KINDS.includes(x.kind)) throw new Error('invalid provenance kind: ' + x.kind);
  if (!Array.isArray(x.source) || x.source.length === 0) throw new Error('provenance source must be non-empty');
  if (!Array.isArray(x.dependsOn)) throw new Error('dependsOn must be an array');
  return true;
}

function validateProvenanceRegistry(registry = MODEL_PROVENANCE) {
  for (const [id, x] of Object.entries(registry)) {
    validateProvenanceRecord(x);
    if (x.id !== id) throw new Error('provenance key/id mismatch: ' + id);
    for (const dep of x.dependsOn) {
      if (!registry[dep]) throw new Error(id + ' depends on unknown provenance id ' + dep);
    }
  }
  return true;
}

const LIVE_CLINICAL_PROVENANCE_IDS = Object.freeze([
  'live.thorax.reference_pleural_pressure',
  'live.thorax.chest_wall_elastance_fraction',
  'live.metabolism.tissue_o2_use',
  'hummod.breathing.dead_space_equation',
  'hummod.bronchi.water_vapor_pressure',
  'hummod.hemoglobin.p50_model',
  'hummod.acid_base.ph_sid_pco2',
  'hummod.pulmonary_membrane.interpolation',
  'vent.mechanics.elastic_pressure_law',
  'vent.recruitment.open_close_kinetics',
  'vent.recruitment.condition.open',
  'vent.recruitment.condition.close',
  'hummod.gas_exchange.oxygen_runtime',
  'hummod.gas_exchange.co2_runtime',
  'hummod.hemodynamics.vascular_primitives',
  'hummod.hemodynamics.ventricular_pump',
  'live.circulation.reference_boundaries',
  'live.gas.reference_boundaries',
  'thorax.static_elastance_partition',
  'circulation.reduced_topology',
  'circulation.integration_substep',
  'circulation.mass_balance_derivatives',
  'circulation.negative_forward_flow_failure',
  'circulation.svr_derived',
  'circulation.pvr_derived',
  'oxygen_supply.delivery_equation',
  'oxygen_supply.critical_delivery_equation',
  'oxygen_supply.condition.supply_dependent',
  'decompensation.low_svo2_marker',
  'decompensation.organ_flow_map_marker',
  'decompensation.oxygen_debt_integral',
  'decompensation.debt_calibration_minutes',
  'decompensation.myocardial_floor',
  'decompensation.condition.map30_duration',
  'decompensation.asphyxial_anchor',
  'decompensation.stage_classifier',
  'ards.phenotype.baseline',
  'ards.phenotype.low_recruitability',
  'ards.phenotype.moderate_recruitability',
  'ards.phenotype.high_recruitability',
  'vent.recruitment.defaults',
  'vent.recruitment.feasibility_projection',
  'autonomic.v12.sympathetic_vascular_components',
  'autonomic.v12.ecfv_boundary',
  'autonomic.v12.catecholamine_pools',
  'autonomic.v12.low_pressure_receptors',
  'autonomic.v12.baroreflex_source',
  'autonomic.v12.vagus_source',
  'autonomic.v12.sa_node_source',
  'autonomic.v12.ventricular_beta_source',
  'autonomic.v12.venous_alpha_source',
  'autonomic.target_map',
  'autonomic.autonomic_tau',
  'autonomic.vascular_tau',
  'autonomic.cardiac_tau',
  'autonomic.hypoxic_drive_curve',
  'autonomic.hypercapnic_drive_curve',
  'autonomic.reflex_target_equation',
  'autonomic.parasympathetic_target_equation',
  'autonomic.reflex_hr_equation',
  'autonomic.contractility_equation',
  'autonomic.systemic_conductance_equation',
  'autonomic.venous_v0_equation',
  'autonomic.pulmonary_load_equation',
  'autonomic.respiratory_acidosis_inotropy',
  'autonomic.baroreflex_gain',
  'autonomic.hypercapnic_acidosis_anchor',
  'oxygen_supply.critical_extraction_curve',
  'decompensation.condition.profound_map_arrest',
  'decompensation.transition.pea',
]);

function provenanceSummary(ids = LIVE_CLINICAL_PROVENANCE_IDS) {
  const records = ids.map(id => {
    if (!MODEL_PROVENANCE[id]) throw new Error('unknown provenance id: ' + id);
    return MODEL_PROVENANCE[id];
  });
  const byClass = {};
  for (const x of records) byClass[x.class] = (byClass[x.class] || 0) + 1;
  return Object.freeze({
    schema: PROVENANCE_SCHEMA,
    ids: Object.freeze(ids.slice()),
    countsByClass: Object.freeze(byClass),
    hasUnknown: records.some(x => x.class === 'UNKNOWN'),
    migrationCoverage: 'v1.1-rc-live-path-audited',
  });
}

validateProvenanceRegistry();

module.exports = {
  PROVENANCE_SCHEMA,
  PROVENANCE_CLASSES,
  PROVENANCE_KINDS,
  MODEL_PROVENANCE,
  LIVE_CLINICAL_PROVENANCE_IDS,
  validateProvenanceRecord,
  validateProvenanceRegistry,
  provenanceSummary,
};