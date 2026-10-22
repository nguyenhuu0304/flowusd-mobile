import {
  useState,
} from "react";

import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";

import {
  router,
} from "expo-router";

function extractLinkId(
  raw: string
): string | null {
  const value =
    raw.trim();

  const direct =
    /^0x[a-fA-F0-9]{64}$/;

  if (
    direct.test(
      value
    )
  ) {
    return value;
  }

  try {
    const url =
      new URL(value);

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean);

    const payIndex =
      parts.findIndex(
        item =>
          item === "pay"
      );

    if (
      payIndex >= 0 &&
      parts[
        payIndex + 1
      ] &&
      direct.test(
        parts[
          payIndex + 1
        ]
      )
    ) {
      return parts[
        payIndex + 1
      ];
    }
  } catch {
    // Not a URL.
  }

  const match =
    value.match(
      /0x[a-fA-F0-9]{64}/
    );

  return match
    ? match[0]
    : null;
}

export default function ScanQrScreen() {
  const [
    permission,
    requestPermission,
  ] =
    useCameraPermissions();

  const [scanned, setScanned] =
    useState(false);

  const handleScan = (
    result: BarcodeScanningResult
  ) => {
    if (scanned) {
      return;
    }

    const linkId =
      extractLinkId(
        result.data
      );

    if (!linkId) {
      setScanned(
        true
      );

      Alert.alert(
        "Invalid QR",
        "This does not look like a FlowUSD payment QR.",
        [
          {
            text:
              "Scan again",
            onPress: () =>
              setScanned(
                false
              ),
          },
        ]
      );

      return;
    }

    setScanned(true);

    router.replace(
      `/pay/${linkId}` as never
    );
  };

  if (!permission) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text
          style={
            styles.message
          }
        >
          Loading camera permission...
        </Text>
      </View>
    );
  }

  if (
    !permission.granted
  ) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text
          style={
            styles.title
          }
        >
          Camera permission
        </Text>

        <Text
          style={
            styles.message
          }
        >
          flowusd needs camera access to scan FlowUSD payment QR codes.
        </Text>

        <TouchableOpacity
          style={
            styles.primaryButton
          }
          onPress={() =>
            void requestPermission()
          }
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            Allow Camera
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.secondaryButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={
        styles.screen
      }
    >
      <CameraView
  style={
    StyleSheet.absoluteFill
  }
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
          ],
        }}
        onBarcodeScanned={
          scanned
            ? undefined
            : handleScan
        }
      />

      <View
        style={
          styles.overlay
        }
      >
        <View
          style={
            styles.topBar
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
                styles.backText
              }
            >
              ← Back
            </Text>
          </TouchableOpacity>

          <Text
            style={
              styles.heading
            }
          >
            Scan FlowUSD QR
          </Text>

          <Text
            style={
              styles.subheading
            }
          >
            Point the camera at a FlowUSD payment QR.
          </Text>
        </View>

        <View
          style={
            styles.scanArea
          }
        >
          <View
            style={
              styles.scanFrame
            }
          />
        </View>

        <View
          style={
            styles.bottomBox
          }
        >
          <Text
            style={
              styles.bottomText
            }
          >
            FlowUSD QR only
          </Text>

          {scanned ? (
            <TouchableOpacity
              style={
                styles.scanAgainButton
              }
              onPress={() =>
                setScanned(
                  false
                )
              }
            >
              <Text
                style={
                  styles.scanAgainText
                }
              >
                Scan Again
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        "#000000",
    },

    center: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 28,
      backgroundColor:
        "#F7F9FF",
    },

    title: {
      fontSize: 24,
      fontWeight: "800",
      color: "#101828",
      textAlign:
        "center",
    },

    message: {
      marginTop: 10,
      fontSize: 14,
      lineHeight: 21,
      color: "#667085",
      textAlign:
        "center",
    },

    primaryButton: {
      marginTop: 20,
      minWidth: 180,
      alignItems:
        "center",
      paddingVertical: 13,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor:
        "#2F6BFF",
    },

    primaryButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#ffffff",
    },

    secondaryButton: {
      marginTop: 10,
      paddingVertical: 12,
      paddingHorizontal: 18,
    },

    secondaryButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#2F6BFF",
    },

    overlay: {
      flex: 1,
      justifyContent:
        "space-between",
      backgroundColor:
        "rgba(0,0,0,0.28)",
    },

    topBar: {
      paddingTop: 54,
      paddingHorizontal: 20,
    },

    backButton: {
      alignSelf:
        "flex-start",
      paddingVertical: 8,
    },

    backText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#ffffff",
    },

    heading: {
      marginTop: 20,
      fontSize: 28,
      fontWeight: "800",
      color: "#ffffff",
      textAlign:
        "center",
    },

    subheading: {
      marginTop: 7,
      fontSize: 13,
      lineHeight: 19,
      color: "#E4E7EC",
      textAlign:
        "center",
    },

    scanArea: {
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    scanFrame: {
      width: 250,
      height: 250,
      borderRadius: 24,
      borderWidth: 4,
      borderColor:
        "#ffffff",
      backgroundColor:
        "transparent",
    },

    bottomBox: {
      paddingHorizontal: 20,
      paddingBottom: 48,
      alignItems:
        "center",
    },

    bottomText: {
      fontSize: 12,
      fontWeight: "800",
      color: "#ffffff",
    },

    scanAgainButton: {
      marginTop: 12,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor:
        "#2F6BFF",
    },

    scanAgainText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#ffffff",
    },
  });