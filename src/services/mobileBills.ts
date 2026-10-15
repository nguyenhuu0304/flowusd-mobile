import AsyncStorage from "@react-native-async-storage/async-storage";

import { ARC_TESTNET } from "@/constants/arc";

export type MobileBillMemberStatus =
  | "unpaid"
  | "paid";

export type MobileBillMember = {
  id: string;
  name: string;

  /**
   * USDC amount in raw 6-decimal units.
   *
   * Example:
   * 0.01 USDC = "10000"
   */
  amountRaw: string;

  status: MobileBillMemberStatus;

  payer?: string;
};

export type MobileBill = {
  /**
   * Local FlowUSD bill ID.
   *
   * This is separate from the individual
   * on-chain payment-link IDs.
   */
  id: string;

  title: string;

  creator: string;

  createdAt: string;

  /**
   * Total USDC amount in raw 6-decimal units.
   */
  totalRaw: string;

  members: MobileBillMember[];

  txHash: string;

  network: {
    name: string;
    chainId: number;
  };

  contractAddress: string;
};

const STORAGE_PREFIX =
  "flowusd:mobile-bills:v1";

function normalizeAddress(
  address: string
): string {
  return address
    .trim()
    .toLowerCase();
}

function storageKey(
  owner: string
): string {
  return (
    STORAGE_PREFIX +
    ":" +
    ARC_TESTNET.contracts.batchSplitBill.toLowerCase() +
    ":" +
    normalizeAddress(owner)
  );
}

function isMobileBill(
  value: unknown
): value is MobileBill {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const bill =
    value as Partial<MobileBill>;

  return (
    typeof bill.id === "string" &&
    typeof bill.title === "string" &&
    typeof bill.creator === "string" &&
    typeof bill.createdAt === "string" &&
    typeof bill.totalRaw === "string" &&
    typeof bill.txHash === "string" &&
    Array.isArray(bill.members)
  );
}

export async function loadMobileBills(
  owner: string
): Promise<MobileBill[]> {
  const key =
    storageKey(owner);

  try {
    const raw =
      await AsyncStorage.getItem(
        key
      );

    if (!raw) {
      return [];
    }

    const parsed: unknown =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isMobileBill)
      .filter(
        bill =>
          normalizeAddress(
            bill.creator
          ) ===
          normalizeAddress(owner)
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      );
  } catch (error) {
    console.error(
      "[FlowUSD] Failed to load mobile bills:",
      error
    );

    return [];
  }
}

export async function saveMobileBills(
  owner: string,
  bills: MobileBill[]
): Promise<void> {
  const key =
    storageKey(owner);

  await AsyncStorage.setItem(
    key,
    JSON.stringify(bills)
  );
}

export async function saveMobileBill(
  owner: string,
  bill: MobileBill
): Promise<void> {
  const bills =
    await loadMobileBills(
      owner
    );

  const existingIndex =
    bills.findIndex(
      item =>
        item.id === bill.id
    );

  if (existingIndex >= 0) {
    bills[existingIndex] =
      bill;
  } else {
    bills.unshift(bill);
  }

  await saveMobileBills(
    owner,
    bills
  );
}

export async function getMobileBill(
  owner: string,
  billId: string
): Promise<MobileBill | null> {
  const bills =
    await loadMobileBills(
      owner
    );

  return (
    bills.find(
      bill =>
        bill.id === billId
    ) ?? null
  );
}

export async function deleteMobileBill(
  owner: string,
  billId: string
): Promise<void> {
  const bills =
    await loadMobileBills(
      owner
    );

  const next =
    bills.filter(
      bill =>
        bill.id !== billId
    );

  await saveMobileBills(
    owner,
    next
  );
}

export function createLocalBillId(): string {
  const timestamp =
    Date.now().toString(36);

  const random =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return (
    "bill_" +
    timestamp +
    "_" +
    random
  );
}

export function rawUsdcToDisplay(
  raw: string
): string {
  const value =
    BigInt(raw);

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