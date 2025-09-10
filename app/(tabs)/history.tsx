import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRide } from '@/contexts/RideContext';
import { useAuthStore } from '@/store/authStore';

interface RideHistoryItemProps {
  ride: any;
  onPress: () => void;
}

const RideHistoryItem: React.FC<RideHistoryItemProps> = ({ ride, onPress }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#16a34a';
      case 'cancelled': return '#ef4444';
      case 'ongoing': return '#2563eb';
      case 'accepted': return '#f59e0b';
      case 'pending': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Pressable style={styles.rideItem} onPress={onPress}>
      <View style={styles.rideHeader}>
        <Text style={styles.rideId}>Ride #{ride.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) }]}>
          <Text style={styles.statusText}>{ride.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.rideDetails}>
        <Text style={styles.pickupText}>📍 {ride.pickup}</Text>
        <Text style={styles.dropoffText}>🎯 {ride.dropoff}</Text>
        
        {ride.customer && (
          <Text style={styles.customerText}>👤 {ride.customer.name}</Text>
        )}
        
        <View style={styles.rideFooter}>
          <Text style={styles.fareText}>💰 ₹{ride.fare}</Text>
          <Text style={styles.dateText}>{formatDate(ride.created_at)}</Text>
        </View>
      </View>
    </Pressable>
  );
};

export default function HistoryScreen() {
  const { rideHistory, historyPagination, loading, error, getRideHistory } = useRide();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();

  const statusFilters = [
    { label: 'All', value: undefined },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Ongoing', value: 'ongoing' },
    { label: 'Accepted', value: 'accepted' },
    { label: 'Pending', value: 'pending' },
  ];

  useEffect(() => {
    console.log('History useEffect triggered - user:', user?.id, 'selectedStatus:', selectedStatus);
    if (user?.id) {
      loadRideHistory();
    }
  }, [user?.id, selectedStatus]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log('History state updated - rideHistory length:', rideHistory.length, 'loading:', loading, 'error:', error);
    console.log('History pagination:', historyPagination);
  }, [rideHistory, loading, error, historyPagination]);

  const loadRideHistory = async (page = 1) => {
    if (user?.id) {
      console.log('Loading ride history for captain:', user.id, 'page:', page, 'status:', selectedStatus);
      try {
        await getRideHistory(page, 20, selectedStatus);
        setCurrentPage(page);
        console.log('Ride history loaded successfully');
      } catch (error) {
        console.error('Error loading ride history:', error);
      }
    } else {
      console.log('No user ID found, cannot load ride history');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRideHistory(1);
    setRefreshing(false);
  };

  const loadMore = () => {
    if (historyPagination.page < historyPagination.pages && !loading) {
      loadRideHistory(currentPage + 1);
    }
  };

  const handleRidePress = (ride: any) => {
    Alert.alert(
      'Ride Details',
      `Ride #${ride.id}\n\nFrom: ${ride.pickup}\nTo: ${ride.dropoff}\nStatus: ${ride.status}\nFare: ₹${ride.fare}\n\nCustomer: ${ride.customer?.name || 'N/A'}\nCreated: ${new Date(ride.created_at).toLocaleString()}`,
      [{ text: 'OK' }]
    );
  };

  const renderRideItem = ({ item }: { item: any }) => (
    <RideHistoryItem ride={item} onPress={() => handleRidePress(item)} />
  );

  const renderStatusFilter = ({ item }: { item: any }) => (
    <Pressable
      style={[
        styles.filterButton,
        selectedStatus === item.value && styles.filterButtonActive
      ]}
      onPress={() => setSelectedStatus(item.value)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedStatus === item.value && styles.filterButtonTextActive
      ]}>
        {item.label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ride History</Text>
        <Text style={styles.subtitle}>
          {historyPagination.total ? `${historyPagination.total} total rides` : 'No rides yet'}
        </Text>
      </View>

      {/* Status Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={statusFilters}
          renderItem={renderStatusFilter}
          keyExtractor={(item) => item.value || 'all'}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Rides List */}
      <FlatList
        data={rideHistory}
        renderItem={renderRideItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading rides...' : 'No rides found'}
            </Text>
            {!loading && (
              <Text style={styles.emptySubtext}>
                Your ride history will appear here once you complete some rides
              </Text>
            )}
          </View>
        }
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: 'white',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  filtersContainer: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filtersList: {
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    margin: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  rideItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  rideDetails: {
    gap: 8,
  },
  pickupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  dropoffText: {
    fontSize: 14,
    color: '#6b7280',
  },
  customerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  fareText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16a34a',
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
});
