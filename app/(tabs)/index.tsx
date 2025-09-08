import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function HomeScreen() {
  const [online, setOnline] = useState(false);
  const [region, setRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const current = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  return (
    <View style={styles.container}>
      {region && (
        <MapView style={StyleSheet.absoluteFill} initialRegion={region}>
          <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }} />
        </MapView>
      )}
      <View style={styles.topBar}>
        <Text style={styles.title}>Captain</Text>
        <View style={styles.row}>
          <Text style={{ color: online ? '#16a34a' : '#ef4444', fontWeight: '600', marginRight: 8 }}>
            {online ? 'Online' : 'Offline'}
          </Text>
          <Switch value={online} onValueChange={setOnline} />
        </View>
      </View>
      {!online && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Go Online to receive ride requests</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: 'white', fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  overlayText: { color: 'white', fontWeight: '600' },
});
