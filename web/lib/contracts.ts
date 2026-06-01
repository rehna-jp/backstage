// ── Addresses ──────────────────────────────────────────────────────────────────

export const ADDRESSES = {
  WIP_TOKEN:           (process.env.NEXT_PUBLIC_WIP_TOKEN          ?? "0x1514000000000000000000000000000000000000") as `0x${string}`,
  LICENSE_TOKEN:       (process.env.NEXT_PUBLIC_LICENSE_TOKEN       ?? "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC") as `0x${string}`,
  LICENSING_MODULE:    (process.env.NEXT_PUBLIC_LICENSING_MODULE    ?? "0x04fbd8a2e56dd85CFD5500A4A4DfA955B9f1dE6f") as `0x${string}`,
  ROYALTY_MODULE:      (process.env.NEXT_PUBLIC_ROYALTY_MODULE      ?? "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086") as `0x${string}`,
  PIL_TEMPLATE:        (process.env.NEXT_PUBLIC_PIL_TEMPLATE        ?? "0x2E896b0b2Fdb7457499B56AAaA4AE55BCB4Cd316") as `0x${string}`,
  BACKSTAGE_REGISTRY:  (process.env.NEXT_PUBLIC_BACKSTAGE_REGISTRY  ?? "0x") as `0x${string}`,
} as const;

// ── ABIs ───────────────────────────────────────────────────────────────────────

export const REGISTRY_ABI = [
  {
    name: "getWork",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "workId", type: "uint256" }],
    outputs: [{
      name: "",
      type: "tuple",
      components: [
        { name: "creator",          type: "address"   },
        { name: "ipId",             type: "address"   },
        { name: "previewCID",       type: "string"    },
        { name: "gatedVaultUuids",  type: "uint32[]"  },
        { name: "licenseTermsIds",  type: "uint256[]" },
        { name: "metadataURI",      type: "string"    },
        { name: "createdAt",        type: "uint256"   },
      ],
    }],
  },
  {
    name: "totalWorks",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "listByCreator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
] as const;

export const WIP_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const LICENSING_MODULE_ABI = [
  {
    name: "mintLicenseTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "licensorIpId",    type: "address"  },
      { name: "licenseTemplate", type: "address"  },
      { name: "licenseTermsId",  type: "uint256"  },
      { name: "amount",          type: "uint256"  },
      { name: "receiver",        type: "address"  },
      { name: "royaltyContext",  type: "bytes"    },
      { name: "maxMintingFee",   type: "uint256"  },
      { name: "maxRevenueShare", type: "uint32"   },
    ],
    outputs: [{ name: "startLicenseTokenId", type: "uint256" }],
  },
] as const;

export const PIL_TEMPLATE_ABI = [
  {
    name: "getLicenseTerms",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "selectedLicenseTermsId", type: "uint256" }],
    outputs: [{
      name: "terms",
      type: "tuple",
      components: [
        { name: "transferable",             type: "bool"    },
        { name: "royaltyPolicy",            type: "address" },
        { name: "defaultMintingFee",        type: "uint256" },
        { name: "expiration",               type: "uint256" },
        { name: "commercialUse",            type: "bool"    },
        { name: "commercialAttribution",    type: "bool"    },
        { name: "commercializerChecker",    type: "address" },
        { name: "commercializerCheckerData", type: "bytes"  },
        { name: "commercialRevShare",       type: "uint32"  },
        { name: "commercialRevCeiling",     type: "uint256" },
        { name: "derivativesAllowed",       type: "bool"    },
        { name: "derivativesAttribution",   type: "bool"    },
        { name: "derivativesApproval",      type: "bool"    },
        { name: "derivativesReciprocal",    type: "bool"    },
        { name: "derivativeRevCeiling",     type: "uint256" },
        { name: "currency",                 type: "address" },
        { name: "uri",                      type: "string"  },
      ],
    }],
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type Work = {
  creator:         `0x${string}`;
  ipId:            `0x${string}`;
  previewCID:      string;
  gatedVaultUuids: readonly number[];
  licenseTermsIds: readonly bigint[];
  metadataURI:     string;
  createdAt:       bigint;
};

export type WorkMeta = {
  title:       string;
  description: string;
  image:       string;
};

export const TIER_LABELS = ["Stream", "Download", "Commercial"] as const;
export type TierIndex = 0 | 1 | 2;
