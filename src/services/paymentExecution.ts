import {
  Interface,
  JsonRpcProvider,
} from "ethers";

import { ARC_TESTNET } from "@/constants/arc";

import {
  waitForTransactionReceipt,
  type Eip1193LikeProvider,
} from "@/services/batchPaymentLinks";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const PAYMENT_ABI = [
  "function pay(bytes32 linkId, uint256 amount)",
];

const erc20Interface =
  new Interface(ERC20_ABI);

const paymentInterface =
  new Interface(PAYMENT_ABI);

const rpcProvider =
  new JsonRpcProvider(
    ARC_TESTNET.rpcUrl,
    ARC_TESTNET.id
  );

export type PaymentExecutionResult = {
  approvalTxHash?: string;
  paymentTxHash: string;
};

function assertTxHash(
  value: unknown
): string {
  if (
    typeof value !== "string" ||
    !/^0x[a-fA-F0-9]{64}$/.test(value)
  ) {
    throw new Error(
      "Wallet returned an invalid transaction hash."
    );
  }

  return value;
}

export async function readUsdcAllowance(
  owner: string
): Promise<bigint> {
  const data =
    erc20Interface.encodeFunctionData(
      "allowance",
      [
        owner,
        ARC_TESTNET.contracts
          .batchSplitBill,
      ]
    );

  const result =
    await rpcProvider.call({
      to:
        ARC_TESTNET.contracts.usdc,
      data,
    });

  const decoded =
    erc20Interface.decodeFunctionResult(
      "allowance",
      result
    );

  return decoded[0] as bigint;
}

export async function approveUsdcForPayment(
  provider: Eip1193LikeProvider,
  owner: string,
  amountRaw: bigint,
  chainId = ARC_TESTNET.id
): Promise<string> {
  const data =
    erc20Interface.encodeFunctionData(
      "approve",
      [
        ARC_TESTNET.contracts
          .batchSplitBill,
        amountRaw,
      ]
    );

  const result =
    await provider.request(
      {
        method: "eth_sendTransaction",
        params: [
          {
            from: owner,
            to:
              ARC_TESTNET.contracts.usdc,
            data,
            value: "0x0",
          },
        ],
      },
      `eip155:${chainId}`
    );

  return assertTxHash(result);
}

export async function submitPayment(
  provider: Eip1193LikeProvider,
  payer: string,
  linkId: string,
  amountRaw: bigint,
  chainId = ARC_TESTNET.id
): Promise<string> {
  const data =
    paymentInterface.encodeFunctionData(
      "pay",
      [
        linkId,
        amountRaw,
      ]
    );

  const result =
    await provider.request(
      {
        method: "eth_sendTransaction",
        params: [
          {
            from: payer,
            to:
              ARC_TESTNET.contracts
                .batchSplitBill,
            data,
            value: "0x0",
          },
        ],
      },
      `eip155:${chainId}`
    );

  return assertTxHash(result);
}

export async function executePayment(
  provider: Eip1193LikeProvider,
  payer: string,
  linkId: string,
  amountRaw: string,
  chainId = ARC_TESTNET.id,
  onStatus?: (
    status: string
  ) => void
): Promise<PaymentExecutionResult> {
  if (
    !/^0x[a-fA-F0-9]{64}$/.test(
      linkId
    )
  ) {
    throw new Error(
      "Invalid Payment Link ID."
    );
  }

  if (
    !payer ||
    payer.toLowerCase() ===
      ZERO_ADDRESS
  ) {
    throw new Error(
      "Invalid payer wallet."
    );
  }

  const amount =
    BigInt(amountRaw);

  if (amount <= 0n) {
    throw new Error(
      "Payment amount must be greater than zero."
    );
  }

  onStatus?.(
    "Checking USDC allowance..."
  );

  const allowance =
    await readUsdcAllowance(
      payer
    );

  let approvalTxHash:
    | string
    | undefined;

  if (allowance < amount) {
    onStatus?.(
      "USDC approval required. Confirm approval in your wallet..."
    );

    approvalTxHash =
      await approveUsdcForPayment(
        provider,
        payer,
        amount,
        chainId
      );

    onStatus?.(
      "Waiting for USDC approval confirmation..."
    );

    await waitForTransactionReceipt(
      provider,
      approvalTxHash,
      chainId
    );
  }

  onStatus?.(
    "Confirm payment in your wallet..."
  );

  const paymentTxHash =
    await submitPayment(
      provider,
      payer,
      linkId,
      amount,
      chainId
    );

  onStatus?.(
    "Payment submitted. Waiting for Arc confirmation..."
  );

  await waitForTransactionReceipt(
    provider,
    paymentTxHash,
    chainId
  );

  return {
    approvalTxHash,
    paymentTxHash,
  };
}