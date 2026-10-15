import {
  Interface,
  JsonRpcProvider,
} from "ethers";

import { ARC_TESTNET } from "@/constants/arc";

const PAYMENT_LINK_ABI = [
  "function getLink(bytes32 linkId) view returns (address creator, uint256 amount, bool paid, address payer, uint256 paidAt)",
];

const paymentLinkInterface =
  new Interface(
    PAYMENT_LINK_ABI
  );

const rpcProvider =
  new JsonRpcProvider(
    ARC_TESTNET.rpcUrl,
    ARC_TESTNET.id
  );

export type OnChainPaymentLink = {
  id: string;

  creator: string;

  /**
   * USDC raw amount.
   * USDC uses 6 decimals.
   */
  amountRaw: string;

  paid: boolean;

  payer: string;

  /**
   * Unix timestamp returned
   * by the contract.
   *
   * "0" means not paid yet.
   */
  paidAt: string;
};

function isValidBytes32(
  value: string
): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(
    value
  );
}

export async function readPaymentLink(
  linkId: string
): Promise<OnChainPaymentLink> {
  const normalizedId =
    linkId.trim();

  if (
    !isValidBytes32(
      normalizedId
    )
  ) {
    throw new Error(
      "Invalid Payment Link ID."
    );
  }

  const data =
    paymentLinkInterface.encodeFunctionData(
      "getLink",
      [normalizedId]
    );

  const result =
    await rpcProvider.call({
      to:
        ARC_TESTNET.contracts
          .batchSplitBill,
      data,
    });

  if (
    !result ||
    result === "0x"
  ) {
    throw new Error(
      "Payment Link was not found on Arc Testnet."
    );
  }

  const decoded =
    paymentLinkInterface.decodeFunctionResult(
      "getLink",
      result
    );

  const creator =
    decoded[0] as string;

  const amount =
    decoded[1] as bigint;

  const paid =
    decoded[2] as boolean;

  const payer =
    decoded[3] as string;

  const paidAt =
    decoded[4] as bigint;

  return {
    id: normalizedId,

    creator,

    amountRaw:
      amount.toString(),

    paid,

    payer,

    paidAt:
      paidAt.toString(),
  };
}

export function paymentLinkAmountToDisplay(
  amountRaw: string
): string {
  const value =
    BigInt(amountRaw);

  const whole =
    value / 1_000_000n;

  const fraction =
    (
      value %
      1_000_000n
    )
      .toString()
      .padStart(6, "0")
      .replace(/0+$/, "");

  if (!fraction) {
    return whole.toString();
  }

  return (
    whole.toString() +
    "." +
    fraction
  );
}

export function paymentTimestampToDisplay(
  paidAt: string
): string | null {
  const timestamp =
    BigInt(paidAt);

  if (timestamp === 0n) {
    return null;
  }

  const milliseconds =
    Number(timestamp) *
    1000;

  const date =
    new Date(milliseconds);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toLocaleString();
}