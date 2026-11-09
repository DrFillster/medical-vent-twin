'use strict';

const SOURCE=Object.freeze({
  authority:'hennigs-supported',
  controlAuthority:true,
  basis:Object.freeze([
    'Hennigs et al. 2026 Eqs.2-10 and Table 3 define the chemical-drive structure.',
    'Hennigs Figure 6 baseline RR is approximately 12.5/min; inversion of Eq.9 gives Drel approximately 0.097.',
    'GPCO2,pH is present in Hennigs Eq.4 but no numeric value is published in Table 3; 25 exc/delta-pH is retained as a calibrated Hennigs-supported bridge, not a published constant.'
  ]),
  limitations:Object.freeze([
    'The GPCO2,pH calibration does not reproduce the full Figure 6 time course when coupled to the reduced-HumMod gas plant.',
    'This profile is a reasonable Hennigs-based integration choice, not a source-exact reproduction of the authors full cardiopulmonary model.'
  ])
});

const PROFILE=Object.freeze({
  parameterProfile:'development-paper',
  gPco2Ph:25,
  minimumRelativeDrive:0.09686299285820986,
  maximumFrequencyRelativeDrive:1.1105014884421243,
  baselineRespiratoryRatePerMin:12.5,
  baselineTidalVolumeL:0.5,
  baselineRawOscillatorPeriod:16.956222222302998,
  boundaryAuthority:'hennigs-supported',
  gainAuthority:'hennigs-supported',
  authority:SOURCE.authority,
  controlAuthority:true,
  provenance:SOURCE,
});

module.exports=Object.freeze({SOURCE,PROFILE});
