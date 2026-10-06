'use strict';

// Canonical HumMod source identity.
//
// Scientific authority:
//   HumMod/hummod-standalone
//
// Reproducibility mirror:
//   riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// The canonical repository is currently not resolvable through GitHub API
// access in this environment. Until an official commit SHA is independently
// resolved, do not claim that the mirror SHA is an official upstream SHA.

const HUMMOD_CANONICAL_REPOSITORY = 'HumMod/hummod-standalone';
const HUMMOD_CANONICAL_REVISION = null;

const HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY =
  'riliescu/hummod-standalone';
const HUMMOD_REPRODUCIBILITY_MIRROR_REVISION =
  '8dab57e05631f779bf5020fe0dd51874d8ae98c1';

const HUMMOD_SOURCE_IDENTITY = Object.freeze({
  canonicalRepository: HUMMOD_CANONICAL_REPOSITORY,
  canonicalRevision: HUMMOD_CANONICAL_REVISION,
  canonicalStatus: 'official-upstream-identity-confirmed-revision-unresolved',
  reproducibilityMirrorRepository:
    HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY,
  reproducibilityMirrorRevision:
    HUMMOD_REPRODUCIBILITY_MIRROR_REVISION,
  reproducibilityStatus:
    'public-mirror-snapshot-used-for-byte-addressable-source-references',
  rule:
    'Scientific provenance names the official upstream. Exact file/line reproduction may use the pinned mirror until the official revision is independently resolved.',
});

function humModSource(path, symbol) {
  return Object.freeze({
    type: 'HumMod',
    repository: HUMMOD_CANONICAL_REPOSITORY,
    revision: HUMMOD_CANONICAL_REVISION,
    path,
    symbol,
    mirrorRepository: HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY,
    mirrorRevision: HUMMOD_REPRODUCIBILITY_MIRROR_REVISION,
    canonicalStatus: HUMMOD_SOURCE_IDENTITY.canonicalStatus,
  });
}

module.exports = {
  HUMMOD_CANONICAL_REPOSITORY,
  HUMMOD_CANONICAL_REVISION,
  HUMMOD_REPRODUCIBILITY_MIRROR_REPOSITORY,
  HUMMOD_REPRODUCIBILITY_MIRROR_REVISION,
  HUMMOD_SOURCE_IDENTITY,
  humModSource,
};
