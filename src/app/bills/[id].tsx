import {
  useCallback,
  useState,
} from "react";

import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";

import {
  useAccount,
} from "@reown/appkit-react-native";

import { ARC_TESTNET } from "@/constants/arc";

import {
  getMobileBill,
  rawUsdcToDisplay,
  type MobileBill,
} from "@/services/mobileBills";

function shortHash(
  value: string,
  start = 8,
  end = 6
): string {
  if (value.length <= start + end) {
    return value;
  }

  return (
    value.slice(0, start) +
    "..." +
    value.slice(-end)
  );
}

function formatDate(
  value: string
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

export default function BillDetailScreen() {
  const params =
    useLocalSearchParams<{
      id?: string | string[];
    }>();

  const {
    address,
    isConnected,
  } = useAccount();

  const [bill, setBill] =
    useState<MobileBill | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const billId =
    Array.isArray(params.id)
      ? params.id[0]
      : params.id;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadBill() {
        setLoading(true);
        setError("");

        if (
          !isConnected ||
          !address
        ) {
          if (active) {
            setBill(null);

            setError(
              "Connect the wallet that created this bill."
            );

            setLoading(false);
          }

          return;
        }

        if (!billId) {
          if (active) {
            setBill(null);

            setError(
              "Bill ID is missing."
            );

            setLoading(false);
          }

          return;
        }

        try {
          const result =
            await getMobileBill(
              address,
              billId
            );

          if (!active) {
            return;
          }

          if (!result) {
            setBill(null);

            setError(
              "Bill not found on this device."
            );

            return;
          }

          setBill(result);
        } catch (loadError) {
          if (!active) {
            return;
          }

          const message =
            loadError instanceof Error
              ? loadError.message
              : String(loadError);

          setBill(null);

          setError(
            `Failed to load bill: ${message}`
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadBill();

      return () => {
        active = false;
      };
    }, [
      address,
      billId,
      isConnected,
    ])
  );

  const openTransaction =
    async () => {
      if (!bill?.txHash) {
        return;
      }

      const url =
        `${ARC_TESTNET.explorerUrl}/tx/${bill.txHash}`;

      await Linking.openURL(
        url
      );
    };

  const openPaymentLink = (
    linkId: string
  ) => {
    router.push(
      `/pay/${linkId}` as never
    );
  };

  if (loading) {
    return (
      <View
        style={
          styles.centerScreen
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading bill...
        </Text>
      </View>
    );
  }

  if (!bill) {
    return (
      <View
        style={
          styles.centerScreen
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Bill unavailable
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          {error}
        </Text>

        <TouchableOpacity
          style={
            styles.primaryButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const paidCount =
    bill.members.filter(
      member =>
        member.status ===
        "paid"
    ).length;

  const unpaidCount =
    bill.members.length -
    paidCount;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
    >
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

      <View
        style={
          styles.header
        }
      >
        <Text
          style={
            styles.eyebrow
          }
        >
          FLOWUSD BILL
        </Text>

        <Text
          style={
            styles.title
          }
        >
          {bill.title}
        </Text>

        <Text
          style={
            styles.createdAt
          }
        >
          {formatDate(
            bill.createdAt
          )}
        </Text>
      </View>

      <View
        style={
          styles.totalCard
        }
      >
        <Text
          style={
            styles.totalLabel
          }
        >
          Total
        </Text>

        <Text
          style={
            styles.totalValue
          }
        >
          {rawUsdcToDisplay(
            bill.totalRaw
          )}{" "}
          USDC
        </Text>

        <View
          style={
            styles.statusRow
          }
        >
          <View
            style={
              styles.statusChip
            }
          >
            <Text
              style={
                styles.statusChipText
              }
            >
              {bill.members.length} members
            </Text>
          </View>

          <View
            style={
              styles.statusChip
            }
          >
            <Text
              style={
                styles.statusChipText
              }
            >
              {paidCount} paid
            </Text>
          </View>

          <View
            style={
              styles.statusChip
            }
          >
            <Text
              style={
                styles.statusChipText
              }
            >
              {unpaidCount} unpaid
            </Text>
          </View>
        </View>
      </View>

      <Text
        style={
          styles.sectionTitle
        }
      >
        Members
      </Text>

      <Text
        style={
          styles.sectionHint
        }
      >
        Tap a member to open their Payment Link.
      </Text>

      <View
        style={
          styles.memberList
        }
      >
        {bill.members.map(
          (
            member,
            index
          ) => (
            <TouchableOpacity
              key={
                member.id
              }
              style={
                styles.memberCard
              }
              activeOpacity={0.85}
              onPress={() =>
                openPaymentLink(
                  member.id
                )
              }
            >
              <View
                style={
                  styles.memberTopRow
                }
              >
                <View
                  style={
                    styles.memberInfo
                  }
                >
                  <Text
                    style={
                      styles.memberName
                    }
                  >
                    {index + 1}.{" "}
                    {member.name}
                  </Text>

                  <Text
                    style={
                      styles.memberAmount
                    }
                  >
                    {rawUsdcToDisplay(
                      member.amountRaw
                    )}{" "}
                    USDC
                  </Text>
                </View>

                <View
                  style={
                    styles.memberRight
                  }
                >
                  <View
                    style={[
                      styles.memberStatus,
                      member.status ===
                      "paid"
                        ? styles.memberStatusPaid
                        : styles.memberStatusUnpaid,
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberStatusText,
                        member.status ===
                        "paid"
                          ? styles.memberStatusPaidText
                          : styles.memberStatusUnpaidText,
                      ]}
                    >
                      {member.status ===
                      "paid"
                        ? "PAID"
                        : "UNPAID"}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.chevron
                    }
                  >
                    ›
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.linkIdBox
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Payment Link ID
                </Text>

                <Text
                  numberOfLines={1}
                  style={
                    styles.monoText
                  }
                >
                  {member.id}
                </Text>
              </View>

              <View
                style={
                  styles.openLinkRow
                }
              >
                <Text
                  style={
                    styles.openLinkText
                  }
                >
                  Open Payment Link
                </Text>

                <Text
                  style={
                    styles.openLinkArrow
                  }
                >
                  →
                </Text>
              </View>
            </TouchableOpacity>
          )
        )}
      </View>

      <Text
        style={[
          styles.sectionTitle,
          styles.transactionHeading,
        ]}
      >
        Transaction
      </Text>

      <View
        style={
          styles.transactionCard
        }
      >
        <View
          style={
            styles.detailRow
          }
        >
          <Text
            style={
              styles.detailLabel
            }
          >
            Network
          </Text>

          <Text
            style={
              styles.detailValue
            }
          >
            {bill.network.name}
          </Text>
        </View>

        <View
          style={
            styles.detailRow
          }
        >
          <Text
            style={
              styles.detailLabel
            }
          >
            Chain ID
          </Text>

          <Text
            style={
              styles.detailValue
            }
          >
            {bill.network.chainId}
          </Text>
        </View>

        <View
          style={
            styles.detailBlock
          }
        >
          <Text
            style={
              styles.detailLabel
            }
          >
            Transaction Hash
          </Text>

          <Text
            selectable
            style={
              styles.monoText
            }
          >
            {bill.txHash}
          </Text>
        </View>

        <View
          style={
            styles.detailBlock
          }
        >
          <Text
            style={
              styles.detailLabel
            }
          >
            Batch Contract
          </Text>

          <Text
            selectable
            style={
              styles.monoText
            }
          >
            {bill.contractAddress}
          </Text>
        </View>

        <TouchableOpacity
          style={
            styles.primaryButton
          }
          onPress={() =>
            void openTransaction()
          }
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            View Transaction
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={
          styles.billIdBox
        }
      >
        <Text
          style={
            styles.detailLabel
          }
        >
          FlowUSD Bill ID
        </Text>

        <Text
          selectable
          style={
            styles.billIdText
          }
        >
          {bill.id}
        </Text>
      </View>

      <Text
        style={
          styles.footer
        }
      >
        Create. Share. Pay. Track.
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

    centerScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 28,
      backgroundColor:
        "#f5f7fb",
    },

    loadingText: {
      marginTop: 14,
      fontSize: 14,
      fontWeight: "600",
      color: "#667085",
    },

    errorTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: "#161b22",
      textAlign: "center",
    },

    errorText: {
      marginTop: 8,
      marginBottom: 20,
      fontSize: 14,
      lineHeight: 20,
      color: "#667085",
      textAlign: "center",
    },

    backButton: {
      alignSelf: "flex-start",
      marginBottom: 18,
    },

    backButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#1769ff",
    },

    header: {
      marginBottom: 20,
    },

    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      color: "#1769ff",
    },

    title: {
      marginTop: 6,
      fontSize: 30,
      fontWeight: "800",
      color: "#161b22",
    },

    createdAt: {
      marginTop: 7,
      fontSize: 13,
      color: "#667085",
    },

    totalCard: {
      padding: 20,
      borderRadius: 18,
      backgroundColor:
        "#1769ff",
      marginBottom: 26,
    },

    totalLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: "#dce8ff",
    },

    totalValue: {
      marginTop: 5,
      fontSize: 30,
      fontWeight: "800",
      color: "#ffffff",
    },

    statusRow: {
      marginTop: 15,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor:
        "rgba(255,255,255,0.16)",
    },

    statusChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#ffffff",
    },

    sectionTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: "#161b22",
      marginBottom: 6,
    },

    sectionHint: {
      marginBottom: 12,
      fontSize: 12,
      color: "#667085",
    },

    memberList: {
      gap: 12,
    },

    memberCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#e3e7ef",
      backgroundColor:
        "#ffffff",
    },

    memberTopRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "flex-start",
      gap: 12,
    },

    memberInfo: {
      flex: 1,
    },

    memberRight: {
      alignItems: "flex-end",
      gap: 8,
    },

    memberName: {
      fontSize: 16,
      fontWeight: "800",
      color: "#161b22",
    },

    memberAmount: {
      marginTop: 4,
      fontSize: 15,
      fontWeight: "700",
      color: "#1769ff",
    },

    memberStatus: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
    },

    memberStatusPaid: {
      backgroundColor:
        "#ecfdf3",
    },

    memberStatusUnpaid: {
      backgroundColor:
        "#fff7ed",
    },

    memberStatusText: {
      fontSize: 10,
      fontWeight: "800",
    },

    memberStatusPaidText: {
      color: "#027a48",
    },

    memberStatusUnpaidText: {
      color: "#c2410c",
    },

    chevron: {
      fontSize: 24,
      color: "#98a2b3",
    },

    linkIdBox: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor:
        "#eef1f5",
    },

    openLinkRow: {
      marginTop: 12,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    openLinkText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#1769ff",
    },

    openLinkArrow: {
      fontSize: 17,
      fontWeight: "800",
      color: "#1769ff",
    },

    detailLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: "#667085",
    },

    detailValue: {
      fontSize: 13,
      fontWeight: "700",
      color: "#344054",
    },

    monoText: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      color: "#344054",
      fontFamily: "monospace",
    },

    detailRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      gap: 14,
      marginBottom: 14,
    },

    detailBlock: {
      marginBottom: 16,
    },

    transactionHeading: {
      marginTop: 26,
    },

    transactionCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#e3e7ef",
      backgroundColor:
        "#ffffff",
    },

    primaryButton: {
      marginTop: 6,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 13,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor:
        "#1769ff",
    },

    primaryButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#ffffff",
    },

    billIdBox: {
      marginTop: 16,
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        "#eef4ff",
    },

    billIdText: {
      marginTop: 5,
      fontSize: 12,
      fontWeight: "600",
      color: "#344054",
    },

    footer: {
      marginTop: 24,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
      color: "#98a2b3",
    },
  });