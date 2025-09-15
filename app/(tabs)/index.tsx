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
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useTripStore } from "@/store/tripStore";
import { useAuthStore } from "@/store/authStore";
import { useRide } from "@/contexts/RideContext";
import { CaptainApi, VehicleApi } from "@/lib/api";
import { RedisGeoService } from "@/lib/redisGeoService";
import { RideServiceWS } from "../../services/RideServiceWS";
import { getSocket, createSocket, disconnectSocket } from "../../lib/socketClient";
import { getToken, getCaptainProfile } from "../../store/authStore";
import * as Haptics from 'expo-haptics';

// Notification function for ride offers
const playNotification = async () => {
  try {
    // Play haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Add a small delay and play another haptic for emphasis
    setTimeout(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 200);
    
    console.log("🔔 Notification played (haptics only)");
  } catch (error) {
    console.error("❌ Failed to play notification:", error);
  }
};

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
    rideOfferCountdown: tripStoreCountdown,
  } = useTripStore();
  const { user, logout } = useAuthStore();
  const {
    error,
    incomingRides,
    loading,
    clearRide,
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

  // 10-second countdown timer for ride offers
  const [rideOfferTimer, setRideOfferTimer] = useState<number | null>(null);
  
  // Track last received ride ID to prevent duplicates
  const [lastReceivedRideId, setLastReceivedRideId] = useState<string | null>(null);
  
  // Track completed ride IDs to prevent re-offering
  const [completedRideIds, setCompletedRideIds] = useState<Set<string>>(new Set());
  
  // Track ride offer timestamps to prevent rapid re-offers
  const [rideOfferTimestamps, setRideOfferTimestamps] = useState<Map<string, number>>(new Map());
  
  // Track if captain is currently handling a ride
  const [isHandlingRide, setIsHandlingRide] = useState<boolean>(false);
  
  // Track WebSocket connection status
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  
  // Store complete original ride data for sending when accepting
  const [originalRideData, setOriginalRideData] = useState<any>(null);
  const [currentVehicle, setCurrentVehicle] = useState<any>(null);
  


  // Sync WebSocket connection state
  useEffect(() => {
    const socket = getSocket();
    setWsConnected(socket ? socket.connected : false);
  }, []);

  // Fetch current vehicle when component mounts
  useEffect(() => {
    const fetchCurrentVehicle = async () => {
      try {
        const response = await VehicleApi.getCurrentVehicle();
        if (response.data.success) {
          setCurrentVehicle(response.data.data);
          console.log("🚗 Current vehicle loaded:", response.data.data);
        } else {
          console.log("⚠️ No current vehicle selected");
          setCurrentVehicle(null);
        }
      } catch (error) {
        console.error("❌ Failed to fetch current vehicle:", error);
        setCurrentVehicle(null);
      }
    };

    if (user) {
      fetchCurrentVehicle();
    }
  }, [user]);

  // Monitor phase changes for debugging
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`🔄 [${timestamp}] ===== PHASE CHANGE DETECTED =====`);
    console.log(`🔄 [${timestamp}] Phase changed to:`, phase);
    console.log(`🔄 [${timestamp}] Current ride:`, currentRide);
    console.log(`🔄 [${timestamp}] Modal should be visible:`, phase === "incoming");
    console.log(`🔄 [${timestamp}] Modal visible condition:`, phase === "incoming" ? "✅ YES" : "❌ NO");
    
    // Play notification when ride offer appears
    if (phase === "incoming" && currentRide) {
      console.log(`🔔 [${timestamp}] Playing notification for new ride offer`);
      playNotification();
    }
  }, [phase, currentRide]);

  // Countdown timer effect - using trip store countdown
  useEffect(() => {
    if (tripStoreCountdown > 0) {
      const timer = setTimeout(() => {
        // The trip store manages its own countdown internally
        // We just need to check if it expired and handle accordingly
        const currentState = useTripStore.getState();
        if (currentState.rideOfferCountdown <= 1 && currentState.phase === 'incoming') {
          // Timer expired - the trip store will handle auto-decline
          console.log("⏰ Ride offer timer expired - trip store will handle auto-decline");
        }
      }, 1000);
      setRideOfferTimer(timer);
    } else if (rideOfferTimer) {
      clearTimeout(rideOfferTimer);
      setRideOfferTimer(null);
    }

    return () => {
      if (rideOfferTimer) {
        clearTimeout(rideOfferTimer);
      }
    };
  }, [tripStoreCountdown]);

  // Cleanup old timestamps every 5 minutes
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setRideOfferTimestamps(prev => {
        const newMap = new Map();
        prev.forEach((timestamp, rideId) => {
          if (now - timestamp < 300000) { // Keep timestamps for 5 minutes
            newMap.set(rideId, timestamp);
          }
        });
        return newMap;
      });
    }, 300000); // Run every 5 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  // Calculate optimal region to show all markers
  const getOptimalRegion = () => {
    if (!region) return null;
    
    if (currentRide && currentRide.pickupLat && currentRide.pickupLng && currentRide.dropLat && currentRide.dropLng) {
      // Calculate bounds to include captain, pickup, and dropoff
      const lats = [region.latitude, currentRide.pickupLat, currentRide.dropLat];
      const lngs = [region.longitude, currentRide.pickupLng, currentRide.dropLng];
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      const latDelta = (maxLat - minLat) * 1.2; // Add 20% padding
      const lngDelta = (maxLng - minLng) * 1.2;
      
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(latDelta, 0.01), // Minimum zoom level
        longitudeDelta: Math.max(lngDelta, 0.01),
      };
    }
    
    return region;
  };

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
      // Get captain profile for location updates
      const captainProfile = getCaptainProfile();
      
      // Update captain profile with current vehicle from state
      if (captainProfile && currentVehicle) {
        captainProfile.current_vehicle = currentVehicle;
      }
      
      // Redis: set location + status immediately
      RedisGeoService.updateLocation(Number(user.id), region.latitude, region.longitude, captainProfile || undefined);
  
      // Start heartbeat every 10s
      timer = setInterval(() => {
        // Update captain profile with current vehicle from state for each heartbeat
        const updatedProfile = getCaptainProfile();
        if (updatedProfile && currentVehicle) {
          updatedProfile.current_vehicle = currentVehicle;
        }
        RedisGeoService.updateLocation(Number(user.id), region.latitude, region.longitude, updatedProfile || undefined);
  
        if (currentRide && phase === "in_progress") {
          // Use WebSocket for location updates instead of REST API
          RideServiceWS.sendLocationUpdate(
            currentRide.id, 
            (currentRide as any).customer_id || "unknown", 
            region.latitude, 
            region.longitude
          );
        }
  
        // Only WebSocket rides are shown - no REST API calls
      }, 10000);
    } else if (!online && user) {
      // Manual offline
      RedisGeoService.goOffline(Number(user.id));
    }
  
    return () => timer && clearInterval(timer);
  }, [online, user, region, currentRide, phase]);
  // 🟢 Handle new incoming rides

  // 🟢 WebSocket ride events (from RideServiceWS)
  useEffect(() => {
  if (!RideServiceWS) return;

  // Listen for WebSocket events only if socket exists
  const socket = getSocket();
  if (socket) {
    socket.on("registration-success", (data: any) => {
      console.log("✅ Captain registration confirmed:", data);
    });

    // Listen for disconnection events
    socket.on("disconnect", (reason: string) => {
      console.log("🔌 WebSocket disconnected:", reason);
      setWsConnected(false);
      // Update online status if we're still showing as online
      if (online) {
        console.log("🔄 WebSocket disconnected while online, updating status");
        setOnline(false);
      }
    });

    socket.on("connect", () => {
      console.log("🔗 WebSocket connected");
      setWsConnected(true);
    });

    // Cleanup function to remove event listeners
    return () => {
      socket.off("registration-success");
      socket.off("disconnect");
      socket.off("connect");
    };
  }
}, [online, RideServiceWS]);

