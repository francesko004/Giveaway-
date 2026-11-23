// Real beacons retrieved from https://api.drand.sh (League of Entropy). Used as fixed test vectors.
export const QUICKNET_BEACONS = {
  1000: {
    round: 1000,
    randomness: "fe290beca10872ef2fb164d2aa4442de4566183ec51c56ff3cd603d930e54fdd",
    signature: "b44679b9a59af2ec876b1a6b1ad52ea9b1615fc3982b19576350f93447cb1125e342b73a8dd2bacbe47e4b6b63ed5e39",
  },
  1001: {
    round: 1001,
    randomness: "b0a591ad1b9002cfc372ac6e30abd3da8d3088d4caae026961743474fb94235f",
    signature: "b33bf3667cbd5a82de3a24b4e0e9fe5513cc1a0e840368c6e31f5fcfa79bea03f73896b25883abf2853d10337fb8fa41",
  },
  2000000: {
    round: 2000000,
    randomness: "3fcc32da81d3de7243f1b702a3a502a3118e0492e19e39e30f3da36be1eef788",
    signature: "a7c94d62fa50475c65f259bc4d50afc0cebc5cb29848568f90dff842789c05d7f6b2414971a0b67bf532624ad6bab054",
  },
  12345678: {
    round: 12345678,
    randomness: "47175ae9652cb6704c2b509e5d2aa03b609e67039251ff1e162282136c515bf0",
    signature: "b0a199d51b7c29117d2155c4fc2322dbacd9d1e1f11da5b5c0e4e19947e4aaf634970e85eceef450681d27baa3a03f20",
  },
} as const;

export const DEFAULT_CHAIN_BEACON_1000 = {
  round: 1000,
  randomness: "a40d3e0e7e3c71f28b7da2fd339f47f0bcf10910309f5253d7c323ec8cea3212",
  signature:
    "99bf96de133c3d3937293cfca10c8152b18ab2d034ccecf115658db324d2edc00a16a2044cd04a8a38e2a307e5ecff3511315be8d282079faf24098f283e0ed2c199663b334d2e84c55c032fe469b212c5c2087ebb83a5b25155c3283f5b79ac",
  previous_signature:
    "af0d93299a363735fe847f5ea241442c65843dc1bd3a7b79646b3b10072e908bf034d35cd69d378e3341f139100cd4cd03030399864ef8803a5a4f5e64fccc20bbae36d1ca22a6ddc43d2630c41105e90598fab11e5c7456df3925d4b577b113",
};
