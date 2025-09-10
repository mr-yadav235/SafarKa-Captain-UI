import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone_number, setPhone_number] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const { register: registerApi, loading: authLoading } = useAuthStore();

  const onRegister = async () => {
    if (!name || !phone_number || !password || !vehicleType || !licenseNumber || !email) {
      return Alert.alert('Missing fields', 'Fill all required fields');
    }
    try {
      setLoading(true);
      await registerApi({
        name,
        phone_number,
        email,
        password,
        vehicle_number: vehicleNumber,
        vehicle_type: vehicleType,
        license_number: licenseNumber,
      });

      Alert.alert('Success', 'Registered successfully!', [
        {
          text: 'OK',
          onPress: () => router.replace('/auth/login'),
        },
      ]);
    } catch (e: any) {
      console.error('Register error:', e);
      Alert.alert('Registration failed', e?.response?.data?.message || e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Captain Register</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Full Name" style={styles.input} />
      <TextInput value={phone_number} onChangeText={setPhone_number} placeholder="Phone" keyboardType="phone-pad" style={styles.input} />
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />
      <TextInput value={vehicleNumber} onChangeText={setVehicleNumber} placeholder="Vehicle Number" style={styles.input} />
      <TextInput value={vehicleType} onChangeText={setVehicleType} placeholder="Vehicle Type (bike/auto/car)" style={styles.input} />
      <TextInput value={licenseNumber} onChangeText={setLicenseNumber} placeholder="License Number" style={styles.input} />
      <Pressable style={styles.button} onPress={onRegister} disabled={loading || authLoading}>
        <Text style={styles.buttonText}>{loading || authLoading ? 'Creating…' : 'Create account'}</Text>
      </Pressable>
      <Text style={{ marginTop: 12 }}>
        Have an account? <Link href="/auth/login">Login</Link>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  button: { backgroundColor: '#16a34a', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700' },
});
