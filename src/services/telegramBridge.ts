import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  Eip1193LikeProvider,
} from "@/services/batchPaymentLinks";

const TELEGRAM_API_BASE =
  "https://flowusd-telegram-api.onrender.com";

const SESSION_PREFIX =
  "flowusd:mobile:telegram-session:v1:";

type TelegramSession = {
  token: string;
  expiresAt: number;
};

export type TelegramDirectoryMember = {
  id: string;
  display_name: string;
  full_name: string;
  username: string | null;
};

export type TelegramDirectoryResponse = {
  members: TelegramDirectoryMember[];
  pendingMembers?: unknown[];
};

type TelegramChallengeResponse = {
  nonce: string;
  message: string;
};

type TelegramConnectResponse = {
  accessToken: string;
  expiresIn?: number;
  persistent?: boolean;
};

export type TelegramRegisterMemberInput = {
  code: string;
  displayName: string;
  fullName?: string;
};

export type TelegramRegisterMemberResponse = {
  ok: boolean;
  memberId?: string;
};

export type TelegramBillMember = {
  id: string;
  name: string;
  raw: string;
  directoryId: string | null;
};

export type TelegramBillPayload = {
  id: string;
  creator: string;
  title: string;
  totalRaw: string;
  txHash: string;
  members: TelegramBillMember[];
};

function normalizeOwner(
  owner: string
): string {
  return owner
    .trim()
    .toLowerCase();
}

function sessionKey(
  owner: string
): string {
  return (
    SESSION_PREFIX +
    normalizeOwner(owner)
  );
}

function getErrorMessage(
  result: unknown,
  status: number
): string {
  if (
    result &&
    typeof result === "object" &&
    "detail" in result &&
    typeof (
      result as {
        detail?: unknown;
      }
    ).detail === "string"
  ) {
    return (
      result as {
        detail: string;
      }
    ).detail;
  }

  return `Telegram API HTTP ${status}`;
}

async function telegramApi<T>(
  path: string,
  options?: {
    method?: "GET" | "POST";
    body?: unknown;
    token?: string;
  }
): Promise<T> {
  const method =
    options?.method ?? "GET";

  const response =
    await fetch(
      `${TELEGRAM_API_BASE}${path}`,
      {
        method,

        headers: {
          Accept:
            "application/json",

          ...(options?.body !==
          undefined
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),

          ...(options?.token
            ? {
                Authorization:
                  `Bearer ${options.token}`,
              }
            : {}),
        },

        ...(options?.body !==
        undefined
          ? {
              body:
                JSON.stringify(
                  options.body
                ),
            }
          : {}),
      }
    );

  const result =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        result,
        response.status
      )
    );
  }

  return result as T;
}

export async function saveTelegramSession(
  owner: string,
  token: string,
  expiresIn = 0
): Promise<void> {
  const seconds =
    Number(expiresIn) || 0;

  const expiresAt =
    seconds > 0
      ? Date.now() +
        seconds * 1000
      : 0;

  const value: TelegramSession = {
    token,
    expiresAt,
  };

  await AsyncStorage.setItem(
    sessionKey(owner),
    JSON.stringify(value)
  );
}

export async function clearTelegramSession(
  owner: string
): Promise<void> {
  await AsyncStorage.removeItem(
    sessionKey(owner)
  );
}

export async function getTelegramToken(
  owner: string
): Promise<string> {
  const raw =
    await AsyncStorage.getItem(
      sessionKey(owner)
    );

  if (!raw) {
    return "";
  }

  try {
    const session =
      JSON.parse(
        raw
      ) as TelegramSession;

    if (!session.token) {
      return "";
    }

    if (
      session.expiresAt > 0 &&
      session.expiresAt <=
        Date.now() + 2500
    ) {
      await clearTelegramSession(
        owner
      );

      return "";
    }

    return session.token;
  } catch {
    await clearTelegramSession(
      owner
    );

    return "";
  }
}

async function signTelegramMessage(
  provider: Eip1193LikeProvider,
  owner: string,
  message: string
): Promise<string> {
  const signature =
    await provider.request({
      method:
        "personal_sign",

      params: [
        message,
        owner,
      ],
    });

  if (
    typeof signature !==
      "string" ||
    !signature
  ) {
    throw new Error(
      "Wallet returned no Telegram authentication signature."
    );
  }

  return signature;
}

/**
 * Restore Telegram access for a wallet
 * that has already been linked before.
 */
