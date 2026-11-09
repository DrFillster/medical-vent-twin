'use strict';
const PROFILES=Object.freeze({
  passive_paralyzed:Object.freeze({id:'passive_paralyzed',label:'Passive / paralyzed',driveRelative:0.09686299285820986,muscleTransmission:0,description:'Neural drive retained; neuromuscular transmission to Pmus is zero.'}),
  sedated_breathing:Object.freeze({id:'sedated_breathing',label:'Sedated but breathing',driveRelative:0.09686299285820986,muscleTransmission:0.55,description:'Hennigs resting neural timing with reduced transmitted muscle effort.'}),
  awake_cooperative:Object.freeze({id:'awake_cooperative',label:'Awake / cooperative',driveRelative:0.09686299285820986,muscleTransmission:1,description:'Hennigs resting neural timing and full reference muscle effort.'}),
  agitated_high_drive:Object.freeze({id:'agitated_high_drive',label:'Agitated / high drive',driveRelative:0.9507657603338697,muscleTransmission:1.2,description:'High neural operating point with increased muscle effort; bounded inside Hennigs validated frequency envelope.'}),
});
function getPatientStateProfile(id='awake_cooperative'){const p=PROFILES[id];if(!p)throw new Error('unsupported patientStateProfile: '+id);return p;}
module.exports=Object.freeze({PROFILES,getPatientStateProfile});
