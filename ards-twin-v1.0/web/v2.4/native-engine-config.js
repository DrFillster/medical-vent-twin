'use strict';

// Native Mac physiology-engine endpoint.
//
// The native engine remains non-authoritative until explicit parity gates
// transfer physiology/control authority. If the Cloudflare Tunnel or Access
// application is not configured, the UI will show the engine as unavailable.
window.MEDICAL_TWIN_NATIVE_ENGINE_URL =
  window.MEDICAL_TWIN_NATIVE_ENGINE_URL ||
  'https://engine.hummod.defying-logic.com';