export async function connectExistingTelegram(
  owner: string,
  provider: Eip1193LikeProvider
): Promise<TelegramConnectResponse> {
  const wallet =
    normalizeOwner(owner);

  const challenge =
    await telegramApi<TelegramChallengeResponse>(
      "/api/owner/challenge",
      {
        method: "POST",

        body: {
          wallet,
        },
      }
    );

  const signature =
    await signTelegramMessage(
      provider,
      wallet,
      challenge.message
    );

  const result =
    await telegramApi<TelegramConnectResponse>(
      "/api/owner/connect",
      {
        method: "POST",

        body: {
          wallet,

          nonce:
            challenge.nonce,

          signature,
        },
      }
    );

  if (!result.accessToken) {
    throw new Error(
      "Telegram API returned no access token."
    );
  }

  await saveTelegramSession(
    wallet,
    result.accessToken,
    result.expiresIn ?? 0
  );

  return result;
}

/**
 * First-time owner pairing.
 *
 * Owner opens Telegram bot,
 * sends /connect,
 * then enters the one-time code.
 */
export async function pairTelegramWithCode(
  owner: string,
  code: string,
  provider: Eip1193LikeProvider
): Promise<TelegramConnectResponse> {
  const wallet =
    normalizeOwner(owner);

  const cleanCode =
    code.trim();

  if (!cleanCode) {
    throw new Error(
      "Telegram /connect code is required."
    );
  }

  const challenge =
    await telegramApi<TelegramChallengeResponse>(
      "/api/challenge",
      {
        method: "POST",

        body: {
          wallet,
          code: cleanCode,
        },
      }
    );

  const signature =
    await signTelegramMessage(
      provider,
      wallet,
      challenge.message
    );

  const result =
    await telegramApi<TelegramConnectResponse>(
      "/api/connect",
      {
        method: "POST",

        body: {
          wallet,
          code:
            cleanCode,
          nonce:
            challenge.nonce,
          signature,
        },
      }
    );

  if (!result.accessToken) {
    throw new Error(
      "Telegram API returned no access token."
    );
  }

  await saveTelegramSession(
    wallet,
    result.accessToken,
    result.expiresIn ?? 0
  );

  return result;
}

export async function getTelegramDirectory(
  owner: string
): Promise<
  TelegramDirectoryMember[]
> {
  const token =
    await getTelegramToken(
      owner
    );

  if (!token) {
    return [];
  }

  try {
    const result =
      await telegramApi<TelegramDirectoryResponse>(
        "/api/directory",
        {
          token,
        }
      );

    return Array.isArray(
      result.members
    )
      ? result.members
      : [];
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes(
          "session"
        ) ||
        error.message.includes(
          "Authorization"
        ) ||
        error.message.includes(
          "Invalid session"
        )
      )
    ) {
      await clearTelegramSession(
        owner
      );
    }

    throw error;
  }
}

/**
 * Register a Telegram member once
 * into the owner's Member Directory.
 *
 * Member obtains the one-time code
 * by sending /register to the bot.
 */
export async function registerTelegramMember(
  owner: string,
  input: TelegramRegisterMemberInput
): Promise<TelegramRegisterMemberResponse> {
  const token =
    await getTelegramToken(
      owner
    );

  if (!token) {
    throw new Error(
      "Telegram is not connected."
    );
  }

  const code =
    input.code.trim();

  const displayName =
    input.displayName.trim();

  const fullName =
    input.fullName?.trim() ??
    "";

  if (!code) {
    throw new Error(
      "Member /register code is required."
    );
  }

  if (!displayName) {
    throw new Error(
      "Member display name is required."
    );
  }

  return telegramApi<TelegramRegisterMemberResponse>(
    "/api/directory",
    {
      method: "POST",

      token,

      body: {
        code,
        displayName,
        fullName,
      },
    }
  );
}

export async function syncTelegramBill(
  owner: string,
  bill: TelegramBillPayload
): Promise<unknown> {
  const token =
    await getTelegramToken(
      owner
    );

  if (!token) {
    throw new Error(
      "Telegram is not connected. Connect Telegram first."
    );
  }

  if (
    !/^0x[0-9a-f]{64}$/i.test(
      bill.txHash
    )
  ) {
    throw new Error(
      "Bill transaction is not confirmed."
    );
  }

  return telegramApi(
    "/api/bills",
    {
      method: "POST",

      token,

      body: {
        id:
          bill.id,

        creator:
          normalizeOwner(
            bill.creator
          ),

        title:
          bill.title,

        totalRaw:
          bill.totalRaw,

        txHash:
          bill.txHash,

        members:
          bill.members.map(
            member => ({
              id:
                member.id,

              name:
                member.name.trim() ||
                "Member",

              raw:
                member.raw,

              directoryId:
                member.directoryId ||
                null,
            })
          ),
      },
    }
  );
}

export async function telegramHealth(): Promise<boolean> {
  try {
    const result =
      await telegramApi<{
        ok?: boolean;
        status?: string;
      }>("/health");

    return (
      result.ok === true ||
      result.status ===
        "ok"
    );
  } catch {
    return false;
  }
}