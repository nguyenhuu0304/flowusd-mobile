import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";

import {
  useAccount,
  useProvider,
} from "@reown/appkit-react-native";

import { ARC_TESTNET } from "@/constants/arc";

import {
  generateLinkId,
  parseUsdcAmount,
  submitBatchCreateLinks,
  waitForTransactionReceipt,
  type Eip1193LikeProvider,
} from "@/services/batchPaymentLinks";

import {
  createLocalBillId,
  saveMobileBill,
  type MobileBill,
} from "@/services/mobileBills";

import {
  connectExistingTelegram,
  getTelegramDirectory,
  getTelegramToken,
  pairTelegramWithCode,
  registerTelegramMember,
  syncTelegramBill,
  type TelegramDirectoryMember,
} from "@/services/telegramBridge";

type MemberInput = {
  id: number;
  name: string;
  amount: string;
  directoryId: string | null;
};

function normalizeChainId(
  value: string | undefined
): number | undefined {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("eip155:")) {
    const parsed = Number(
      value.replace("eip155:", "")
    );

    return Number.isFinite(parsed)
      ? parsed
      : undefined;
  }

  if (value.startsWith("0x")) {
    const parsed = parseInt(
      value,
      16
    );

    return Number.isFinite(parsed)
      ? parsed
      : undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function createEmptyMembers(): MemberInput[] {
  return [
    {
      id: 1,
      name: "",
      amount: "",
      directoryId: null,
    },
    {
      id: 2,
      name: "",
      amount: "",
      directoryId: null,
    },
  ];
}

function telegramMemberLabel(
  member: TelegramDirectoryMember
): string {
  if (
    member.display_name?.trim()
  ) {
    return member.display_name.trim();
  }

  if (
    member.full_name?.trim()
  ) {
    return member.full_name.trim();
  }

  if (
    member.username?.trim()
  ) {
    return `@${member.username.trim()}`;
  }

  return "Telegram member";
}

export default function SplitBillScreen() {
  const {
    address,
    isConnected,
    chainId,
  } = useAccount();

  const { provider } =
    useProvider();

  const currentChainId =
    normalizeChainId(chainId);

  const [title, setTitle] =
    useState("");

  const [members, setMembers] =
    useState<MemberInput[]>(
      createEmptyMembers()
    );

  const [busy, setBusy] =
    useState(false);

  const [status, setStatus] =
    useState("");

  const [
    lastCreatedBillId,
    setLastCreatedBillId,
  ] = useState<string | null>(
    null
  );

  const [
    telegramConnected,
    setTelegramConnected,
  ] = useState(false);

  const [
    telegramBusy,
    setTelegramBusy,
  ] = useState(false);

  const [
    telegramCode,
    setTelegramCode,
  ] = useState("");

  const [
    telegramMembers,
    setTelegramMembers,
  ] = useState<
    TelegramDirectoryMember[]
  >([]);

  const [
    telegramStatus,
    setTelegramStatus,
  ] = useState("");

  const [
    registerCode,
    setRegisterCode,
  ] = useState("");

  const [
    registerDisplayName,
    setRegisterDisplayName,
  ] = useState("");

  const [
    registerFullName,
    setRegisterFullName,
  ] = useState("");

  const totalAmount =
    useMemo(() => {
      return members.reduce(
        (
          sum,
          member
        ) => {
          const value =
            Number(
              member.amount
            );

          return Number.isFinite(
            value
          )
            ? sum + value
            : sum;
        },
        0
      );
    }, [members]);

  const loadTelegramDirectory =
    async (
      owner: string
    ) => {
      const directory =
        await getTelegramDirectory(
          owner
        );

      setTelegramMembers(
        directory
      );

      return directory;
    };

  useEffect(() => {
    let active = true;

    const restoreTelegram =
      async () => {
        if (!address) {
          setTelegramConnected(
            false
          );

          setTelegramMembers(
            []
          );

          setTelegramStatus(
            ""
          );

          return;
        }

        try {
          const token =
            await getTelegramToken(
              address
            );

          if (!active) {
            return;
          }

          if (!token) {
            setTelegramConnected(
              false
            );

            setTelegramMembers(
              []
            );

            setTelegramStatus(
              "Telegram not connected on this device."
            );

            return;
          }

          setTelegramConnected(
            true
          );

          const directory =
            await getTelegramDirectory(
              address
            );

          if (!active) {
            return;
          }

          setTelegramMembers(
            directory
          );

          setTelegramStatus(
            `Telegram connected · ${directory.length} registered member${
              directory.length === 1
                ? ""
                : "s"
            }`
          );
        } catch (error) {
          if (!active) {
            return;
          }

          setTelegramConnected(
            false
          );

          setTelegramMembers(
            []
          );

          setTelegramStatus(
            error instanceof Error
              ? error.message
              : String(error)
          );
        }
      };

    void restoreTelegram();

    return () => {
      active = false;
    };
  }, [address]);

  const addMember = () => {
    setMembers(current => [
      ...current,
      {
        id: Date.now(),
        name: "",
        amount: "",
        directoryId: null,
      },
    ]);
  };

  const removeMember = (
    id: number
  ) => {
    if (
      members.length <= 2
    ) {
      Alert.alert(
        "Split Bill",
        "A split bill needs at least 2 members."
      );

      return;
    }

    setMembers(current =>
      current.filter(
        member =>
          member.id !== id
      )
    );
  };

  const updateMember = (
    id: number,
    field:
      | "name"
      | "amount",
    value: string
  ) => {
    setMembers(current =>
      current.map(member =>
        member.id === id
          ? {
              ...member,
              [field]:
                value,
            }
          : member
      )
    );
  };

  const selectDirectoryMember =
    (
      memberId: number,
      directory:
        TelegramDirectoryMember
    ) => {
      setMembers(current =>
        current.map(member =>
          member.id ===
          memberId
            ? {
                ...member,

                name:
                  telegramMemberLabel(
                    directory
                  ),

                directoryId:
                  directory.id,
              }
            : member
        )
      );
    };

  const clearDirectoryMember =
    (
      memberId: number
    ) => {
      setMembers(current =>
        current.map(member =>
          member.id ===
          memberId
            ? {
                ...member,
                directoryId:
                  null,
              }
            : member
        )
      );
    };

  const openBill = (
    billId: string
  ) => {
    router.push(
      `/bills/${billId}` as never
    );
  };

  const handleRestoreTelegram =
    async () => {
      if (
        telegramBusy ||
        !address ||
        !provider
      ) {
        return;
      }

      if (
        currentChainId !==
        ARC_TESTNET.id
      ) {
        Alert.alert(
          "Wrong network",
          "Switch your wallet to Arc Testnet first."
        );

        return;
      }

      setTelegramBusy(
        true
      );

      setTelegramStatus(
        "Requesting Telegram owner authentication..."
      );

      try {
        await connectExistingTelegram(
          address,
          provider as Eip1193LikeProvider
        );

        const directory =
          await loadTelegramDirectory(
            address
          );

        setTelegramConnected(
          true
        );

        setTelegramStatus(
          `Telegram connected · ${directory.length} registered member${
            directory.length === 1
              ? ""
              : "s"
          }`
        );

        Alert.alert(
          "Telegram connected",
          "FlowUSD Mobile can now use your Telegram Member Directory."
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setTelegramConnected(
          false
        );

        setTelegramStatus(
          message
        );

        Alert.alert(
          "Telegram connection failed",
          message
        );
      } finally {
        setTelegramBusy(
          false
        );
      }
    };

  const handlePairTelegram =
    async () => {
      if (
        telegramBusy ||
        !address ||
        !provider
      ) {
        return;
      }

      if (
        currentChainId !==
        ARC_TESTNET.id
      ) {
        Alert.alert(
          "Wrong network",
          "Switch your wallet to Arc Testnet first."
        );

        return;
      }

      if (
        !telegramCode.trim()
      ) {
        Alert.alert(
          "Telegram code required",
          "Open the FlowUSD Telegram bot, send /connect, then enter the code here."
        );

        return;
      }

      setTelegramBusy(
        true
      );

      setTelegramStatus(
        "Linking Telegram..."
      );

      try {
        await pairTelegramWithCode(
          address,
          telegramCode,
          provider as Eip1193LikeProvider
        );

        const directory =
          await loadTelegramDirectory(
            address
          );

        setTelegramConnected(
          true
        );

        setTelegramCode(
          ""
        );

        setTelegramStatus(
          `Telegram connected · ${directory.length} registered member${
            directory.length === 1
              ? ""
              : "s"
          }`
        );

        Alert.alert(
          "Telegram linked",
          "Your wallet is now connected to FlowUSD Telegram."
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setTelegramStatus(
          message
        );

        Alert.alert(
          "Telegram link failed",
          message
        );
      } finally {
        setTelegramBusy(
          false
        );
      }
    };

  const handleRefreshDirectory =
    async () => {
      if (
        telegramBusy ||
        !address
      ) {
        return;
      }

      setTelegramBusy(
        true
      );

      setTelegramStatus(
        "Refreshing Member Directory..."
      );

      try {
        const directory =
          await loadTelegramDirectory(
            address
          );

        setTelegramConnected(
          true
        );

        setTelegramStatus(
          `Telegram connected · ${directory.length} registered member${
            directory.length === 1
              ? ""
              : "s"
          }`
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setTelegramStatus(
          message
        );

        Alert.alert(
          "Directory refresh failed",
          message
        );
      } finally {
        setTelegramBusy(
          false
        );
      }
    };

  const handleRegisterMember =
    async () => {
      if (
        telegramBusy ||
        !address
      ) {
        return;
      }

      if (
        !registerCode.trim()
      ) {
        Alert.alert(
          "Register code required",
          "Ask the member to open the FlowUSD Telegram bot and send /register."
        );

        return;
      }

      if (
        !registerDisplayName.trim()
      ) {
        Alert.alert(
          "Display name required",
          "Enter a display name for this member."
        );

        return;
      }

      setTelegramBusy(
        true
      );

      setTelegramStatus(
        "Registering Telegram member..."
      );

      try {
        await registerTelegramMember(
          address,
          {
            code:
              registerCode,

            displayName:
              registerDisplayName,

            fullName:
              registerFullName,
          }
        );

        const directory =
          await loadTelegramDirectory(
            address
          );

        setRegisterCode(
          ""
        );

        setRegisterDisplayName(
          ""
        );

        setRegisterFullName(
          ""
        );

        setTelegramStatus(
          `Member registered · ${directory.length} saved member${
            directory.length === 1
              ? ""
              : "s"
          }`
        );

        Alert.alert(
          "Member registered",
          "The Telegram member has been added to your FlowUSD Member Directory."
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setTelegramStatus(
          message
        );

        Alert.alert(
          "Register member failed",
          message
        );
      } finally {
        setTelegramBusy(
          false
        );
      }
    };

  const handleCreateBill =
    async () => {
      if (busy) {
        return;
      }

      if (
        !isConnected ||
        !address
      ) {
        Alert.alert(
          "Wallet required",
          "Connect your wallet before creating a Split Bill."
        );

        return;
      }

      if (!provider) {
        Alert.alert(
          "Wallet unavailable",
          "Wallet provider is unavailable. Reconnect your wallet and try again."
        );

        return;
      }

      if (
        currentChainId !==
        ARC_TESTNET.id
      ) {
        Alert.alert(
          "Wrong network",
          "Please switch your wallet to Arc Testnet."
        );

        return;
      }

      if (
        members.length < 2 ||
        members.length > 100
      ) {
        Alert.alert(
          "Invalid members",
          "Split Bill supports 2 to 100 members."
        );

        return;
      }

      try {
        setLastCreatedBillId(
          null
        );

        const ids: string[] =
          [];

        const amounts: bigint[] =
          [];

        for (
          let index = 0;
          index <
          members.length;
          index++
        ) {
          const member =
            members[
              index
            ];

          if (
            !member.name.trim()
          ) {
            throw new Error(
              `Enter a name for member ${
                index + 1
              }.`
            );
          }

          const raw =
            parseUsdcAmount(
              member.amount
            );

          if (
            raw <= 0n
          ) {
            throw new Error(
              `Member ${
                index + 1
              } amount must be greater than 0.`
            );
          }

          ids.push(
            generateLinkId()
          );

          amounts.push(
            raw
          );
        }

        setBusy(
          true
        );

        setStatus(
          "Waiting for wallet confirmation..."
        );

        const txHash =
          await submitBatchCreateLinks(
            provider as Eip1193LikeProvider,
            address,
            ids,
            amounts,
            currentChainId
          );

        setStatus(
          "Transaction submitted. Waiting for Arc Testnet confirmation..."
        );

        await waitForTransactionReceipt(
          provider as Eip1193LikeProvider,
          txHash,
          currentChainId
        );

        const totalRaw =
          amounts.reduce(
            (
              sum,
              amount
            ) =>
              sum +
              amount,
            0n
          );

        const localBillId =
          createLocalBillId();

        const bill: MobileBill =
          {
            id:
              localBillId,

            title:
              title.trim() ||
              "Split Bill",

            creator:
              address,

            createdAt:
              new Date()
                .toISOString(),

            totalRaw:
              totalRaw.toString(),

            members:
              members.map(
                (
                  member,
                  index
                ) => ({
                  id:
                    ids[index],

                  name:
                    member.name.trim(),

                  amountRaw:
                    amounts[
                      index
                    ].toString(),

                  status:
                    "unpaid",

                  directoryId:
                    member.directoryId,
                })
              ),

            txHash,

            network: {
              name:
                ARC_TESTNET.name,

              chainId:
                ARC_TESTNET.id,
            },

            contractAddress:
              ARC_TESTNET
                .contracts
                .batchSplitBill,
          };

        try {
          await saveMobileBill(
            address,
            bill
          );
        } catch (
          storageError
        ) {
          const message =
            storageError instanceof Error
              ? storageError.message
              : String(
                  storageError
                );

          setStatus(
            `Blockchain confirmed, but local save failed: ${message}`
          );

          Alert.alert(
            "Transaction confirmed",
            `The Split Bill was created on Arc Testnet, but FlowUSD could not save it locally.\n\nTx: ${txHash}`
          );

          return;
        }

        let telegramMessage =
          "";

        if (
          telegramConnected
        ) {
          try {
            setStatus(
              "Blockchain confirmed. Sending Telegram notifications..."
            );

            await syncTelegramBill(
              address,
              {
                id:
                  localBillId,

                creator:
                  address,

                title:
                  bill.title,

                totalRaw:
                  bill.totalRaw,

                txHash,

                members:
                  members.map(
                    (
                      member,
                      index
                    ) => ({
                      id:
                        ids[
                          index
                        ],

                      name:
                        member
                          .name
                          .trim(),

                      raw:
                        amounts[
                          index
                        ].toString(),

                      directoryId:
                        member.directoryId,
                    })
                  ),
              }
            );

            telegramMessage =
              "\n\nTelegram notifications sent to registered members.";

            setStatus(
              "Confirmed, saved and synced to Telegram."
            );
          } catch (
            telegramError
          ) {
            const message =
              telegramError instanceof Error
                ? telegramError.message
                : String(
                    telegramError
                  );

            telegramMessage =
              `\n\nBill created, but Telegram sync failed: ${message}`;

            setStatus(
              `Blockchain confirmed and saved. Telegram sync failed: ${message}`
            );
          }
        } else {
          setStatus(
            `Confirmed and saved: ${txHash}`
          );

          telegramMessage =
            "\n\nTelegram was not connected, so no Telegram notification was sent.";
        }

        setLastCreatedBillId(
          localBillId
        );

        setTitle(
          ""
        );

        setMembers(
          createEmptyMembers()
        );

        Alert.alert(
          "Split Bill created",
          `${bill.members.length} payment links were created and saved.${telegramMessage}\n\nTx: ${txHash}`,
          [
            {
              text:
                "Done",
              style:
                "cancel",
            },
            {
              text:
                "View Bill",
              onPress:
                () =>
                  openBill(
                    localBillId
                  ),
            },
          ]
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        setStatus(
          message
        );

        Alert.alert(
          "Create Split Bill failed",
          message
        );
      } finally {
        setBusy(
          false
        );
      }
    };

  return (
    <ScrollView
      style={
        styles.screen
      }
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={
        false
      }
    >
      <View
        style={
          styles.header
        }
      >
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={
            styles.backButton
          }
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            ← Back
          </Text>
        </TouchableOpacity>

        <Text
          style={
            styles.title
          }
        >
          Split Bill
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Create multiple USDC payment links in one Arc Testnet transaction.
        </Text>
      </View>

      <View
        style={
          styles.telegramCard
        }
      >
        <View
          style={
            styles.telegramHeader
          }
        >
          <View
            style={
              styles.telegramHeaderText
            }
          >
            <Text
              style={
                styles.telegramTitle
              }
            >
              Telegram
            </Text>

            <Text
              style={
                styles.telegramSubtitle
              }
            >
              Notify registered members when a bill is created.
            </Text>
          </View>

          <View
            style={[
              styles.telegramBadge,

              telegramConnected
                ? styles.telegramBadgeOn
                : styles.telegramBadgeOff,
            ]}
          >
            <Text
              style={[
                styles.telegramBadgeText,

                telegramConnected
                  ? styles.telegramBadgeTextOn
                  : styles.telegramBadgeTextOff,
              ]}
            >
              {telegramConnected
                ? "CONNECTED"
                : "OFF"}
            </Text>
          </View>
        </View>

        {!telegramConnected ? (
          <>
            <TouchableOpacity
              style={
                styles.telegramPrimaryButton
              }
              disabled={
                telegramBusy ||
                busy
              }
              onPress={
                handleRestoreTelegram
              }
            >
              <Text
                style={
                  styles.telegramPrimaryButtonText
                }
              >
                {telegramBusy
                  ? "Connecting..."
                  : "Restore Telegram Session"}
              </Text>
            </TouchableOpacity>

            <Text
              style={
                styles.telegramOr
              }
            >
              First time linking?
            </Text>

            <TextInput
              style={
                styles.input
              }
              placeholder="Telegram /connect code"
              placeholderTextColor="#98a2b3"
              autoCapitalize="none"
              value={
                telegramCode
              }
              editable={
                !telegramBusy &&
                !busy
              }
              onChangeText={
                setTelegramCode
              }
            />

            <TouchableOpacity
              style={
                styles.telegramSecondaryButton
              }
              disabled={
                telegramBusy ||
                busy
              }
              onPress={
                handlePairTelegram
              }
            >
              <Text
                style={
                  styles.telegramSecondaryButtonText
                }
              >
                Link with /connect Code
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View
              style={
                styles.directoryRegisterCard
              }
            >
              <Text
                style={
                  styles.directoryRegisterTitle
                }
              >
                Member Directory
              </Text>

              <Text
                style={
                  styles.directoryRegisterHelp
                }
              >
                Member sends /register to the FlowUSD Telegram bot, then gives you the one-time code.
              </Text>

              <TextInput
                style={[
                  styles.input,
                  styles.registerInput,
                ]}
                placeholder="Member /register code"
                placeholderTextColor="#98a2b3"
                autoCapitalize="none"
                value={
                  registerCode
                }
                editable={
                  !telegramBusy &&
                  !busy
                }
                onChangeText={
                  setRegisterCode
                }
              />

              <TextInput
                style={[
                  styles.input,
                  styles.registerInput,
                ]}
                placeholder="Display name (e.g. Huy)"
                placeholderTextColor="#98a2b3"
                value={
                  registerDisplayName
                }
                editable={
                  !telegramBusy &&
                  !busy
                }
                maxLength={
                  60
                }
                onChangeText={
                  setRegisterDisplayName
                }
              />

              <TextInput
                style={[
                  styles.input,
                  styles.registerInput,
                ]}
                placeholder="Full name (optional)"
                placeholderTextColor="#98a2b3"
                value={
                  registerFullName
                }
                editable={
                  !telegramBusy &&
                  !busy
                }
                maxLength={
                  120
                }
                onChangeText={
                  setRegisterFullName
                }
              />

              <TouchableOpacity
                style={[
                  styles.addDirectoryButton,

                  (
                    telegramBusy ||
                    !registerCode.trim() ||
                    !registerDisplayName.trim()
                  ) &&
                    styles.disabledButton,
                ]}
                disabled={
                  telegramBusy ||
                  busy ||
                  !registerCode.trim() ||
                  !registerDisplayName.trim()
                }
                onPress={
                  handleRegisterMember
                }
              >
                <Text
                  style={
                    styles.addDirectoryButtonText
                  }
                >
                  {telegramBusy
                    ? "Registering..."
                    : "Add Member"}
                </Text>
              </TouchableOpacity>

              <Text
                style={
                  styles.savedMembersText
                }
              >
                Saved members:{" "}
                <Text
                  style={
                    styles.savedMembersCount
                  }
                >
                  {telegramMembers.length}
                </Text>
              </Text>
            </View>

            <TouchableOpacity
              style={
                styles.telegramSecondaryButton
              }
              disabled={
                telegramBusy ||
                busy
              }
              onPress={
                handleRefreshDirectory
              }
            >
              <Text
                style={
                  styles.telegramSecondaryButtonText
                }
              >
                Refresh Member Directory
              </Text>
            </TouchableOpacity>
          </>
        )}

        {telegramStatus ? (
          <Text
            style={
              styles.telegramStatus
            }
          >
            {telegramStatus}
          </Text>
        ) : null}
      </View>

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.label
          }
        >
          Bill title
        </Text>

        <TextInput
          style={
            styles.input
          }
          placeholder="Dinner, trip, team expense..."
          placeholderTextColor="#98a2b3"
          value={
            title
          }
          editable={
            !busy
          }
          onChangeText={
            setTitle
          }
        />
      </View>

      <View
        style={
          styles.summaryCard
        }
      >
        <Text
          style={
            styles.summaryLabel
          }
        >
          Total
        </Text>

        <Text
          style={
            styles.summaryValue
          }
        >
          {totalAmount.toFixed(
            2
          )}{" "}
          USDC
        </Text>

        <Text
          style={
            styles.summaryMembers
          }
        >
          {members.length} members
        </Text>
      </View>

      <View
        style={
          styles.sectionHeader
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Members
        </Text>

        <TouchableOpacity
          onPress={
            addMember
          }
          style={
            styles.addButton
          }
          disabled={
            busy
          }
        >
          <Text
            style={
              styles.addButtonText
            }
          >
            + Add member
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={
          styles.memberList
        }
      >
        {members.map(
          (
            member,
            index
          ) => (
            <View
              key={
                member.id
              }
              style={
                styles.memberCard
              }
            >
              <View
                style={
                  styles.memberHeader
                }
              >
                <Text
                  style={
                    styles.memberTitle
                  }
                >
                  Member {index + 1}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    removeMember(
                      member.id
                    )
                  }
                  disabled={
                    busy
                  }
                >
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>

              {telegramConnected &&
              telegramMembers.length >
                0 ? (
                <View
                  style={
                    styles.directorySection
                  }
                >
                  <Text
                    style={
                      styles.directoryLabel
                    }
                  >
                    Telegram Member Directory
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={
                      false
                    }
                    contentContainerStyle={
                      styles.directoryRow
                    }
                  >
                    {telegramMembers.map(
                      directory => {
                        const selected =
                          member.directoryId ===
                          directory.id;

                        return (
                          <TouchableOpacity
                            key={
                              directory.id
                            }
                            style={[
                              styles.directoryChip,

                              selected &&
                                styles.directoryChipSelected,
                            ]}
                            onPress={() =>
                              selectDirectoryMember(
                                member.id,
                                directory
                              )
                            }
                            disabled={
                              busy
                            }
                          >
                            <Text
                              style={[
                                styles.directoryChipText,

                                selected &&
                                  styles.directoryChipTextSelected,
                              ]}
                            >
                              {telegramMemberLabel(
                                directory
                              )}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}

                    {member.directoryId ? (
                      <TouchableOpacity
                        style={
                          styles.clearChip
                        }
                        onPress={() =>
                          clearDirectoryMember(
                            member.id
                          )
                        }
                        disabled={
                          busy
                        }
                      >
                        <Text
                          style={
                            styles.clearChipText
                          }
                        >
                          Clear
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}

              <Text
                style={
                  styles.label
                }
              >
                Name
              </Text>

              <TextInput
                style={
                  styles.input
                }
                placeholder="Member name"
                placeholderTextColor="#98a2b3"
                value={
                  member.name
                }
                editable={
                  !busy
                }
                onChangeText={
                  value =>
                    updateMember(
                      member.id,
                      "name",
                      value
                    )
                }
              />

              <Text
                style={
                  styles.amountLabel
                }
              >
                Amount
              </Text>

              <View
                style={
                  styles.amountRow
                }
              >
                <TextInput
                  style={[
                    styles.input,
                    styles.amountInput,
                  ]}
                  placeholder="0.00"
                  placeholderTextColor="#98a2b3"
                  keyboardType="decimal-pad"
                  value={
                    member.amount
                  }
                  editable={
                    !busy
                  }
                  onChangeText={
                    value =>
                      updateMember(
                        member.id,
                        "amount",
                        value
                      )
                  }
                />

                <View
                  style={
                    styles.currencyBox
                  }
                >
                  <Text
                    style={
                      styles.currencyText
                    }
                  >
                    USDC
                  </Text>
                </View>
              </View>

              {member.directoryId ? (
                <Text
                  style={
                    styles.telegramSelected
                  }
                >
                  Telegram notification enabled
                </Text>
              ) : null}
            </View>
          )
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.createButton,

          busy &&
            styles.createButtonDisabled,
        ]}
        onPress={
          handleCreateBill
        }
        disabled={
          busy
        }
        activeOpacity={
          0.85
        }
      >
        <Text
          style={
            styles.createButtonText
          }
        >
          {busy
            ? "Creating..."
            : "Create Split Bill"}
        </Text>
      </TouchableOpacity>

      {status ? (
        <View
          style={
            styles.statusBox
          }
        >
          <Text
            style={
              styles.statusText
            }
          >
            {status}
          </Text>
        </View>
      ) : null}

      {lastCreatedBillId ? (
        <TouchableOpacity
          style={
            styles.viewBillButton
          }
          onPress={() =>
            openBill(
              lastCreatedBillId
            )
          }
          activeOpacity={
            0.85
          }
        >
          <Text
            style={
              styles.viewBillButtonText
            }
          >
            View Last Created Bill
          </Text>
        </TouchableOpacity>
      ) : null}

      <Text
        style={
          styles.note
        }
      >
        Arc Testnet · FlowUSD
      </Text>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        "#f5f7fb",
    },

    content: {
      padding: 20,
      paddingTop: 48,
      paddingBottom: 40,
    },

    header: {
      marginBottom: 20,
    },

    backButton: {
      alignSelf:
        "flex-start",
      marginBottom: 14,
    },

    backButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#1769ff",
    },

    title: {
      fontSize: 30,
      fontWeight: "800",
      color: "#161b22",
    },

    subtitle: {
      marginTop: 7,
      fontSize: 15,
      lineHeight: 21,
      color: "#667085",
    },

    telegramCard: {
      backgroundColor:
        "#ffffff",
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor:
        "#d8e5ff",
      marginBottom: 14,
    },

    telegramHeader: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      gap: 12,
      marginBottom: 14,
    },

    telegramHeaderText: {
      flex: 1,
    },

    telegramTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: "#161b22",
    },

    telegramSubtitle: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
      color: "#667085",
    },

    telegramBadge: {
      alignSelf:
        "flex-start",
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
    },

    telegramBadgeOn: {
      backgroundColor:
        "#ecfdf3",
    },

    telegramBadgeOff: {
      backgroundColor:
        "#f2f4f7",
    },

    telegramBadgeText: {
      fontSize: 10,
      fontWeight: "800",
    },

    telegramBadgeTextOn: {
      color: "#027a48",
    },

    telegramBadgeTextOff: {
      color: "#667085",
    },

    telegramPrimaryButton: {
      backgroundColor:
        "#1769ff",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems:
        "center",
    },

    telegramPrimaryButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#ffffff",
    },

    telegramSecondaryButton: {
      marginTop: 10,
      borderWidth: 1,
      borderColor:
        "#1769ff",
      borderRadius: 12,
      paddingVertical: 11,
      alignItems:
        "center",
    },

    telegramSecondaryButtonText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#1769ff",
    },

    telegramOr: {
      marginVertical: 10,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
      color: "#98a2b3",
    },

    telegramStatus: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 17,
      color: "#475467",
    },

    directoryRegisterCard: {
      padding: 13,
      borderRadius: 13,
      backgroundColor:
        "#f8fafc",
      borderWidth: 1,
      borderColor:
        "#e4e7ec",
    },

    directoryRegisterTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: "#161b22",
    },

    directoryRegisterHelp: {
      marginTop: 5,
      marginBottom: 10,
      fontSize: 12,
      lineHeight: 17,
      color: "#667085",
    },

    registerInput: {
      marginBottom: 9,
    },

    addDirectoryButton: {
      backgroundColor:
        "#12b76a",
      borderRadius: 11,
      paddingVertical: 11,
      alignItems:
        "center",
    },

    addDirectoryButtonText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#ffffff",
    },

    disabledButton: {
      opacity: 0.5,
    },

    savedMembersText: {
      marginTop: 10,
      fontSize: 12,
      color: "#667085",
    },

    savedMembersCount: {
      fontWeight: "800",
      color: "#161b22",
    },

    card: {
      backgroundColor:
        "#ffffff",
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor:
        "#e3e7ef",
      marginBottom: 14,
    },

    summaryCard: {
      backgroundColor:
        "#1769ff",
      borderRadius: 16,
      padding: 18,
      marginBottom: 22,
    },

    summaryLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: "#dce8ff",
    },

    summaryValue: {
      marginTop: 5,
      fontSize: 28,
      fontWeight: "800",
      color: "#ffffff",
    },

    summaryMembers: {
      marginTop: 5,
      fontSize: 13,
      color: "#dce8ff",
    },

    sectionHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      marginBottom: 12,
    },

    sectionTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: "#161b22",
    },

    addButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor:
        "#e8f0ff",
    },

    addButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#1769ff",
    },

    memberList: {
      gap: 12,
    },

    memberCard: {
      backgroundColor:
        "#ffffff",
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor:
        "#e3e7ef",
    },

    memberHeader: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      marginBottom: 14,
    },

    memberTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: "#161b22",
    },

    removeText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#d92d20",
    },

    directorySection: {
      marginBottom: 14,
    },

    directoryLabel: {
      marginBottom: 8,
      fontSize: 12,
      fontWeight: "700",
      color: "#475467",
    },

    directoryRow: {
      gap: 8,
      paddingRight: 5,
    },

    directoryChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor:
        "#d0d5dd",
      backgroundColor:
        "#ffffff",
    },

    directoryChipSelected: {
      borderColor:
        "#1769ff",
      backgroundColor:
        "#e8f0ff",
    },

    directoryChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#475467",
    },

    directoryChipTextSelected: {
      color: "#1769ff",
    },

    clearChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor:
        "#fff1f0",
    },

    clearChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#d92d20",
    },

    telegramSelected: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: "700",
      color: "#027a48",
    },

    label: {
      fontSize: 13,
      fontWeight: "700",
      color: "#475467",
      marginBottom: 7,
    },

    amountLabel: {
      marginTop: 14,
      marginBottom: 7,
      fontSize: 13,
      fontWeight: "700",
      color: "#475467",
    },

    input: {
      borderWidth: 1,
      borderColor:
        "#d0d5dd",
      backgroundColor:
        "#ffffff",
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 15,
      color: "#161b22",
    },

    amountRow: {
      flexDirection:
        "row",
      gap: 10,
    },

    amountInput: {
      flex: 1,
    },

    currencyBox: {
      minWidth: 70,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 12,
      backgroundColor:
        "#eef4ff",
      borderWidth: 1,
      borderColor:
        "#d5e3ff",
    },

    currencyText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#1769ff",
    },

    createButton: {
      marginTop: 22,
      backgroundColor:
        "#1769ff",
      borderRadius: 13,
      paddingVertical: 15,
      alignItems:
        "center",
    },

    createButtonDisabled: {
      opacity: 0.55,
    },

    createButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#ffffff",
    },

    statusBox: {
      marginTop: 14,
      padding: 12,
      borderRadius: 12,
      backgroundColor:
        "#eef4ff",
    },

    statusText: {
      fontSize: 13,
      lineHeight: 18,
      color: "#344054",
    },

    viewBillButton: {
      marginTop: 12,
      borderWidth: 1,
      borderColor:
        "#1769ff",
      backgroundColor:
        "#ffffff",
      borderRadius: 13,
      paddingVertical: 14,
      alignItems:
        "center",
    },

    viewBillButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#1769ff",
    },

    note: {
      marginTop: 14,
      textAlign:
        "center",
      fontSize: 12,
      fontWeight: "600",
      color: "#98a2b3",
    },
  });