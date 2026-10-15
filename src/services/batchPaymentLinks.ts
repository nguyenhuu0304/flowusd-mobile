import {
  Interface,
  randomBytes,
  hexlify,
} from "ethers";

import { ARC_TESTNET } from "@/constants/arc";

export const BATCH_CONTRACT_ADDRESS =
  ARC_TESTNET.contracts.batchSplitBill;

const BATCH_ABI = [
  "function batchCreateLinks(bytes32[] ids, uint256[] amounts)",
];

const batchInterface = new Interface(BATCH_ABI);

export type Eip1193LikeProvider = {
  request: (
    args: {
      method: string;
      params?: unknown[];
    },
    chain?: string
  ) => Promise<unknown>;
};

export function generateLinkId(): string {
  return hexlify(randomBytes(32));
}

export function parseUsdcAmount(value: string): bigint {
  const trimmed = value.trim();

  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(
      "Invalid USDC amount. Maximum 6 decimal places."
    );
  }

  const [whole, fraction = ""] =
    trimmed.split(".");

  return (
    BigInt(whole) * 1_000_000n +
    BigInt(fraction.padEnd(6, "0"))
  );
}

export function encodeBatchCreateLinks(
  ids: string[],
  amounts: bigint[]
): string {
  if (ids.length < 2) {
    throw new Error(
      "Split Bill requires at least 2 members."
    );
  }

  if (ids.length !== amounts.length) {
    throw new Error(
      "Member IDs and amounts do not match."
    );
  }

  if (ids.length > 100) {
    throw new Error(
      "A maximum of 100 payment links can be created in one transaction."
    );
  }

  return batchInterface.encodeFunctionData(
    "batchCreateLinks",
    [ids, amounts]
  );
}

export async function submitBatchCreateLinks(
  provider: Eip1193LikeProvider,
  from: string,
  ids: string[],
  amounts: bigint[],
  chainId?: number
): Promise<string> {
  const data = encodeBatchCreateLinks(
    ids,
    amounts
  );

  const chain =
    chainId ??
    ARC_TESTNET.id;

  const result = await provider.request(
    {
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: BATCH_CONTRACT_ADDRESS,
          data,
          value: "0x0",
        },
      ],
    },
    `eip155:${chain}`
  );

  if (
    typeof result !== "string" ||
    !/^0x[a-fA-F0-9]{64}$/.test(result)
  ) {
    throw new Error(
      "Wallet returned an invalid transaction hash."
    );
  }

  return result;
}

export async function waitForTransactionReceipt(
  provider: Eip1193LikeProvider,
  txHash: string,
  chainId?: number,
  timeoutMs = 120_000
): Promise<Record<string, unknown>> {
  const chain =
    chainId ??
    ARC_TESTNET.id;

  const startedAt = Date.now();

  while (
    Date.now() - startedAt <
    timeoutMs
  ) {
    const receipt = await provider.request(
      {
        method:
          "eth_getTransactionReceipt",
        params: [txHash],
      },
      `eip155:${chain}`
    );

    if (
      receipt &&
      typeof receipt === "object"
    ) {
      const typed =
        receipt as Record<
          string,
          unknown
        >;

      const status = typed.status;

      if (
        status === "0x0" ||
        status === 0
      ) {
        throw new Error(
          "Transaction reverted on Arc Testnet."
        );
      }

      return typed;
    }

    await new Promise(resolve =>
      setTimeout(resolve, 1800)
    );
  }

  throw new Error(
    "Timed out waiting for blockchain confirmation."
  );
}