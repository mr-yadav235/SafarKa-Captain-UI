import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  RefreshControl, 
  Alert 
} from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useRide } from '@/contexts/RideContext';

export default function RideHistoryScreen() {
  const { user } = useAuthStore();
  const { getMyRides, getMyEarnings, loading, error, myRides } = useRide();

  const [earnings, setEarnings] = useState<{ completedTrips: number; totalFare: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRides, setExpandedRides] = useState<Set<number>>(new Set());

  const loadRideHistory = async () => {
    if (!user) return;

    try {
      // Fetch rides - this will update the context's myRides state
      await getMyRides(Number(user.id));

      // Fetch earnings
      const earningsResult = await getMyEarnings(Number(user.id));
      setEarnings(earningsResult);

    } catch (err) {
      console.error('❌ Ride fetch error:', err);
      Alert.alert('Error', 'Failed to load ride history');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRideHistory();
    setRefreshing(false);
  };

  useEffect(() => {
    loadRideHistory();
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#16a34a';
      case 'ongoing': return '#2563eb';
      case 'accepted': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const toggleRideExpansion = (rideId: string | number) => {
    const id = Number(rideId); // ✅ ensure consistent number
    const newExpanded = new Set(expandedRides);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRides(newExpanded);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ride History</Text>
      
      {/* Earnings Summary */}
      {earnings && (
        <View style={styles.earningsCard}>
          <Text style={styles.earningsTitle}>Total Earnings</Text>
          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Completed Trips</Text>
              <Text style={styles.earningsValue}>{earnings.completedTrips}</Text>
            </View>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Total Fare</Text>
              <Text style={styles.earningsValue}>₹{earnings.totalFare}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Ride Statistics Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>📊 Ride Statistics</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Rides</Text>
            <Text style={styles.summaryValue}>{myRides.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Completed</Text>
            <Text style={styles.summaryValue}>{myRides.filter(r => r.status === 'completed').length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Cancelled</Text>
            <Text style={styles.summaryValue}>{myRides.filter(r => r.status === 'cancelled').length}</Text>
          </View>
        </View>
      </View>

      {/* Ride History List */}
      <ScrollView 
        style={styles.ridesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && myRides.length === 0 ? (
          <Text style={styles.loadingText}>Loading ride history...</Text>
        ) : myRides.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No rides found</Text>
            <Text style={styles.emptySubtext}>Your completed rides will appear here</Text>
          </View>
        ) : (
          myRides.map((ride) => {
            const id = Number(ride.id);
            const isExpanded = expandedRides.has(id);
            return (
              <View key={id} style={styles.rideCard}>
                {/* Header with Ride ID and Status */}
                <Pressable 
                  style={styles.rideHeader}
                  onPress={() => toggleRideExpansion(id)}
                >
                  <View style={styles.rideHeaderContent}>
                    <Text style={styles.rideId}>Ride #{id}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
                      <Text style={styles.statusText}>{ride.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                </Pressable>
                
                {/* Always visible info */}
                <View style={styles.basicInfo}>
                  <View style={styles.locationRow}>
                    <Text style={styles.locationIcon}>🚗</Text>
                    <Text style={styles.locationText}>{ride.pickup}</Text>
                  </View>
                  <View style={styles.locationRow}>
                    <Text style={styles.locationIcon}>🎯</Text>
                    <Text style={styles.locationText}>{ride.dropoff}</Text>
                  </View>
                  <View style={styles.rideFooter}>
                    <Text style={styles.fareText}>₹{ride.fare}</Text>
                    <Text style={styles.dateText}>{formatDate(ride.created_at)}</Text>
                  </View>
                </View>

                {/* Expanded info */}
                {isExpanded && (
                  <View style={styles.detailedInfo}>
                    {ride.customer && (
                      <View style={styles.customerSection}>
                        <Text style={styles.sectionTitle}>👤 Customer Details</Text>
                        <View style={styles.customerInfo}>
                          <Text style={styles.customerName}>{ride.customer.name}</Text>
                          {ride.customer.phone_number && (
                            <Text style={styles.customerPhone}>📞 {ride.customer.phone_number}</Text>
                          )}
                        </View>
                      </View>
                    )}

                    <View style={styles.rideDetails}>
                      <Text style={styles.sectionTitle}>📍 Trip Details</Text>
                      <View style={styles.locationRow}>
                        <Text style={styles.locationIcon}>🚗</Text>
                        <Text style={styles.locationText}>{ride.pickup}</Text>
                      </View>
                      <View style={styles.locationRow}>
                        <Text style={styles.locationIcon}>🎯</Text>
                        <Text style={styles.locationText}>{ride.dropoff}</Text>
                      </View>
                    </View>

                    <View style={styles.fareSection}>
                      <Text style={styles.sectionTitle}>💰 Payment Details</Text>
                      <Text style={styles.fareAmount}>₹{ride.fare}</Text>
                    </View>

                    <View style={styles.timestampsSection}>
                      <Text style={styles.sectionTitle}>⏰ Timeline</Text>
                      <Text style={styles.timestampValue}>Requested: {formatDate(ride.created_at)}</Text>
                      {ride.started_at && <Text style={styles.timestampValue}>Started: {formatDate(ride.started_at)}</Text>}
                      {ride.ended_at && <Text style={styles.timestampValue}>Completed: {formatDate(ride.ended_at)}</Text>}
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16, paddingHorizontal: 16, paddingTop: 16, color: '#1f2937' },
  earningsCard: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12, elevation: 3 },
  earningsTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#1f2937' },
  earningsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  earningsItem: { alignItems: 'center' },
  earningsLabel: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  earningsValue: { fontSize: 20, fontWeight: '700', color: '#16a34a' },
  ridesList: { flex: 1, paddingHorizontal: 16 },
  loadingText: { textAlign: 'center', marginTop: 32, fontSize: 16, color: '#6b7280' },
  emptyState: { alignItems: 'center', marginTop: 64 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6b7280', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#9ca3af' },
  rideCard: { backgroundColor: 'white', marginBottom: 12, padding: 16, borderRadius: 12, elevation: 2 },
  rideHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rideHeaderContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rideId: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '600', color: 'white' },
  expandIcon: { fontSize: 16, color: '#6b7280', marginLeft: 8 },
  basicInfo: { marginBottom: 8 },
  detailedInfo: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  locationIcon: { marginRight: 8 },
  locationText: { fontSize: 14, color: '#374151' },
  rideFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareText: { fontSize: 18, fontWeight: '700', color: '#16a34a' },
  dateText: { fontSize: 12, color: '#9ca3af' },
  customerSection: { marginBottom: 12 },
  customerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customerName: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
   customerPhone: { fontSize: 14, color: '#6b7280' },
   sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#374151' },
   rideDetails: { marginBottom: 12 },
   fareSection: { marginBottom: 12 },
  fareAmount: { fontSize: 20, fontWeight: '700', color: '#16a34a' },
  timestampsSection: { marginBottom: 12 },
  timestampValue: { fontSize: 13, color: '#374151', marginBottom: 4 },
  summaryCard: { 
    backgroundColor: 'white', 
    marginHorizontal: 16, 
    marginBottom: 16, 
    padding: 16, 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1f2937',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3b82f6',
  }
});
