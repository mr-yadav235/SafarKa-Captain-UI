import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Platform,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useTripStore } from "@/store/tripStore";
import { useAuthStore } from "@/store/authStore";
import { useRide } from "@/contexts/RideContext";
import { CaptainApi } from "@/lib/api";

export default function HomeScreen() {
  const {
    online,
    setOnline,
    currentRide,
    phase,
    receiveRide,
    acceptRide,
    declineRide,
    startRide,
    endRide,
    clear,
  } = useTripStore();
  const { user, logout } = useAuthStore();
  const {
    getPendingRides,
    acceptRide: acceptRideService,
    updateRideStatus,
    pushLocation,
    error,
    incomingRides,
    loading,
  } = useRide();
  const insets = useSafeAreaInsets();

  const [region, setRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>({
    latitude: 28.6139,
    longitude: 77.209,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // 📍 Ask location permission and set region
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log("Location permission status:", status);
        if (status !== "granted") {
          console.log("Location permission denied");
          return;
        }
        const current = await Location.getCurrentPositionAsync({});
        console.log("Current location:", current.coords);
        setRegion({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (error) {
        console.error("Location error:", error);
        // Fallback to Delhi, India
        setRegion({
          latitude: 28.6139,
          longitude: 77.209,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    })();
  }, []);

  // 🟢 Go online/offline + send heartbeat
  useEffect(() => {
    let timer: any;
    if (online && user && region) {
      CaptainApi.goOnlineMe().catch(() => {});
      console.log("Getting pending rides...");
      const rides =  getPendingRides();

      getPendingRides();

      timer = setInterval(() => {
         CaptainApi.heartbeat(user.id, {
           lat: region.latitude,
           lng: region.longitude,
         }).catch(() => {});
        if (currentRide && phase === "in_progress") {
          console.log('pushLocation', currentRide.id, region.latitude, region.longitude);
          pushLocation(Number(currentRide.id), region.latitude, region.longitude);
        }
        if (phase === "idle") {
          getPendingRides();
        }
      }, 10000);
    } else if (!online) {
      CaptainApi.goOfflineMe().catch(() => {});
    }
    return () => timer && clearInterval(timer);
  }, [online, user, region, currentRide, phase]);

  // 🟢 Handle new incoming rides
  useEffect(() => {
    
    const ridesArray = Array.isArray(incomingRides) ? incomingRides : [];
    console.log("Incoming rides changed:", ridesArray.length, "rides");
    console.log("Incoming rides type:", typeof incomingRides);
    console.log("Incoming rides content:", incomingRides);

    if (ridesArray.length > 0 && phase === "idle") {
      const latestRide = ridesArray[0];
      console.log("Auto-receiving latest ride (raw):", latestRide);

      // 🔄 Map backend snake_case → camelCase
      receiveRide({
        id: latestRide.id.toString(), // Convert to string for trip store
        pickup: latestRide.pickup,
        dropoff: latestRide.dropoff,
        pickupLat: latestRide.pickupLat,
        pickupLng: latestRide.pickupLng,
        dropLat: latestRide.dropLat,
        dropLng: latestRide.dropLng,
        fare: latestRide.fare,
        etaMinutes: 5,
      });
    }
  }, [incomingRides, phase]);

  const handleAcceptRide = async () => {
    if (!currentRide) return;
    console.log("Accepting ride with ID:", currentRide.id, "Type:", typeof currentRide.id);
    console.log("Current phase before accept:", phase);
    const success = await acceptRideService(Number(currentRide.id));
    console.log("Accept ride service result:", success);
    if (success) {
      console.log("Calling acceptRide() from trip store");
      acceptRide();
      console.log("Phase after acceptRide():", phase);
    } else {
      Alert.alert("Error", "Failed to accept ride. Please try again.");
    }
  };

  const handleStartRide = async () => {
    if (!currentRide) return;
    console.log("Starting ride with ID:", currentRide.id, "Type:", typeof currentRide.id);
    const success = await updateRideStatus(Number(currentRide.id), "ongoing");
    if (success) {
      startRide();
    } else {
      Alert.alert("Error", "Failed to start ride. Please try again.");
    }
  };

  const handleEndRide = async () => {
    if (!currentRide) return;
    console.log("Ending ride with ID:", currentRide.id, "Type:", typeof currentRide.id);
    const success = await updateRideStatus(Number(currentRide.id), "completed");
    if (success) {
      endRide();
      setTimeout(() => clear(), 1200);
    } else {
      Alert.alert("Error", "Failed to end ride. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      {/* Debug info */}
      <View style={styles.debugPanel}>
        <Text style={styles.debugText}>Region: {region ? 'Set' : 'Not set'}</Text>
        <Text style={styles.debugText}>Online: {online ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Phase: {phase}</Text>
        <Text style={styles.debugText}>Current Ride: {currentRide ? `ID: ${currentRide.id}` : 'No'}</Text>
        <Text style={styles.debugText}>User: {user ? user.name : 'None'}</Text>
        <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
        <Text style={styles.debugText}>Show Start Button: {phase === 'accepted' ? 'YES' : 'NO'}</Text>
        <Text style={styles.debugText}>Bottom Inset: {insets.bottom}</Text>
        {region && (
          <Text style={styles.debugText}>
            Lat: {region.latitude.toFixed(4)}, Lng: {region.longitude.toFixed(4)}
          </Text>
        )}
      </View>

      {region ? (
        <View style={StyleSheet.absoluteFill}>
          {/* Simple MapView test */}
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            onMapReady={() => console.log("✅ Map is ready - tiles should load now")}
            onRegionChange={(newRegion) => console.log("📍 Region changed:", newRegion)}
          />
          {/* Test overlay to see if anything renders */}
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayText}>Map Test - Should see map behind this</Text>
            <Text style={styles.mapOverlayText}>Region: {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}</Text>
            <Text style={styles.mapOverlayText}>Platform: {Platform.OS}</Text>
          </View>
        </View>
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { justifyContent: "center", alignItems: "center", backgroundColor: "#f0f0f0" },
          ]}
        >
          <Text style={{ fontSize: 16, color: "#666" }}>Loading map...</Text>
          <Text style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
            Region: {JSON.stringify(region)}
          </Text>
        </View>
      )}

      {/* 🔝 Top bar */}
      <View style={styles.topBar}>
        <View style={styles.leftSection}>
          <Text style={styles.title}>Captain</Text>
          <Text style={styles.userName}>{user?.name}</Text>
        </View>
        <View style={styles.rightSection}>
          <View style={styles.row}>
            <Text
              style={{
                color: online ? "#16a34a" : "#ef4444",
                fontWeight: "600",
                marginRight: 8,
              }}
            >
              {online ? "Online" : "Offline"}
            </Text>
            <Switch value={online} onValueChange={(v) => setOnline(v)} />
          </View>
          <Pressable style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </View>

      {!online && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Go Online to receive ride requests</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

       {/* 🟢 Available rides list */}
       {online && phase === "idle" && Array.isArray(incomingRides) && incomingRides.length > 0 && (
         <View style={styles.ridesList}>
           <Text style={styles.ridesListTitle}>Available Rides ({incomingRides.length})</Text>
           {incomingRides.map((ride) => (
             <View key={ride.id} style={styles.rideCard}>
               <View style={styles.rideInfo}>
                 <Text style={styles.ridePickup}>📍 {ride.pickup}</Text>
                 <Text style={styles.rideDropoff}>🎯 {ride.dropoff}</Text>
                 <Text style={styles.rideFare}>💰 ₹{ride.fare}</Text>
                 {ride.customer && (
                   <Text style={styles.rideCustomer}>👤 {ride.customer.name}</Text>
                 )}
               </View>
               <Pressable
                 style={styles.acceptButton}
                 onPress={() => {
                  receiveRide({
                    id: ride.id.toString(),
                    pickup: ride.pickup,
                    dropoff: ride.dropoff,
                    pickupLat: ride.pickupLat,
                    pickupLng: ride.pickupLng,
                    dropLat: ride.dropLat,
                    dropLng: ride.dropLng,
                    fare: ride.fare,
                    etaMinutes: 5,
                   });
                 }}
               >
                 <Text style={styles.acceptButtonText}>Accept</Text>
               </Pressable>
             </View>
           ))}
         </View>
       )}

       {/* 🟢 Debug info */}
       {online && phase === "idle" && (
         <View style={styles.debugInfo}>
           <Text style={styles.debugText}>
             Debug: {Array.isArray(incomingRides) ? incomingRides.length : 'not array'} rides
           </Text>
           <Text style={styles.debugText}>
             Loading: {loading ? 'Yes' : 'No'} | Error: {error || 'None'}
           </Text>
         </View>
       )}

      {/* 🟢 Manual refresh */}
      {online && phase === "idle" && (
        <View style={styles.simulate}>
          <Pressable onPress={() => getPendingRides()} style={styles.button}>
            <Text style={styles.buttonText}>
              {Array.isArray(incomingRides) && incomingRides.length > 0
                ? `Refresh (${incomingRides.length} rides)`
                : "Check for Rides"}
            </Text>
          </Pressable>
        </View>
      )}


      {/* 🟢 Incoming request modal */}
      <Modal visible={phase === "incoming"} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Ride Request</Text>
            <Text style={styles.modalLine}>Pickup: {currentRide?.pickup}</Text>
            <Text style={styles.modalLine}>Dropoff: {currentRide?.dropoff}</Text>
            <Text style={styles.modalLine}>Fare: ₹{currentRide?.fare}</Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <Pressable
                style={[styles.btn, { backgroundColor: "#16a34a" }]}
                onPress={handleAcceptRide}
              >
                <Text style={styles.btnText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor: "#ef4444" }]}
                onPress={declineRide}
              >
                <Text style={styles.btnText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🟢 Footer actions */}
      {online && (phase === "accepted" || phase === "in_progress") && (
        <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
          {phase === "accepted" && (
            <Pressable
              style={[styles.btn, { flex: 1, backgroundColor: "#2563eb" }]}
              onPress={handleStartRide}
            >
              <Text style={styles.btnText}>🚀 Start Ride</Text>
            </Pressable>
          )}
          {phase === "in_progress" && (
            <Pressable
              style={[styles.btn, { flex: 1, backgroundColor: "#16a34a" }]}
              onPress={handleEndRide}
            >
              <Text style={styles.btnText}>🏁 End Ride</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Debug indicator for footer visibility */}
      {online && (phase === "accepted" || phase === "in_progress") && (
        <View style={styles.footerDebug}>
          <Text style={styles.footerDebugText}>
            Footer Visible - Phase: {phase}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftSection: { flex: 1 },
  rightSection: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: "white", fontSize: 18, fontWeight: "700" },
  userName: { color: "white", fontSize: 12, opacity: 0.8 },
  row: { flexDirection: "row", alignItems: "center" },
  logoutButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutText: { color: "white", fontSize: 12, fontWeight: "600" },
  overlay: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  overlayText: { color: "white", fontWeight: "600" },
  errorOverlay: {
    position: "absolute",
    top: Platform.OS === "ios" ? 120 : 90,
    left: 16,
    right: 16,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center" },
  simulate: { position: "absolute", bottom: 40, left: 16, right: 16 },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "white",
    width: "100%",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalLine: { marginTop: 4 },
  btn: { 
    padding: 16, 
    borderRadius: 12, 
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  btnText: { color: "white", fontWeight: "700" },
   footer: {
     position: "absolute",
     left: 16,
     right: 16,
     flexDirection: "row",
     gap: 12,
     zIndex: 1000,
   },
   ridesList: {
     position: "absolute",
     top: Platform.OS === "ios" ? 120 : 90,
     left: 16,
     right: 16,
     maxHeight: 400,
     backgroundColor: "white",
     borderRadius: 12,
     shadowColor: "#000",
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.25,
     shadowRadius: 3.84,
     elevation: 5,
   },
   ridesListTitle: {
     fontSize: 16,
     fontWeight: "700",
     padding: 16,
     borderBottomWidth: 1,
     borderBottomColor: "#e5e7eb",
     backgroundColor: "#f8fafc",
     borderTopLeftRadius: 12,
     borderTopRightRadius: 12,
   },
   rideCard: {
     flexDirection: "row",
     padding: 16,
     borderBottomWidth: 1,
     borderBottomColor: "#f1f5f9",
     alignItems: "center",
   },
   rideInfo: {
     flex: 1,
   },
   ridePickup: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
   rideDropoff: { fontSize: 14, color: "#64748b", marginBottom: 4 },
   rideFare: { fontSize: 16, fontWeight: "700", color: "#16a34a", marginBottom: 4 },
   rideCustomer: { fontSize: 12, color: "#64748b" },
   acceptButton: {
     backgroundColor: "#16a34a",
     paddingHorizontal: 16,
     paddingVertical: 8,
     borderRadius: 8,
     marginLeft: 12,
   },
   acceptButtonText: { color: "white", fontWeight: "600", fontSize: 14 },
  debugPanel: {
    position: "absolute",
    top: Platform.OS === "ios" ? 100 : 70,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 12,
    borderRadius: 8,
    zIndex: 1000,
  },
  debugText: { 
    color: "white", 
    fontSize: 11, 
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  mapOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -100 }, { translateY: -20 }],
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#3b82f6",
  },
  mapOverlayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    textAlign: "center",
  },
  debugInfo: {
    position: "absolute",
    top: Platform.OS === "ios" ? 180 : 150,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 8,
    borderRadius: 8,
  },
  footerDebug: {
    position: "absolute",
    top: Platform.OS === "ios" ? 200 : 170,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,0,0,0.8)",
    padding: 8,
    borderRadius: 8,
    zIndex: 1001,
  },
  footerDebugText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
 });
