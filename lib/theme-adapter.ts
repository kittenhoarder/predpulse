/** Frozen, individually verified target set. Server-only admission metadata. */
export const THEME_ADAPTER = "state-data-centre-moratoriums-2026-v1";
export const THEME_DEADLINE = "2027-01-01T04:59:00Z";
export const THEME_TARGETS = [
  {
    "state": "Indiana",
    "familyId": "1103960",
    "marketId": "5126777",
    "createdAt": "2026-09-29T15:56:16.386886Z",
    "rulesHash": "043062df1ae0b746d991c9f1840f4762e7733b046f07a39189d03aadac097576"
  },
  {
    "state": "Louisiana",
    "familyId": "1103971",
    "marketId": "5126794",
    "createdAt": "2026-09-29T15:58:03.108149Z",
    "rulesHash": "6ece97099c31776e443678166199a2ceb68eff813641ea131a54e0a267e44ff6"
  },
  {
    "state": "Missouri",
    "familyId": "1103970",
    "marketId": "5126791",
    "createdAt": "2026-09-29T15:57:47.656918Z",
    "rulesHash": "bb67f4131635cf951192de8ad86663472f20b80fa72b466a0bab8e7322deefb8"
  },
  {
    "state": "Ohio",
    "familyId": "1103681",
    "marketId": "5123848",
    "createdAt": "2026-09-29T14:15:19.827277Z",
    "rulesHash": "a6cd3d6d4ad832948019f8bae7d35913af202e9d9627220096b9333575643b34"
  },
  {
    "state": "Oklahoma",
    "familyId": "1103961",
    "marketId": "5126780",
    "createdAt": "2026-09-29T15:56:47.547106Z",
    "rulesHash": "5da61fb14fc97f27d6e8802d7446840cec5fe58aa62c84a967895019e062cb52"
  },
  {
    "state": "Texas",
    "familyId": "1103684",
    "marketId": "5123855",
    "createdAt": "2026-09-29T14:16:07.263711Z",
    "rulesHash": "6256788a79fbfd07bce298cc1a3700c555a1cdd709b9c1a56828847881bf4b79"
  }
] as const;
export const themeQuestion = (state: string) => `Will ${state} enact a data center moratorium by December 31, 2026?`;
