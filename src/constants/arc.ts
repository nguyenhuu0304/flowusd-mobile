export const ARC_TESTNET = {
  id: 5042002,
  chainIdHex: "0x4cef52",
  name: "Arc Testnet",

  rpcUrl: "https://rpc.testnet.arc.network",

  explorerUrl: "https://testnet.arcscan.app",

  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },

  contracts: {
    usdc: "0x3600000000000000000000000000000000000000",

    batchSplitBill:
      "0x9F96951eF27BadE6dCeee185341994a80A411d02",

    telegramPaymentLinks:
      "0xB09880B93fF0F45310fDC88aD7d2A7A4A02b5B85",
  },
} as const;