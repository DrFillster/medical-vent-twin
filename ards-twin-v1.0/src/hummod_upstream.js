'use strict';

// Canonical HumMod upstream identity.
//
// The official repository is HumMod/hummod-standalone. At the time this
// metadata was added (2026-09-30), GitHub search/index still identified that
// repository as the official standalone library, but direct API resolution
// returned 404. Therefore exact reproducibility currently uses the public
// riliescu mirror snapshot below while scientific authority remains assigned
// to the official HumMod repository.
//
// Do not silently replace mirrorRevision with an "official" SHA unless that
// commit is directly verified from HumMod/hummod-standalone.

const HUMMOD_UPSTREAM = Object.freeze({
  canonicalRepository: 'HumMod/hummod-standalone',
  canonicalOrganization: 'HumMod',
  canonicalStatus: 'official-upstream-currently-api-unresolvable',
  canonicalRevision: null,
  mirrorRepository: 'riliescu/hummod-standalone',
  mirrorRevision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  mirrorRole: 'reproducible-public-snapshot-not-scientific-authority',
  modelDescriptionLicense: 'GPL-2.0',
});

function humModSource(path, symbol, extra = {}) {
  return Object.freeze({
    type: 'HumMod',
    repository: HUMMOD_UPSTREAM.canonicalRepository,
    revision: HUMMOD_UPSTREAM.canonicalRevision,
    mirrorRepository: HUMMOD_UPSTREAM.mirrorRepository,
    mirrorRevision: HUMMOD_UPSTREAM.mirrorRevision,
    path,
    symbol,
    ...extra,
  });
}

module.exports = {
  HUMMOD_UPSTREAM,
  humModSource,
};
