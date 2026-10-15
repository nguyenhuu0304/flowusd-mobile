import {
  useCallback,
  useState,
} from "react";

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  router,
  useFocusEffect,
} from "expo-router";

import {
  useAccount,
} from "@reown/appkit-react-native";

import {
  loadMobileBills,
  rawUsdcToDisplay,
  type MobileBill,
} from "@/services/mobileBills";

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

export default function MyBillsScreen() {
  const {
    address,
    isConnected,
  } = useAccount();

  const [bills, setBills] =
    useState<MobileBill[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadBills() {
        setLoading(true);
        setError("");

        if (
          !isConnected ||
          !address
        ) {
          if (active) {
            setBills([]);

            setError(
              "Connect the wallet that created your bills."
            );

            setLoading(false);
          }

          return;
        }

        try {
          const result =
            await loadMobileBills(
              address
            );

          if (!active) {
            return;
          }

          setBills(result);
        } catch (loadError) {
          if (!active) {
            return;
          }

          const message =
            loadError instanceof Error
              ? loadError.message
              : String(loadError);

          setBills([]);

          setError(
            `Failed to load bills: ${message}`
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadBills();

      return () => {
        active = false;
      };
    }, [
      address,
      isConnected,
    ])
  );

  const openBill = (
    billId: string
  ) => {
    router.push(
      `/bills/${billId}` as never
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
          Loading bills...
        </Text>
      </View>
    );
  }

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
          FLOWUSD
        </Text>

        <Text
          style={
            styles.title
          }
        >
          My Bills
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Bills saved on this device for the connected wallet.
        </Text>
      </View>

      {error ? (
        <View
          style={
            styles.errorCard
          }
        >
          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>
        </View>
      ) : null}

      {!error &&
      bills.length === 0 ? (
        <View
          style={
            styles.emptyCard
          }
        >
          <Text
            style={
              styles.emptyTitle
            }
          >
            No saved bills
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Create a Split Bill and it will appear here.
          </Text>
        </View>
      ) : null}

      <View
        style={
          styles.billList
        }
      >
        {bills.map(bill => {
          const paidCount =
            bill.members.filter(
              member =>
                member.status ===
                "paid"
            ).length;

          return (
            <TouchableOpacity
              key={bill.id}
              style={
                styles.billCard
              }
              activeOpacity={0.85}
              onPress={() =>
                openBill(
                  bill.id
                )
              }
            >
              <View
                style={
                  styles.billTopRow
                }
              >
                <View
                  style={
                    styles.billInfo
                  }
                >
                  <Text
                    style={
                      styles.billTitle
                    }
                  >
                    {bill.title}
                  </Text>

                  <Text
                    style={
                      styles.billDate
                    }
                  >
                    {formatDate(
                      bill.createdAt
                    )}
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

              <Text
                style={
                  styles.amount
                }
              >
                {rawUsdcToDisplay(
                  bill.totalRaw
                )}{" "}
                USDC
              </Text>

              <View
                style={
                  styles.metaRow
                }
              >
                <Text
                  style={
                    styles.metaText
                  }
                >
                  {bill.members.length} members
                </Text>

                <Text
                  style={
                    styles.metaText
                  }
                >
                  {paidCount} paid
                </Text>

                <Text
                  style={
                    styles.metaText
                  }
                >
                  {bill.members.length -
                    paidCount}{" "}
                  unpaid
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
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
      marginBottom: 22,
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

    subtitle: {
      marginTop: 7,
      fontSize: 15,
      lineHeight: 21,
      color: "#667085",
    },

    errorCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#fff1f0",
    },

    errorText: {
      fontSize: 13,
      lineHeight: 19,
      color: "#b42318",
    },

    emptyCard: {
      padding: 20,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e3e7ef",
    },

    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: "#161b22",
    },

    emptyText: {
      marginTop: 7,
      fontSize: 13,
      lineHeight: 19,
      color: "#667085",
    },

    billList: {
      gap: 12,
    },

    billCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e3e7ef",
    },

    billTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 12,
    },

    billInfo: {
      flex: 1,
    },

    billTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: "#161b22",
    },

    billDate: {
      marginTop: 4,
      fontSize: 12,
      color: "#667085",
    },

    chevron: {
      fontSize: 28,
      color: "#98a2b3",
    },

    amount: {
      marginTop: 14,
      fontSize: 22,
      fontWeight: "800",
      color: "#1769ff",
    },

    metaRow: {
      marginTop: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },

    metaText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#667085",
    },

    footer: {
      marginTop: 24,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
      color: "#98a2b3",
    },
  });