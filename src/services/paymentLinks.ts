import { ARC_TESTNET } from "@/constants/arc";

import type {
  MobileBill,
  MobileBillMember,
} from "@/services/mobileBills";

export type FlowUSDPaymentLink = {
  /**
   * On-chain bytes32 Payment Link ID.
   */
  id: string;

  /**
   * Local FlowUSD bill ID.
   *
   * Useful on the creator device,
   * but not required for on-chain payment.
   */
  billId: string;

  billTitle: string;

  memberName: string;

  /**
   * USDC amount in raw 6-decimal units.
   */
  amountRaw: string;

  creator: string;

  status: "unpaid" | "paid";

  payer?: string;

  network: {
    name: string;
    chainId: number;
  };

  contractAddress: string;
};

export function createPaymentLinkFromMember(
  bill: MobileBill,
  member: MobileBillMember
): FlowUSDPaymentLink {
  return {
    id: member.id,

    billId: bill.id,

    billTitle: bill.title,

    memberName: member.name,

    amountRaw: member.amountRaw,

    creator: bill.creator,

    status: member.status,

    payer: member.payer,

    network: {
      name: bill.network.name,
      chainId: bill.network.chainId,
    },

    contractAddress:
      bill.contractAddress,
  };
}

export function getPaymentLinksFromBill(
  bill: MobileBill
): FlowUSDPaymentLink[] {
  return bill.members.map(member =>
    createPaymentLinkFromMember(
      bill,
      member
    )
  );
}

export function isValidPaymentLinkId(
  value: string
): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(
    value.trim()
  );
}

/**
 * Internal Expo Router path.
 *
 * Example:
 * /pay/0xabc...
 */
export function getPaymentLinkPath(
  linkId: string
): string {
  if (!isValidPaymentLinkId(linkId)) {
    throw new Error(
      "Invalid FlowUSD Payment Link ID."
    );
  }

  return `/pay/${linkId}`;
}

/**
 * Future public share URL.
 *
 * We define it here now so Web,
 * Mobile and QR can all use
 * exactly the same format later.
 */
export function getPaymentLinkUrl(
  linkId: string
): string {
  if (!isValidPaymentLinkId(linkId)) {
    throw new Error(
      "Invalid FlowUSD Payment Link ID."
    );
  }

  return (
    "https://flowusd.vercel.app/pay/" +
    linkId
  );
}

export const PAYMENT_LINK_NETWORK = {
  name: ARC_TESTNET.name,
  chainId: ARC_TESTNET.id,
  contractAddress:
    ARC_TESTNET.contracts
      .batchSplitBill,
} as const;