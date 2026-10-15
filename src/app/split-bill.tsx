import { useMemo, useState } from "react";
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

type MemberInput = {
  id: number;
  name: string;
  amount: string;
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
    const parsed = parseInt(value, 16);

    return Number.isFinite(parsed)
      ? parsed
      : undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

export default function SplitBillScreen() {
  const {
    address,
    isConnected,
    chainId,
  } = useAccount();

  const { provider } = useProvider();

  const currentChainId =
    normalizeChainId(chainId);

  const [title, setTitle] =
    useState("");

  const [members, setMembers] =
    useState<MemberInput[]>([
      {
        id: 1,
        name: "",
        amount: "",
      },
      {
        id: 2,
        name: "",
        amount: "",
      },
    ]);

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

  const totalAmount = useMemo(() => {
    return members.reduce(
      (sum, member) => {
        const value =
          Number(member.amount);

        return Number.isFinite(value)
          ? sum + value
          : sum;
      },
      0
    );
  }, [members]);

  const addMember = () => {
    setMembers(current => [
      ...current,
      {
        id: Date.now(),
        name: "",
        amount: "",
      },
    ]);
  };

  const removeMember = (
    id: number
  ) => {
    if (members.length <= 2) {
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
    field: "name" | "amount",
    value: string
  ) => {
    setMembers(current =>
      current.map(member =>
        member.id === id
          ? {
              ...member,
              [field]: value,
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

        const ids: string[] = [];
        const amounts: bigint[] = [];

        for (
          let index = 0;
          index < members.length;
          index++
        ) {
          const member =
            members[index];

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

          if (raw <= 0n) {
            throw new Error(
              `Member ${
                index + 1
              } amount must be greater than 0.`
            );
          }

          ids.push(
            generateLinkId()
          );

          amounts.push(raw);
        }

        setBusy(true);

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
            (sum, amount) =>
              sum + amount,
            0n
          );

        const localBillId =
          createLocalBillId();

        const bill: MobileBill = {
          id: localBillId,

          title:
            title.trim() ||
            "Split Bill",

          creator: address,

          createdAt:
            new Date().toISOString(),

          totalRaw:
            totalRaw.toString(),

          members:
            members.map(
              (
                member,
                index
              ) => ({
                id: ids[index],

                name:
                  member.name.trim(),

                amountRaw:
                  amounts[
                    index
                  ].toString(),

                status:
                  "unpaid",
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
            ARC_TESTNET.contracts
              .batchSplitBill,
        };

        try {
          await saveMobileBill(
            address,
            bill
          );
        } catch (storageError) {
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

        setLastCreatedBillId(
          localBillId
        );

        setStatus(
          `Confirmed and saved: ${txHash}`
        );

        setTitle("");

        setMembers([
          {
            id: 1,
            name: "",
            amount: "",
          },
          {
            id: 2,
            name: "",
            amount: "",
          },
        ]);

        Alert.alert(
          "Split Bill created",
          `${bill.members.length} payment links were created and saved on this device.\n\nBill ID: ${localBillId}\n\nTx: ${txHash}`,
          [
            {
              text: "Done",
              style: "cancel",
            },
            {
              text: "View Bill",
              onPress: () =>
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

        setStatus(message);

        Alert.alert(
          "Create Split Bill failed",
          message
        );
      } finally {
        setBusy(false);
      }
    };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={
        false
      }
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            ← Back
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          Split Bill
        </Text>

        <Text
          style={styles.subtitle}
        >
          Create multiple USDC payment links in one Arc Testnet transaction.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>
          Bill title
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Dinner, trip, team expense..."
          placeholderTextColor="#98a2b3"
          value={title}
          onChangeText={setTitle}
        />
      </View>

      <View
        style={styles.summaryCard}
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
          {totalAmount.toFixed(2)} USDC
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
        style={styles.sectionHeader}
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Members
        </Text>

        <TouchableOpacity
          onPress={addMember}
          style={styles.addButton}
          disabled={busy}
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
        style={styles.memberList}
      >
        {members.map(
          (member, index) => (
            <View
              key={member.id}
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
                  disabled={busy}
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

              <Text
                style={styles.label}
              >
                Name
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Member name"
                placeholderTextColor="#98a2b3"
                value={member.name}
                editable={!busy}
                onChangeText={value =>
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
                  editable={!busy}
                  onChangeText={value =>
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
        disabled={busy}
        activeOpacity={0.85}
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
          style={styles.statusBox}
        >
          <Text
            style={styles.statusText}
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
          activeOpacity={0.85}
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

      <Text style={styles.note}>
        Arc Testnet · FlowUSD
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },

  content: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 24,
  },

  backButton: {
    alignSelf: "flex-start",
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

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e3e7ef",
    marginBottom: 14,
  },

  summaryCard: {
    backgroundColor: "#1769ff",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    backgroundColor: "#e8f0ff",
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e3e7ef",
  },

  memberHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    borderColor: "#d0d5dd",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    color: "#161b22",
  },

  amountRow: {
    flexDirection: "row",
    gap: 10,
  },

  amountInput: {
    flex: 1,
  },

  currencyBox: {
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#eef4ff",
    borderWidth: 1,
    borderColor: "#d5e3ff",
  },

  currencyText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1769ff",
  },

  createButton: {
    marginTop: 22,
    backgroundColor: "#1769ff",
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
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
    backgroundColor: "#eef4ff",
  },

  statusText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#344054",
  },

  viewBillButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#1769ff",
    backgroundColor: "#ffffff",
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
  },

  viewBillButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1769ff",
  },

  note: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#98a2b3",
  },
});