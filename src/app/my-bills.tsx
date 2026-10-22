import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  saveMobileBill,
  type MobileBill,
} from "@/services/mobileBills";

import {
  readPaymentLink,
} from "@/services/onChainPaymentLink";

type BillFilter =
  | "all"
  | "paid"
  | "partial"
  | "unpaid";

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

function billStatus(
  bill: MobileBill
): BillFilter {
  const paid =
    bill.members.filter(
      member =>
        member.status ===
        "paid"
    ).length;

  if (
    bill.members.length > 0 &&
    paid === bill.members.length
  ) {
    return "paid";
  }

  if (paid > 0) {
    return "partial";
  }

  return "unpaid";
}

function rawToNumber(
  raw: string
): number {
  const parsed =
    Number(raw);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed / 1_000_000;
}

function parseFilterDate(
  value: string,
  endOfDay = false
): Date | null {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      trimmed
    );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
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

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<BillFilter>(
      "all"
    );

  const [fromDate, setFromDate] =
    useState("");

  const [toDate, setToDate] =
    useState("");

  const refreshBills =
    useCallback(
      async (
        fullLoader = false
      ) => {
        if (
          !isConnected ||
          !address
        ) {
          setBills([]);

          setError(
            "Connect the wallet that created your bills."
          );

          setLoading(false);

          return;
        }

        if (fullLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        try {
          const localBills =
            await loadMobileBills(
              address
            );

          const refreshed =
            await Promise.all(
              localBills.map(
                async bill => {
                  const members =
                    await Promise.all(
                      bill.members.map(
                        async member => {
                          try {
                            const chain =
                              await readPaymentLink(
                                member.id
                              );

                            if (
                              chain.paid
                            ) {
                              return {
                                ...member,
                                status:
                                  "paid" as const,
                                payer:
                                  chain.payer,
                              };
                            }

                            return {
                              ...member,
                              status:
                                "unpaid" as const,
                              payer:
                                undefined,
                            };
                          } catch {
                            return member;
                          }
                        }
                      )
                    );

                  const updated: MobileBill =
                    {
                      ...bill,
                      members,
                    };

                  try {
                    await saveMobileBill(
                      address,
                      updated
                    );
                  } catch {
                    // UI can still use refreshed data.
                  }

                  return updated;
                }
              )
            );

          setBills(
            refreshed.sort(
              (a, b) =>
                new Date(
                  b.createdAt
                ).getTime() -
                new Date(
                  a.createdAt
                ).getTime()
            )
          );
        } catch (
          loadError
        ) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : String(
                  loadError
                );

          setError(
            `Failed to load bills: ${message}`
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        address,
        isConnected,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      void refreshBills(
        true
      );

      return undefined;
    }, [refreshBills])
  );

  const filteredBills =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      const from =
        parseFilterDate(
          fromDate
        );

      const to =
        parseFilterDate(
          toDate,
          true
        );

      return bills.filter(
        bill => {
          if (
            filter !==
              "all" &&
            billStatus(
              bill
            ) !== filter
          ) {
            return false;
          }

          const created =
            new Date(
              bill.createdAt
            );

          if (
            from &&
            created < from
          ) {
            return false;
          }

          if (
            to &&
            created > to
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          const memberNames =
            bill.members
              .map(
                member =>
                  member.name
              )
              .join(" ");

          const searchable =
            [
              bill.title,
              bill.id,
              bill.txHash,
              memberNames,
            ]
              .join(" ")
              .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }, [
      bills,
      filter,
      fromDate,
      search,
      toDate,
    ]);

  const summary =
    useMemo(() => {
      let received = 0;
      let outstanding = 0;
      let paidMembers = 0;
      let totalMembers = 0;

      for (
        const bill of bills
      ) {
        for (
          const member of
          bill.members
        ) {
          const amount =
            rawToNumber(
              member.amountRaw
            );

          totalMembers += 1;

          if (
            member.status ===
            "paid"
          ) {
            received +=
              amount;

            paidMembers += 1;
          } else {
            outstanding +=
              amount;
          }
        }
      }

      return {
        bills:
          bills.length,
        received,
        outstanding,
        paidMembers,
        totalMembers,
      };
    }, [bills]);

  const openBill = (
    billId: string
  ) => {
    router.push(
      `/bills/${billId}` as never
    );
  };

  const openScanner = () => {
    router.push(
      "/scan-qr" as never
    );
  };

  const resetFilters = () => {
    setSearch("");
    setFilter("all");
    setFromDate("");
    setToDate("");
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
          Syncing bill history...
        </Text>
      </View>
    );
  }

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
      keyboardShouldPersistTaps="handled"
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
          Bill History & Tracking
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Search, filter and track your Arc USDC bills.
        </Text>
      </View>

      <TouchableOpacity
        style={
          styles.scanButton
        }
        onPress={
          openScanner
        }
      >
        <Text
          style={
            styles.scanIcon
          }
        >
          ▣
        </Text>

        <View
          style={
            styles.scanTextBox
          }
        >
          <Text
            style={
              styles.scanTitle
            }
          >
            Scan FlowUSD QR
          </Text>

          <Text
            style={
              styles.scanSubtitle
            }
          >
            Scan a FlowUSD payment link and open Pay USDC.
          </Text>
        </View>

        <Text
          style={
            styles.scanArrow
          }
        >
          →
        </Text>
      </TouchableOpacity>

      <View
        style={
          styles.summaryGrid
        }
      >
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
            Bills
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {summary.bills}
          </Text>
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
            Received
          </Text>

          <Text
            style={
              styles.summaryValueSmall
            }
          >
            {summary.received.toFixed(
              2
            )}{" "}
            USDC
          </Text>
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
            Outstanding
          </Text>

          <Text
            style={
              styles.summaryValueSmall
            }
          >
            {summary.outstanding.toFixed(
              2
            )}{" "}
            USDC
          </Text>
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
            Members paid
          </Text>

          <Text
            style={
              styles.summaryValue
            }
          >
            {summary.paidMembers}/
            {summary.totalMembers}
          </Text>
        </View>
      </View>

      <View
        style={
          styles.filterCard
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Search & Filter
        </Text>

        <TextInput
          value={search}
          onChangeText={
            setSearch
          }
          placeholder="Search bill, member or ID..."
          placeholderTextColor="#98a2b3"
          style={
            styles.input
          }
          autoCapitalize="none"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filterRow
          }
        >
          {(
            [
              "all",
              "paid",
              "partial",
              "unpaid",
            ] as BillFilter[]
          ).map(item => (
            <TouchableOpacity
              key={item}
              style={[
                styles.filterChip,

                filter ===
                  item &&
                  styles.filterChipActive,
              ]}
              onPress={() =>
                setFilter(
                  item
                )
              }
            >
              <Text
                style={[
                  styles.filterChipText,

                  filter ===
                    item &&
                    styles.filterChipTextActive,
                ]}
              >
                {item ===
                "all"
                  ? "All"
                  : item
                      .charAt(0)
                      .toUpperCase() +
                    item.slice(
                      1
                    )}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View
          style={
            styles.dateRow
          }
        >
          <View
            style={
              styles.dateField
            }
          >
            <Text
              style={
                styles.dateLabel
              }
            >
              From
            </Text>

            <TextInput
              value={
                fromDate
              }
              onChangeText={
                setFromDate
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#98a2b3"
              style={
                styles.input
              }
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View
            style={
              styles.dateField
            }
          >
            <Text
              style={
                styles.dateLabel
              }
            >
              To
            </Text>

            <TextInput
              value={
                toDate
              }
              onChangeText={
                setToDate
              }
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#98a2b3"
              style={
                styles.input
              }
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <View
          style={
            styles.actionRow
          }
        >
          <TouchableOpacity
            style={
              styles.resetButton
            }
            onPress={
              resetFilters
            }
          >
            <Text
              style={
                styles.resetButtonText
              }
            >
              Reset
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.refreshButton
            }
            disabled={
              refreshing
            }
            onPress={() =>
              void refreshBills(
                false
              )
            }
          >
            <Text
              style={
                styles.refreshButtonText
              }
            >
              {refreshing
                ? "Syncing..."
                : "Refresh On-chain"}
            </Text>
          </TouchableOpacity>
        </View>
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

      <View
        style={
          styles.resultsHeader
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          Bills
        </Text>

        <Text
          style={
            styles.resultCount
          }
        >
          {filteredBills.length} result
          {filteredBills.length ===
          1
            ? ""
            : "s"}
        </Text>
      </View>

      {!error &&
      filteredBills.length ===
        0 ? (
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
            No matching bills
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Create a bill or change your search and filters.
          </Text>
        </View>
      ) : null}

      <View
        style={
          styles.billList
        }
      >
        {filteredBills.map(
          bill => {
            const paidCount =
              bill.members.filter(
                member =>
                  member.status ===
                  "paid"
              ).length;

            const status =
              billStatus(
                bill
              );

            return (
              <TouchableOpacity
                key={
                  bill.id
                }
                style={
                  styles.billCard
                }
                activeOpacity={
                  0.85
                }
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

                  <View
                    style={[
                      styles.statusBadge,

                      status ===
                        "paid"
                        ? styles.statusPaid
                        : status ===
                            "partial"
                          ? styles.statusPartial
                          : styles.statusUnpaid,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,

                        status ===
                          "paid"
                          ? styles.statusPaidText
                          : status ===
                              "partial"
                            ? styles.statusPartialText
                            : styles.statusUnpaidText,
                      ]}
                    >
                      {status.toUpperCase()}
                    </Text>
                  </View>
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

                <View
                  style={
                    styles.openRow
                  }
                >
                  <Text
                    style={
                      styles.openText
                    }
                  >
                    Open Bill
                  </Text>

                  <Text
                    style={
                      styles.chevron
                    }
                  >
                    →
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }
        )}
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
        "#f7f9ff",
    },

    content: {
      padding: 20,
      paddingTop: 48,
      paddingBottom: 40,
    },

    centerScreen: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 28,
      backgroundColor:
        "#f7f9ff",
    },

    loadingText: {
      marginTop: 14,
      fontSize: 14,
      fontWeight: "600",
      color: "#667085",
    },

    backButton: {
      alignSelf:
        "flex-start",
      marginBottom: 18,
    },

    backButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#2F6BFF",
    },

    header: {
      marginBottom: 18,
    },

    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      color: "#2F6BFF",
    },

    title: {
      marginTop: 6,
      fontSize: 29,
      lineHeight: 34,
      fontWeight: "800",
      color: "#101828",
    },

    subtitle: {
      marginTop: 7,
      fontSize: 14,
      lineHeight: 20,
      color: "#667085",
    },

    scanButton: {
      flexDirection:
        "row",
      alignItems:
        "center",
      padding: 16,
      borderRadius: 18,
      backgroundColor:
        "#2F6BFF",
      marginBottom: 16,
      gap: 12,
    },

    scanIcon: {
      fontSize: 27,
      color: "#ffffff",
      fontWeight: "800",
    },

    scanTextBox: {
      flex: 1,
    },

    scanTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: "#ffffff",
    },

    scanSubtitle: {
      marginTop: 3,
      fontSize: 11,
      lineHeight: 16,
      color: "#DFE8FF",
    },

    scanArrow: {
      fontSize: 23,
      fontWeight: "800",
      color: "#ffffff",
    },

    summaryGrid: {
      flexDirection:
        "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 16,
    },

    summaryCard: {
      width: "48%",
      minHeight: 88,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        "#DCE5F5",
      backgroundColor:
        "#ffffff",
    },

    summaryLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: "#667085",
    },

    summaryValue: {
      marginTop: 8,
      fontSize: 24,
      fontWeight: "800",
      color: "#101828",
    },

    summaryValueSmall: {
      marginTop: 9,
      fontSize: 17,
      fontWeight: "800",
      color: "#2F6BFF",
    },

    filterCard: {
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        "#DCE5F5",
      backgroundColor:
        "#ffffff",
      marginBottom: 18,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: "#101828",
    },

    input: {
      marginTop: 10,
      height: 46,
      paddingHorizontal: 13,
      borderWidth: 1,
      borderColor:
        "#D0D5DD",
      borderRadius: 12,
      backgroundColor:
        "#ffffff",
      fontSize: 13,
      color: "#101828",
    },

    filterRow: {
      gap: 8,
      paddingVertical: 12,
    },

    filterChip: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor:
        "#F2F4F7",
    },

    filterChipActive: {
      backgroundColor:
        "#EAF1FF",
    },

    filterChipText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#667085",
    },

    filterChipTextActive: {
      color: "#2F6BFF",
    },

    dateRow: {
      flexDirection:
        "row",
      gap: 10,
    },

    dateField: {
      flex: 1,
    },

    dateLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: "#667085",
    },

    actionRow: {
      marginTop: 12,
      flexDirection:
        "row",
      gap: 10,
    },

    resetButton: {
      flex: 1,
      height: 43,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        "#D0D5DD",
    },

    resetButtonText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#475467",
    },

    refreshButton: {
      flex: 2,
      height: 43,
      alignItems:
        "center",
      justifyContent:
        "center",
      borderRadius: 11,
      backgroundColor:
        "#2F6BFF",
    },

    refreshButtonText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#ffffff",
    },

    errorCard: {
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        "#FFF1F0",
      marginBottom: 14,
    },

    errorText: {
      fontSize: 12,
      lineHeight: 18,
      color: "#B42318",
    },

    resultsHeader: {
      marginTop: 2,
      marginBottom: 10,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    resultCount: {
      fontSize: 12,
      fontWeight: "700",
      color: "#667085",
    },

    emptyCard: {
      padding: 20,
      borderRadius: 16,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor:
        "#E3E7EF",
    },

    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: "#161B22",
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
      borderRadius: 17,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor:
        "#DCE5F5",
    },

    billTopRow: {
      flexDirection:
        "row",
      alignItems:
        "flex-start",
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
      color: "#101828",
    },

    billDate: {
      marginTop: 4,
      fontSize: 11,
      color: "#667085",
    },

    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
    },

    statusPaid: {
      backgroundColor:
        "#ECFDF3",
    },

    statusPartial: {
      backgroundColor:
        "#EEF4FF",
    },

    statusUnpaid: {
      backgroundColor:
        "#FFF7ED",
    },

    statusText: {
      fontSize: 9,
      fontWeight: "800",
    },

    statusPaidText: {
      color: "#027A48",
    },

    statusPartialText: {
      color: "#2F6BFF",
    },

    statusUnpaidText: {
      color: "#C2410C",
    },

    amount: {
      marginTop: 14,
      fontSize: 22,
      fontWeight: "800",
      color: "#2F6BFF",
    },

    metaRow: {
      marginTop: 10,
      flexDirection:
        "row",
      flexWrap: "wrap",
      gap: 10,
    },

    metaText: {
      fontSize: 12,
      fontWeight: "600",
      color: "#667085",
    },

    openRow: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor:
        "#EEF2F7",
      flexDirection:
        "row",
      justifyContent:
        "space-between",
    },

    openText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#2F6BFF",
    },

    chevron: {
      fontSize: 17,
      fontWeight: "800",
      color: "#2F6BFF",
    },

    footer: {
      marginTop: 24,
      textAlign:
        "center",
      fontSize: 12,
      fontWeight: "700",
      color: "#98A2B3",
    },
  });