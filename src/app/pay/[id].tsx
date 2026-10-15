import {
  useCallback,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import QRCode from "react-native-qrcode-svg";

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";

import {
  useAccount,
  useAppKit,
  useProvider,
} from "@reown/appkit-react-native";

import { ARC_TESTNET } from "@/constants/arc";

import {
  getPaymentLinkUrl,
  isValidPaymentLinkId,
} from "@/services/paymentLinks";

import {
  paymentLinkAmountToDisplay,
  paymentTimestampToDisplay,
  readPaymentLink,
  type OnChainPaymentLink,
} from "@/services/onChainPaymentLink";

import {
  executePayment,
} from "@/services/paymentExecution";

import type {
  Eip1193LikeProvider,
} from "@/services/batchPaymentLinks";

function normalizeChainId(
  value:
    | string
    | undefined
): number | undefined {
  if (!value) {
    return undefined;
  }

  if (
    value.startsWith(
      "eip155:"
    )
  ) {
    const parsed =
      Number(
        value.replace(
          "eip155:",
          ""
        )
      );

    return Number.isFinite(
      parsed
    )
      ? parsed
      : undefined;
  }

  if (
    value.startsWith("0x")
  ) {
    const parsed =
      parseInt(
        value,
        16
      );

    return Number.isFinite(
      parsed
    )
      ? parsed
      : undefined;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : undefined;
}

function shortAddress(
  value: string
): string {
  if (
    value.length <= 18
  ) {
    return value;
  }

  return (
    value.slice(0, 10) +
    "..." +
    value.slice(-6)
  );
}

function isZeroAddress(
  value: string
): boolean {
  return (
    value.toLowerCase() ===
    "0x0000000000000000000000000000000000000000"
  );
}

export default function PaymentLinkScreen() {
  const params =
    useLocalSearchParams<{
      id?:
        | string
        | string[];
    }>();

  const linkId =
    Array.isArray(
      params.id
    )
      ? params.id[0]
      : params.id;

  const {
    address,
    isConnected,
    chainId,
  } = useAccount();

  const { provider } =
    useProvider();

  const { open } =
    useAppKit();

  const currentChainId =
    normalizeChainId(
      chainId
    );

  const [
    link,
    setLink,
  ] =
    useState<OnChainPaymentLink | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    paymentBusy,
    setPaymentBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    paymentStatus,
    setPaymentStatus,
  ] =
    useState("");

  const loadLink =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        if (
          !linkId ||
          !isValidPaymentLinkId(
            linkId
          )
        ) {
          setLink(null);

          setError(
            "This FlowUSD Payment Link ID is invalid."
          );

          setLoading(false);

          return;
        }

        try {
          const result =
            await readPaymentLink(
              linkId
            );

          if (
            isZeroAddress(
              result.creator
            )
          ) {
            setLink(null);

            setError(
              "Payment Link was not found on Arc Testnet."
            );

            return;
          }

          setLink(result);
        } catch (
          loadError
        ) {
          const message =
            loadError instanceof
            Error
              ? loadError.message
              : String(
                  loadError
                );

          setLink(null);

          setError(
            message
          );
        } finally {
          setLoading(false);
        }
      },
      [linkId]
    );

  useFocusEffect(
    useCallback(() => {
      void loadLink();

      return () => {};
    }, [loadLink])
  );

  const handleShare =
    async () => {
      if (!linkId) {
        return;
      }

      const url =
        getPaymentLinkUrl(
          linkId
        );

      await Share.share({
        title:
          "FlowUSD Payment Link",

        message:
          `FlowUSD Payment Link\n${url}`,
      });
    };

  const handlePay =
    async () => {
      if (
        !link ||
        !linkId
      ) {
        return;
      }

      if (link.paid) {
        Alert.alert(
          "Already paid",
          "This Payment Link has already been paid."
        );

        return;
      }

      if (
        !isConnected ||
        !address
      ) {
        await open();

        return;
      }

      if (!provider) {
        Alert.alert(
          "Wallet unavailable",
          "Reconnect your wallet and try again."
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

      try {
        setPaymentBusy(
          true
        );

        setPaymentStatus(
          "Preparing payment..."
        );

        const result =
          await executePayment(
            provider as Eip1193LikeProvider,
            address,
            linkId,
            link.amountRaw,
            currentChainId,
            status =>
              setPaymentStatus(
                status
              )
          );

        setPaymentStatus(
          "Payment confirmed. Refreshing on-chain status..."
        );

        await loadLink();

        setPaymentStatus(
          "Payment completed successfully."
        );

        Alert.alert(
          "Payment successful",
          `USDC payment confirmed on Arc Testnet.\n\nTx: ${result.paymentTxHash}`
        );
      } catch (
        paymentError
      ) {
        const message =
          paymentError instanceof
          Error
            ? paymentError.message
            : String(
                paymentError
              );

        setPaymentStatus(
          message
        );

        Alert.alert(
          "Payment failed",
          message
        );
      } finally {
        setPaymentBusy(
          false
        );
      }
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
          Reading Payment Link from Arc...
        </Text>
      </View>
    );
  }

  if (!link) {
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
          Payment Link unavailable
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

  const paidAt =
    paymentTimestampToDisplay(
      link.paidAt
    );

  const paymentUrl =
    getPaymentLinkUrl(
      link.id
    );

  return (
    <ScrollView
      style={
        styles.screen
      }
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
          FLOWUSD PAYMENT
        </Text>

        <Text
          style={
            styles.title
          }
        >
          Payment Link
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Live on-chain data from Arc Testnet.
        </Text>
      </View>

      <View
        style={
          styles.amountCard
        }
      >
        <View
          style={
            styles.amountTopRow
          }
        >
          <Text
            style={
              styles.amountLabel
            }
          >
            Amount
          </Text>

          <View
            style={[
              styles.statusBadge,
              link.paid
                ? styles.statusPaid
                : styles.statusUnpaid,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                link.paid
                  ? styles.statusPaidText
                  : styles.statusUnpaidText,
              ]}
            >
              {link.paid
                ? "PAID"
                : "UNPAID"}
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.amountValue
          }
        >
          {paymentLinkAmountToDisplay(
            link.amountRaw
          )}{" "}
          USDC
        </Text>

        <Text
          style={
            styles.networkText
          }
        >
          {ARC_TESTNET.name}
        </Text>
      </View>

      {!link.paid ? (
        <TouchableOpacity
          style={[
            styles.payButton,
            paymentBusy &&
              styles.disabledButton,
          ]}
          disabled={
            paymentBusy
          }
          activeOpacity={
            0.85
          }
          onPress={() =>
            void handlePay()
          }
        >
          <Text
            style={
              styles.payButtonText
            }
          >
            {paymentBusy
              ? "Processing..."
              : isConnected
                ? `Pay ${paymentLinkAmountToDisplay(
                    link.amountRaw
                  )} USDC`
                : "Connect Wallet to Pay"}
          </Text>
        </TouchableOpacity>
      ) : (
        <View
          style={
            styles.paidCard
          }
        >
          <Text
            style={
              styles.paidCardTitle
            }
          >
            ✓ Payment completed
          </Text>

          <Text
            style={
              styles.paidCardText
            }
          >
            This Payment Link has been settled on Arc.
          </Text>
        </View>
      )}

      {paymentStatus ? (
        <View
          style={
            styles.statusMessage
          }
        >
          <Text
            style={
              styles.statusMessageText
            }
          >
            {paymentStatus}
          </Text>
        </View>
      ) : null}

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Payment Details
        </Text>

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
            Creator
          </Text>

          <Text
            selectable
            style={
              styles.detailValue
            }
          >
            {shortAddress(
              link.creator
            )}
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
            Payment Link ID
          </Text>

          <Text
            selectable
            style={
              styles.monoText
            }
          >
            {link.id}
          </Text>
        </View>

        {link.paid ? (
          <>
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
                Payer
              </Text>

              <Text
                selectable
                style={
                  styles.detailValue
                }
              >
                {isZeroAddress(
                  link.payer
                )
                  ? "-"
                  : shortAddress(
                      link.payer
                    )}
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
                Paid at
              </Text>

              <Text
                style={
                  styles.detailValue
                }
              >
                {paidAt ??
                  "-"}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      <View
        style={
          styles.qrCard
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Share Payment
        </Text>

        <Text
          style={
            styles.qrHint
          }
        >
          Scan or share this FlowUSD Payment Link.
        </Text>

        <View
          style={
            styles.qrWrapper
          }
        >
          <QRCode
            value={
              paymentUrl
            }
            size={190}
          />
        </View>

        <Text
          selectable
          style={
            styles.shareUrl
          }
        >
          {paymentUrl}
        </Text>

        <TouchableOpacity
          style={
            styles.shareButton
          }
          onPress={() =>
            void handleShare()
          }
          activeOpacity={
            0.85
          }
        >
          <Text
            style={
              styles.shareButtonText
            }
          >
            Share Payment Link
          </Text>
        </TouchableOpacity>
      </View>

      <View
        style={
          styles.contractCard
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Contract
        </Text>

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
            {ARC_TESTNET.id}
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
            {
              ARC_TESTNET.contracts
                .batchSplitBill
            }
          </Text>
        </View>
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
      color: "#667085",
    },

    amountCard: {
      padding: 20,
      borderRadius: 18,
      backgroundColor:
        "#1769ff",
      marginBottom: 14,
    },

    amountTopRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    amountLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: "#dce8ff",
    },

    amountValue: {
      marginTop: 8,
      fontSize: 32,
      fontWeight: "800",
      color: "#ffffff",
    },

    networkText: {
      marginTop: 6,
      fontSize: 12,
      color: "#dce8ff",
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },

    statusPaid: {
      backgroundColor:
        "#ecfdf3",
    },

    statusUnpaid: {
      backgroundColor:
        "#fff7ed",
    },

    statusText: {
      fontSize: 10,
      fontWeight: "800",
    },

    statusPaidText: {
      color: "#027a48",
    },

    statusUnpaidText: {
      color: "#c2410c",
    },

    payButton: {
      paddingVertical: 15,
      alignItems: "center",
      borderRadius: 13,
      backgroundColor:
        "#1769ff",
      marginBottom: 14,
    },

    payButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#ffffff",
    },

    disabledButton: {
      opacity: 0.55,
    },

    statusMessage: {
      padding: 13,
      borderRadius: 12,
      backgroundColor:
        "#eef4ff",
      marginBottom: 14,
    },

    statusMessageText: {
      fontSize: 12,
      lineHeight: 18,
      color: "#344054",
    },

    paidCard: {
      padding: 16,
      borderRadius: 14,
      backgroundColor:
        "#ecfdf3",
      marginBottom: 14,
    },

    paidCardTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: "#027a48",
    },

    paidCardText: {
      marginTop: 5,
      fontSize: 12,
      color: "#475467",
    },

    card: {
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e3e7ef",
      marginBottom: 16,
    },

    qrCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e3e7ef",
      marginBottom: 16,
    },

    qrHint: {
      marginTop: -6,
      marginBottom: 18,
      fontSize: 12,
      color: "#667085",
    },

    qrWrapper: {
      alignSelf: "center",
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        "#ffffff",
    },

    shareUrl: {
      marginTop: 16,
      fontSize: 10,
      lineHeight: 15,
      color: "#667085",
      fontFamily: "monospace",
    },

    shareButton: {
      marginTop: 14,
      paddingVertical: 13,
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#1769ff",
    },

    shareButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#1769ff",
    },

    contractCard: {
      padding: 16,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor: "#e3e7ef",
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: "#161b22",
      marginBottom: 14,
    },

    detailRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 14,
      gap: 12,
    },

    detailBlock: {
      marginBottom: 14,
    },

    detailLabel: {
      fontSize: 12,
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

    primaryButton: {
      paddingVertical: 13,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor:
        "#1769ff",
    },

    primaryButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#ffffff",
    },

    footer: {
      marginTop: 24,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
      color: "#98a2b3",
    },
  });