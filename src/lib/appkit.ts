import "@walletconnect/react-native-compat";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAppKit,
  type Storage,
} from "@reown/appkit-react-native";
import { EthersAdapter } from "@reown/appkit-ethers-react-native";

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "Missing EXPO_PUBLIC_REOWN_PROJECT_ID in the .env file."
  );
}

/**
 * Reown Storage adapter backed by React Native AsyncStorage.
 *
 * AsyncStorage can only store strings.
 * Reown Storage can store generic values.
 * Therefore values are JSON encoded before saving
 * and JSON decoded when reading.
 */
const storage: Storage = {
  async getKeys(): Promise<string[]> {
    const keys = await AsyncStorage.getAllKeys();

    return [...keys];
  },

  async getEntries<T = any>(): Promise<[string, T][]> {
    const keys = await AsyncStorage.getAllKeys();

    if (keys.length === 0) {
      return [];
    }

    const entries = await AsyncStorage.multiGet([...keys]);

    const result: [string, T][] = [];

    for (const [key, value] of entries) {
      if (value === null) {
        continue;
      }

      try {
        result.push([key, JSON.parse(value) as T]);
      } catch {
        result.push([key, value as unknown as T]);
      }
    }

    return result;
  },

  async getItem<T = any>(key: string): Promise<T | undefined> {
    const value = await AsyncStorage.getItem(key);

    if (value === null) {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  },

  async setItem<T = any>(key: string, value: T): Promise<void> {
    const serialized =
      typeof value === "string"
        ? value
        : JSON.stringify(value);

    await AsyncStorage.setItem(key, serialized);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

export const arcTestnet = {
  id: 5042002,

  name: "Arc Testnet",

  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },

  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
  },

  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
} as const;

const metadata = {
  name: "FlowUSD",

  description: "Programmable USDC Payments on Arc",

  url: "https://flowusd.vercel.app",

  icons: [
    "https://flowusd.vercel.app/favicon.ico",
  ],

  redirect: {
    native: "flowusd://",
    universal: "https://flowusd.vercel.app",
  },
};

export const appKit = createAppKit({
  projectId,

  adapters: [
    new EthersAdapter(),
  ],

  networks: [
    arcTestnet,
  ],

  defaultNetwork: arcTestnet,

  metadata,

  storage,
});