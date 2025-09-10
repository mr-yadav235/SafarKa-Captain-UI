import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const [phone_number, setPhone_number] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, loading: authLoading } = useAuthStore();

  const onLogin = async () => {
    if (!phone_number || !password) return Alert.alert('Missing fields', 'Enter phone and password');
    try {
      setLoading(true);
      await login(phone_number, password);
    } catch (e: any) {
      console.error('Login error:', e);
      Alert.alert('Login failed', e?.response?.data?.message || e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Captain Login</Text>
      <TextInput
        value={phone_number}
        onChangeText={setPhone_number}
        placeholder="phone_number"
        keyboardType="phone-pad"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />
      <Pressable style={styles.button} onPress={onLogin} disabled={loading || authLoading}>
        <Text style={styles.buttonText}>{loading || authLoading ? 'Logging in…' : 'Login'}</Text>
      </Pressable>
      <Pressable 
        style={[styles.button, { backgroundColor: '#16a34a', marginTop: 8 }]} 
        onPress={() => {
          // Test routing by manually setting user
          useAuthStore.setState({ 
            user: { id: 'test', name: 'Test User', phone: '1234567890' }, 
            token: 'test-token' 
          });
        }}
      >
        <Text style={styles.buttonText}>Test Route (Debug)</Text>
      </Pressable>
      <Text style={{ marginTop: 12 }}>
        No account? <Link href="/auth/register">Register</Link>
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
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700' },
});


