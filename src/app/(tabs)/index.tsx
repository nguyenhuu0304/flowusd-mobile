import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";

import {
  useAccount,
  useAppKit,
} from "@reown/appkit-react-native";

function shortAddress(
  value: string
): string {
  if (value.length <= 18) {
    return value;
  }

  return (
    value.slice(0, 10) +
    "..." +
    value.slice(-6)
  );
}

export default function HomeScreen() {
  const { open } =
    useAppKit();

  const {
    address,
    isConnected,
  } = useAccount();

  const openSplitBill = () => {
    router.push(
      "/split-bill" as never
    );
  };

  const openMyBills = () => {
    router.push(
      "/my-bills" as never
    );
  };

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
      <View
        style={
          styles.hero
        }
      >
        <Text
          style={
            styles.brand
          }
        >
          FlowUSD
        </Text>

        <Text
          style={
            styles.tagline
          }
        >
          Programmable USDC Payments on Arc
        </Text>

        <View
          style={
            styles.networkBadge
          }
        >
          <View
            style={
              styles.networkDot
            }
          />

          <Text
            style={
              styles.networkText
            }
          >
            Arc Testnet
          </Text>
        </View>
      </View>

      <View
        style={
          styles.walletCard
        }
      >
        <View
          style={
            styles.walletTopRow
          }
        >
          <View>
            <Text
              style={
                styles.walletLabel
              }
            >
              Wallet
            </Text>

            <Text
              style={
                styles.walletStatus
              }
            >
              {isConnected
                ? "Connected"
                : "Not connected"}
            </Text>
          </View>

          <View
            style={[
              styles.statusDot,
              isConnected
                ? styles.statusDotConnected
                : styles.statusDotDisconnected,
            ]}
          />
        </View>

        {isConnected &&
        address ? (
          <>
            <Text
              selectable
              style={
                styles.walletAddress
              }
            >
              {shortAddress(
                address
              )}
            </Text>

            <Text
              selectable
              style={
                styles.walletAddressFull
              }
            >
              {address}
            </Text>
          </>
        ) : (
          <Text
            style={
              styles.walletHint
            }
          >
            Connect your wallet to create and manage USDC payments.
          </Text>
        )}

        <TouchableOpacity
          style={
            styles.walletButton
          }
          activeOpacity={0.85}
          onPress={() =>
            open()
          }
        >
          <Text
            style={
              styles.walletButtonText
            }
          >
            {isConnected
              ? "Manage Wallet"
              : "Connect Wallet"}
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={
          styles.sectionTitle
        }
      >
        Payment Workspace
      </Text>

      <View
        style={
          styles.actionList
        }
      >
        <View
          style={
            styles.actionCardMuted
          }
        >
          <View
            style={
              styles.actionIcon
            }
          >
            <Text
              style={
                styles.actionIconText
              }
            >
              +
            </Text>
          </View>

          <View
            style={
              styles.actionContent
            }
          >
            <Text
              style={
                styles.actionTitle
              }
            >
              Create Bill
            </Text>

            <Text
              style={
                styles.actionDescription
              }
            >
              Single payment workflow coming in a later milestone.
            </Text>
          </View>

          <Text
            style={
              styles.comingSoon
            }
          >
            Soon
          </Text>
        </View>

        <TouchableOpacity
          style={
            styles.actionCard
          }
          activeOpacity={0.85}
          onPress={
            openSplitBill
          }
        >
          <View
            style={
              styles.actionIcon
            }
          >
            <Text
              style={
                styles.actionIconText
              }
            >
              ⇄
            </Text>
          </View>

          <View
            style={
              styles.actionContent
            }
          >
            <Text
              style={
                styles.actionTitle
              }
            >
              Split Bill
            </Text>

            <Text
              style={
                styles.actionDescription
              }
            >
              Create multiple USDC payment links in one Arc transaction.
            </Text>
          </View>

          <Text
            style={
              styles.chevron
            }
          >
            ›
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.actionCard
          }
          activeOpacity={0.85}
          onPress={
            openMyBills
          }
        >
          <View
            style={
              styles.actionIcon
            }
          >
            <Text
              style={
                styles.actionIconText
              }
            >
              ≡
            </Text>
          </View>

          <View
            style={
              styles.actionContent
            }
          >
            <Text
              style={
                styles.actionTitle
              }
            >
              My Bills
            </Text>

            <Text
              style={
                styles.actionDescription
              }
            >
              View bills saved on this device and reopen their payment links.
            </Text>
          </View>

          <Text
            style={
              styles.chevron
            }
          >
            ›
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={
          styles.infoCard
        }
      >
        <Text
          style={
            styles.infoTitle
          }
        >
          FlowUSD
        </Text>

        <Text
          style={
            styles.infoText
          }
        >
          Create bills, share payment links, pay USDC and track settlement on Arc.
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
      paddingTop: 54,
      paddingBottom: 42,
    },

    hero: {
      marginBottom: 24,
    },

    brand: {
      fontSize: 34,
      fontWeight: "900",
      color: "#161b22",
    },

    tagline: {
      marginTop: 7,
      fontSize: 15,
      lineHeight: 21,
      color: "#667085",
    },

    networkBadge: {
      marginTop: 14,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor:
        "#eef4ff",
    },

    networkDot: {
      width: 7,
      height: 7,
      borderRadius: 99,
      backgroundColor:
        "#1769ff",
    },

    networkText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#1769ff",
    },

    walletCard: {
      padding: 18,
      borderRadius: 18,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e3e7ef",
      marginBottom: 28,
    },

    walletTopRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    walletLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: "#667085",
    },

    walletStatus: {
      marginTop: 4,
      fontSize: 17,
      fontWeight: "800",
      color: "#161b22",
    },

    statusDot: {
      width: 11,
      height: 11,
      borderRadius: 99,
    },

    statusDotConnected: {
      backgroundColor:
        "#12b76a",
    },

    statusDotDisconnected: {
      backgroundColor:
        "#98a2b3",
    },

    walletAddress: {
      marginTop: 16,
      fontSize: 16,
      fontWeight: "800",
      color: "#1769ff",
    },

    walletAddressFull: {
      marginTop: 5,
      fontSize: 10,
      lineHeight: 15,
      color: "#98a2b3",
      fontFamily: "monospace",
    },

    walletHint: {
      marginTop: 16,
      fontSize: 13,
      lineHeight: 19,
      color: "#667085",
    },

    walletButton: {
      marginTop: 17,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor:
        "#1769ff",
    },

    walletButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#ffffff",
    },

    sectionTitle: {
      marginBottom: 12,
      fontSize: 19,
      fontWeight: "800",
      color: "#161b22",
    },

    actionList: {
      gap: 12,
    },

    actionCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e3e7ef",
    },

    actionCardMuted: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e3e7ef",
      opacity: 0.68,
    },

    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "#eef4ff",
    },

    actionIconText: {
      fontSize: 20,
      fontWeight: "900",
      color: "#1769ff",
    },

    actionContent: {
      flex: 1,
      marginLeft: 13,
    },

    actionTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: "#161b22",
    },

    actionDescription: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: "#667085",
    },

    chevron: {
      marginLeft: 10,
      fontSize: 28,
      color: "#98a2b3",
    },

    comingSoon: {
      marginLeft: 10,
      fontSize: 11,
      fontWeight: "800",
      color: "#98a2b3",
    },

    infoCard: {
      marginTop: 22,
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#eef4ff",
    },

    infoTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: "#1769ff",
    },

    infoText: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 19,
      color: "#475467",
    },

    footer: {
      marginTop: 24,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
      color: "#98a2b3",
    },
  });