// Separate effect for ride offers - only when online and socket connected
useEffect(() => {
  if (!RideServiceWS || !online) {
    console.log("🔧 Skipping ride offer listener setup - RideServiceWS or online not available");
    return;
  }

  const socket = getSocket();
  if (!socket || !socket.connected) {
    console.log("🔧 Skipping ride offer listener setup - socket not connected");
    return;
  }

  console.log("🔧 Setting up ride offer listeners - socket connected and online");

  // Listen for new ride offers
  RideServiceWS.onNewRide((ride: any) => {
    const timestamp = new Date().toISOString();
    console.log(`🚖 [${timestamp}] ===== NEW RIDE OFFER RECEIVED =====`);
    console.log(`🚖 [${timestamp}] ===== RIDE OFFER DETAILS =====`);
    console.log(`🚖 [${timestamp}] Raw ride data:`, JSON.stringify(ride, null, 2));
    console.log(`🚖 [${timestamp}] Ride data type:`, typeof ride);
    console.log(`🚖 [${timestamp}] Is array format:`, Array.isArray(ride));
    console.log(`🚖 [${timestamp}] Data length:`, Array.isArray(ride) ? ride.length : 'N/A');
    
    console.log(`🚖 [${timestamp}] ===== CAPTAIN APP STATE =====`);
    console.log(`🚖 [${timestamp}] Current phase:`, phase);
    console.log(`🚖 [${timestamp}] Online status:`, online);
    console.log(`🚖 [${timestamp}] Handling ride:`, isHandlingRide);
    console.log(`🚖 [${timestamp}] WebSocket connected:`, wsConnected);
    console.log(`🚖 [${timestamp}] Captain ID:`, user?.id);
    console.log(`🚖 [${timestamp}] Captain name:`, user?.name);
    console.log(`🚖 [${timestamp}] Current vehicle:`, currentVehicle ? `${currentVehicle.vehicle_type} ${currentVehicle.make} ${currentVehicle.model}` : 'None');

    // Handle array format - extract first ride if it's an array
    const rideData = Array.isArray(ride) ? ride[0] : ride;
    console.log(`🚖 [${timestamp}] ===== EXTRACTED RIDE DATA =====`);
    console.log(`🚖 [${timestamp}] Processed ride data:`, JSON.stringify(rideData, null, 2));
    console.log(`🚖 [${timestamp}] Ride ID:`, rideData.id);
    console.log(`🚖 [${timestamp}] Pickup:`, rideData.pickup);
    console.log(`🚖 [${timestamp}] Dropoff:`, rideData.dropoff);
    console.log(`🚖 [${timestamp}] Fare:`, rideData.fare);
    console.log(`🚖 [${timestamp}] Requested vehicle type:`, rideData.requested_vehicle_type);
    console.log(`🚖 [${timestamp}] Captain data:`, rideData.captainData);
    console.log(`🚖 [${timestamp}] Distance:`, rideData.captainDistance);

    // Check if this is a duplicate ride or already completed
    const rideId = rideData.id.toString();
    const now = Date.now();
    
    console.log(`🔍 [${timestamp}] ===== DUPLICATE CHECK =====`);
    console.log(`🔍 [${timestamp}] Ride ID extracted:`, rideId);
    console.log(`🔍 [${timestamp}] Ride ID type:`, typeof rideId);
    console.log(`🔍 [${timestamp}] Last received ride ID:`, lastReceivedRideId);
    console.log(`🔍 [${timestamp}] Completed ride IDs:`, Array.from(completedRideIds));
    
    if (lastReceivedRideId === rideId) {
      console.log("⚠️ Duplicate ride offer ignored:", rideId);
      return;
    }
    
    if (completedRideIds.has(rideId)) {
      console.log("⚠️ Completed ride offer ignored:", rideId);
      return;
    }
    
    // Check if this ride was offered recently (within 30 seconds)
    const lastOfferTime = rideOfferTimestamps.get(rideId);
    if (lastOfferTime && (now - lastOfferTime) < 30000) {
      console.log("⚠️ Recent ride offer ignored (too soon):", rideId);
      return;
    }
    
    // Check if captain is currently handling a ride
    console.log(`🔍 [${timestamp}] ===== CAPTAIN STATUS CHECK =====`);
    console.log(`🔍 [${timestamp}] Checking isHandlingRide:`, isHandlingRide);
    if (isHandlingRide) {
      console.log(`⚠️ [${timestamp}] Ride offer ignored (captain busy):`, rideId);
      return;
    }

    // Update last received ride ID and timestamp
    setLastReceivedRideId(rideId);
    setRideOfferTimestamps(prev => new Map(prev.set(rideId, now)));
    console.log(`📝 [${timestamp}] Updated tracking - lastReceivedRideId:`, rideId);
    console.log(`📝 [${timestamp}] Updated tracking - timestamp:`, now);

    // Store complete original ride data for sending when accepting
    setOriginalRideData(rideData);
    console.log(`📦 [${timestamp}] ===== STORING ORIGINAL RIDE DATA =====`);
    console.log(`📦 [${timestamp}] Original ride data stored:`, JSON.stringify(rideData, null, 2));

    // Pass to trip store → incoming modal / list
    // Handle both snake_case (from backend) and camelCase (from frontend) field names
    const processedRideData = {
      id: rideId,
      pickup: rideData.pickup || rideData.pickup_address || 'Unknown pickup',
      dropoff: rideData.dropoff || rideData.dropoff_address || 'Unknown dropoff',
      pickupLat: rideData.pickupLat || rideData.pickup_lat || 0,
      pickupLng: rideData.pickupLng || rideData.pickup_lng || 0,
      dropLat: rideData.dropLat || rideData.drop_lat || 0,
      dropLng: rideData.dropLng || rideData.drop_lng || 0,
      fare: rideData.fare || rideData.estimated_fare || 0,
      etaMinutes: 5,
    };
    
    console.log(`📤 [${timestamp}] ===== CALLING TRIP STORE =====`);
    console.log(`📤 [${timestamp}] Processed ride data for trip store:`, JSON.stringify(processedRideData, null, 2));
    console.log(`📤 [${timestamp}] Current phase before receiveRide:`, phase);
    console.log(`📤 [${timestamp}] Current trip store state before receiveRide:`, useTripStore.getState());
    console.log(`📤 [${timestamp}] About to call receiveRide()...`);
    
    receiveRide(processedRideData);
    
    console.log(`✅ [${timestamp}] ===== TRIP STORE CALLED =====`);
    console.log(`✅ [${timestamp}] receiveRide() called successfully`);
    console.log(`✅ [${timestamp}] Current trip store state after receiveRide:`, useTripStore.getState());
    console.log(`✅ [${timestamp}] Phase should now be 'incoming'`);
    console.log(`✅ [${timestamp}] Modal should now be visible`);
    console.log(`✅ [${timestamp}] Countdown timer should start (10 seconds)`);
    console.log(`⏰ [${timestamp}] Trip store will handle countdown timer automatically`);
  });

  // Ride officially assigned - sync state from WebSocket
  RideServiceWS.onRideAssigned((ride: any) => {
    const timestamp = new Date().toISOString();
    console.log(`✅ [${timestamp}] Ride assigned via WS:`, ride);
    console.log(`✅ [${timestamp}] Syncing state to 'accepted' phase`);
    
    // Update trip store state
    acceptRide();
    
    // Clear local state
    setLastReceivedRideId(null);
    setIsHandlingRide(false);
    
    console.log(`✅ [${timestamp}] State synced to accepted phase`);
  });

  // Ride started - sync state from WebSocket
  RideServiceWS.onRideStarted((ride: any) => {
    const timestamp = new Date().toISOString();
    console.log(`🚀 [${timestamp}] ===== RIDE STARTED EVENT RECEIVED =====`);
    console.log(`🚀 [${timestamp}] Ride started via WS:`, ride);
    console.log(`🚀 [${timestamp}] Current phase before update:`, phase);
    console.log(`🚀 [${timestamp}] Current ride before update:`, currentRide);
    console.log(`🚀 [${timestamp}] Syncing state to 'in_progress' phase`);
    
    // Update trip store state
    console.log(`🚀 [${timestamp}] Calling startRide() from trip store...`);
    startRide();
    
    // Check the phase after calling startRide
    const newPhase = useTripStore.getState().phase;
    console.log(`🚀 [${timestamp}] Phase after startRide():`, newPhase);
    console.log(`🚀 [${timestamp}] State synced to in_progress phase`);
    console.log(`🚀 [${timestamp}] ===== RIDE STARTED EVENT PROCESSED =====`);
  });

  // Test event listener to verify socket is working
  if (socket) {
    socket.on("test-ride-started", (data: any) => {
      const timestamp = new Date().toISOString();
      console.log(`🧪 [${timestamp}] TEST ride-started event received in captain app:`, data);
    });
    
    // Test listener for new-ride events to verify they're being received
    socket.on("new-ride", (data: any) => {
      const timestamp = new Date().toISOString();
      console.log(`🧪 [${timestamp}] ===== DIRECT SOCKET NEW-RIDE EVENT =====`);
      console.log(`🧪 [${timestamp}] Direct socket listener received new-ride:`, JSON.stringify(data, null, 2));
      console.log(`🧪 [${timestamp}] ===== END DIRECT SOCKET NEW-RIDE EVENT =====`);
    });
  }

  // Ride completed - sync state from WebSocket
  RideServiceWS.onRideCompleted((ride: any) => {
    const timestamp = new Date().toISOString();
    console.log(`🏁 [${timestamp}] Ride completed via WS:`, ride);
    console.log(`🏁 [${timestamp}] Syncing state to 'completed' phase`);
    
    // Update trip store state
    endRide();
    
    // Clear all local state
    setLastReceivedRideId(null);
    setIsHandlingRide(false);
    setOriginalRideData(null);
    
    console.log(`🏁 [${timestamp}] State synced to completed phase`);
  });

  // Ride cancelled - sync state from WebSocket
  RideServiceWS.onRideCancelled((ride: any) => {
    const timestamp = new Date().toISOString();
    console.log(`❌ [${timestamp}] Ride cancelled via WS:`, ride);
    console.log(`❌ [${timestamp}] Syncing state to 'idle' phase`);
    
    // Clear all state
    clear();
    setLastReceivedRideId(null);
    setIsHandlingRide(false);
    setOriginalRideData(null);
    
    console.log(`❌ [${timestamp}] State synced to idle phase`);
  });

  // Ride expired (captain did not accept in time)
  RideServiceWS.onError((error: any) => {
    console.log(`❌ Ride error:`, error);
    if (error.message?.includes("expired")) {
      Alert.alert("Ride expired", "The ride was offered to another captain.");
      clear();
    }
  });

  return () => {
    const cleanupTimestamp = new Date().toISOString();
    console.log(`🧹 [${cleanupTimestamp}] Cleaning up ride offer listeners...`);
    RideServiceWS.off("new-ride");
    RideServiceWS.off("ride-assigned");
    RideServiceWS.off("ride-started");
    RideServiceWS.off("ride-completed");
    RideServiceWS.off("ride-cancelled");
    RideServiceWS.off("error");
    
    // Clean up test event listener
    if (socket) {
      socket.off("test-event");
    }
  };
}, [RideServiceWS, receiveRide, acceptRide, clear, online]);

  // DISABLED: Only show rides from WebSocket, not from REST API
  // useEffect(() => {
  //   const ridesArray = Array.isArray(incomingRides) ? incomingRides : [];
  //   console.log("Incoming rides changed:", ridesArray.length, "rides");
  //   console.log("Incoming rides type:", typeof incomingRides);
  //   console.log("Incoming rides content:", incomingRides);

  //   if (ridesArray.length > 0 && phase === "idle" && !isHandlingRide) {
  //     const latestRide = ridesArray[0];
  //     const rideId = latestRide.id.toString();
      
  //     // Check if this ride was already processed or completed
  //     if (lastReceivedRideId === rideId || completedRideIds.has(rideId)) {
  //       console.log("⚠️ Skipping already processed ride:", rideId);
  //       return;
  //     }
      
  //     console.log("Auto-receiving latest ride (raw):", latestRide);

  //     // 🔄 Map backend snake_case → camelCase
  //     receiveRide({
  //       id: rideId,
  //       pickup: latestRide.pickup,
  //       dropoff: latestRide.dropoff,
  //       pickupLat: latestRide.pickupLat,
  //       pickupLng: latestRide.pickupLng,
  //       dropLat: latestRide.dropLat,
  //       dropLng: latestRide.dropLng,
  //       fare: latestRide.fare,
  //       etaMinutes: 5,
  //     });
  //   }
  // }, [incomingRides, phase, isHandlingRide, lastReceivedRideId, completedRideIds]);

  // WebSocket-only accept ride handler
  const handleAcceptRide = async () => {
    if (!currentRide || !user) return;
  
    console.log("🚖 Accepting ride (ID):", currentRide.id, "Captain:", user.id);
    console.log("🚖 Original ride data:", originalRideData);
  
    // Set handling state and clear countdown timer (UI feedback only)
    setIsHandlingRide(true);
    setLastReceivedRideId(null);
    
    // Clear any active countdown timer
    if (rideOfferTimer) {
      clearTimeout(rideOfferTimer);
      setRideOfferTimer(null);
      console.log("⏰ Cleared countdown timer on accept");
    }
    
    // Update trip store state immediately for better UX
      acceptRide();
    console.log("✅ Trip store state updated to 'accepted' phase");
  
    // 🔌 Send WebSocket event - state will be synced via WebSocket response
    RideServiceWS.acceptRide(currentRide.id, user.id, originalRideData);
    console.log("📤 WebSocket accept-ride event sent");
    
    // Note: WebSocket event listener (onRideAssigned) will provide final state sync
  };

  const handleDeclineRide = () => {
    console.log("❌ Declining ride");
    if (currentRide) {
      // Add to completed rides set to prevent re-offering
      setCompletedRideIds(prev => new Set([...prev, currentRide.id]));
    }
    
    // Clear UI state (local feedback only)
    setLastReceivedRideId(null);
    setIsHandlingRide(false);
    
    // Update trip store state
    declineRide();
    
    // Note: No WebSocket event needed for decline - it's a local action
  };
  // WebSocket-only start ride handler

  const handleStartRide = async () => {
    if (!currentRide || !user) return;
  
    console.log("🚦 Starting ride (ID):", currentRide.id, "Captain:", user.id);
    console.log("🚦 Current phase before start:", phase);
    console.log("🚦 WebSocket connected:", getSocket()?.connected);
  
    // 🔌 Send WebSocket event - state will be synced via WebSocket response
    RideServiceWS.startRide(currentRide.id, user.id);
    console.log("📤 WebSocket start-ride event sent");
    
    // Note: State will be updated via WebSocket event listener (onRideStarted)
    // No manual state updates here - let WebSocket events drive the state
  };
  

  // WebSocket-only end ride handler

 

  const handleEndRide = async () => {
    if (!currentRide || !user) return;
  
    console.log("🏁 Ending ride (ID):", currentRide.id, "Captain:", user.id);
  
    // Add to completed rides set (local tracking)
    setCompletedRideIds(prev => new Set([...prev, currentRide.id]));
  
    // 🔌 Send WebSocket event - state will be synced via WebSocket response
    RideServiceWS.endRide(currentRide.id, user.id);
    
    // Note: State will be updated via WebSocket event listener (onRideCompleted)
    // No manual state updates here - let WebSocket events drive the state
  };
  

  return (
    <View style={styles.container}>
      {/* Debug info */}
      <View style={styles.debugPanel}>
        <Text style={styles.debugText}>Region: {region ? 'Set' : 'Not set'}</Text>
        <Text style={styles.debugText}>Online: {online ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Phase: {phase}</Text>
        <Text style={styles.debugText}>Current Ride: {currentRide ? `ID: ${currentRide.id}` : 'No'}</Text>
        <Text style={styles.debugText}>Last Ride ID: {lastReceivedRideId || 'None'}</Text>
        <Text style={styles.debugText}>Countdown: {tripStoreCountdown}s</Text>
        <Text style={styles.debugText}>Completed: {completedRideIds.size} rides</Text>
        <Text style={styles.debugText}>Handling: {isHandlingRide ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Incoming: {incomingRides.length} rides</Text>
        <Text style={styles.debugText}>WS Connected: {wsConnected ? 'Yes' : 'No'}</Text>
        <Text style={styles.debugText}>Socket.connected: {getSocket()?.connected ? 'Yes' : 'No'}</Text>
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
            provider={PROVIDER_GOOGLE}  
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            region={getOptimalRegion() || region}
            onMapReady={() => console.log("✅ Map is ready - tiles should load now")}
            onRegionChange={(newRegion) => console.log("📍 Region changed:", newRegion)}
          >
            {/* Captain's current location marker */}
            <Marker
              coordinate={{
                latitude: region.latitude,
                longitude: region.longitude,
              }}
              title="Your Location"
              description="Captain's current position"
              pinColor="blue"
            />
            
            {/* Ride pickup and dropoff markers */}
            {currentRide && currentRide.pickupLat && currentRide.pickupLng && (
              <Marker
                coordinate={{
                  latitude: currentRide.pickupLat,
                  longitude: currentRide.pickupLng,
                }}
                title="Pickup Location"
                description={currentRide.pickup || "Pickup point"}
                pinColor="green"
              />
            )}
            
            {currentRide && currentRide.dropLat && currentRide.dropLng && (
              <Marker
                coordinate={{
                  latitude: currentRide.dropLat,
                  longitude: currentRide.dropLng,
                }}
                title="Dropoff Location"
                description={currentRide.dropoff || "Dropoff point"}
                pinColor="red"
              />
            )}
          </MapView>
          {/* Map overlay with location info */}
          <View style={styles.mapOverlay}>
            <Text style={styles.mapOverlayText}>📍 Your Location: {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}</Text>
            {currentRide && (
              <>
                <Text style={styles.mapOverlayText}>🚗 Active Ride: {currentRide.id}</Text>
                <Text style={styles.mapOverlayText}>🟢 Pickup: {currentRide.pickupLat?.toFixed(4)}, {currentRide.pickupLng?.toFixed(4)}</Text>
                <Text style={styles.mapOverlayText}>🔴 Dropoff: {currentRide.dropLat?.toFixed(4)}, {currentRide.dropLng?.toFixed(4)}</Text>
              </>
            )}
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
          <Text style={styles.userName}>{user?.name || 'Loading...'}</Text>
          {currentVehicle ? (
            <Text style={styles.vehicleInfo}>
              🚗 {currentVehicle.vehicle_type} • {currentVehicle.make} {currentVehicle.model}
            </Text>
          ) : (
            <Text style={styles.vehicleWarning}>
              ⚠️ No vehicle selected
            </Text>
          )}
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
            <Switch 
              value={online} 
              onValueChange={(v) => {
                console.log("🔄 Switch toggled - new value:", v, "current online:", online);
              setOnline(v);
              if (v && user?.id) {
                // Check if captain has a current vehicle selected
                if (!currentVehicle) {
                  console.log("❌ No current vehicle selected");
                  Alert.alert(
                    "Vehicle Required", 
                    "Please select a current vehicle before going online. Go to the Vehicles tab to set your active vehicle.",
                    [
                      { text: "OK", onPress: () => setOnline(false) }
                    ]
                  );
                  return;
                }
                
                // Check if we have a valid token before going online
                const token = getToken();
                if (!token) {
                  console.log("❌ No token available, please login first");
                  Alert.alert("Error", "Please login first");
                  setOnline(false);
                  return;
                }
                
                // Validate token format
                if (!token.startsWith('eyJ') || token.split('.').length !== 3) {
                  console.log("❌ Invalid token format, please login again");
                  Alert.alert("Error", "Invalid token format, please login again");
                  setOnline(false);
                  return;
                }
                
                // Connect to WebSocket and register captain when going online
                console.log("📤 Going online - connecting to WebSocket and registering captain:", user.id);
                console.log("📤 Captain ID type:", typeof user.id, "value:", user.id);
                
                // Create and connect WebSocket
                const socket = createSocket();
                console.log("🔄 Socket created:", !!socket);
                console.log("🔄 Socket connected:", socket?.connected);
                
                if (socket.connected) {
                  console.log("✅ WebSocket already connected, registering captain");
                  RideServiceWS.registerCaptain(user.id);
                } else {
                  console.log("🔄 WebSocket not connected, connecting first...");
                  socket.connect();
                  
                  // Wait for connection then register
                  socket.once("connect", () => {
                    console.log("✅ WebSocket connected, now registering captain");
                    console.log("✅ About to call RideServiceWS.registerCaptain with:", user.id);
                    RideServiceWS.registerCaptain(user.id);
                  });
                  
                  // Add error handling for connection
                  socket.once("connect_error", (error) => {
                    console.error("❌ WebSocket connection failed:", error);
                  });
                }
              } else {
                // Disconnect WebSocket and clear state when going offline
                console.log("📤 Going offline - disconnecting WebSocket");
                disconnectSocket();
                
                // Clear state when going offline
                setLastReceivedRideId(null);
                setCompletedRideIds(new Set());
                setRideOfferTimestamps(new Map());
                setIsHandlingRide(false);
                clearRide(); // Clear ride context
                console.log("🧹 Cleared all ride state when going offline");
              }
            }} />
          </View>
          <Pressable
  style={[
    styles.logoutButton,
    { backgroundColor: online ? "#9ca3af" : "#ef4444" } // grey when online
  ]}
  onPress={async () => {
    console.log("🚪 Logout button pressed - online:", online);
    if (online) {
      Alert.alert("Cannot Logout", "Please go offline before logging out.");
      return;
    }
    console.log("🚪 Logging out...");
    await logout();
  }}
  disabled={online} // button disabled when online
>
  <Text style={styles.logoutText}>Logout</Text>
</Pressable>

{online && (
  <Text style={styles.logoutWarning}>
    Please go offline before logging out
  </Text>
)}
        </View>
      </View>

      {!online && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Go Online to receive ride requests</Text>
        </View>
      )}

      {online && phase === "idle" && !isHandlingRide && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Waiting for ride requests via WebSocket...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      

       {/* 🟢 Debug info */}
       {online && (
         <View style={styles.debugInfo}>
           <Text style={styles.debugText}>
             WebSocket Only Mode - No REST API rides
           </Text>
           <Text style={styles.debugText}>
             Loading: {loading ? 'Yes' : 'No'} | Error: {error || 'None'}
           </Text>
           <Text style={styles.debugText}>
             Phase: {phase} | Online: {online ? 'Yes' : 'No'} | WS: {wsConnected ? 'Connected' : 'Disconnected'}
            </Text>
           <Text style={styles.debugText}>
             Current Ride: {currentRide ? `ID: ${currentRide.id}` : 'None'} | Handling: {isHandlingRide ? 'Yes' : 'No'}
           </Text>
           <Text style={styles.debugText}>
             Countdown: {tripStoreCountdown} | Last Ride ID: {lastReceivedRideId || 'None'}
           </Text>
           
        </View>
      )}

      {/* WebSocket-only mode - no manual refresh needed */}


      {/* 🟢 Incoming request modal */}
      <Modal visible={phase === "incoming"} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Ride Request</Text>
            {tripStoreCountdown > 0 && (
              <View style={styles.countdownContainer}>
                <Text style={styles.countdownText}>
                  ⏰ {tripStoreCountdown} seconds remaining
                </Text>
                <View style={styles.countdownBar}>
                  <View 
                    style={[
                      styles.countdownProgress, 
                      { width: `${(tripStoreCountdown / 10) * 100}%` }
                    ]} 
                  />
                </View>
              </View>
            )}
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
                onPress={handleDeclineRide}
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
          
          {/* Clear State Button - Always visible for debugging */}
          <Pressable
            style={[styles.btn, { flex: 1, backgroundColor: "#6b7280" }]}
            onPress={() => {
              console.log("🧹 Clearing all trip store state...");
              clear();
              setLastReceivedRideId(null);
              setIsHandlingRide(false);
              setOriginalRideData(null);
              console.log("🧹 All state cleared!");
            }}
          >
            <Text style={styles.btnText}>🧹 Clear State</Text>
          </Pressable>
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
    zIndex: 1001,
  },
  leftSection: { flex: 1 },
  rightSection: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: "white", fontSize: 18, fontWeight: "700" },
  userName: { color: "white", fontSize: 12, opacity: 0.8 },
  vehicleInfo: { color: "#10b981", fontSize: 10, opacity: 0.9, marginTop: 2 },
  vehicleWarning: { color: "#f59e0b", fontSize: 10, opacity: 0.9, marginTop: 2 },
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
  logoutWarning: {
    color: "#f87171",
    fontSize: 12,
    marginTop: 4,
    textAlign: "right",
  },
  countdownContainer: {
    marginBottom: 16,
    alignItems: "center",
  },
  countdownText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ef4444",
    marginBottom: 8,
  },
  countdownBar: {
    width: "100%",
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  countdownProgress: {
    height: "100%",
    backgroundColor: "#ef4444",
    borderRadius: 3,
  },
  clearStateButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: "center",
  },
  clearStateButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  
 });
