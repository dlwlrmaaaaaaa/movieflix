import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { SocketProvider } from '../src/context/SocketContext';
import { RoomProvider } from '../src/context/RoomContext';
import { PlaybackSyncProvider } from '../src/context/PlaybackSyncContext';
import { CallProvider } from '../src/context/CallContext';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider style={{ backgroundColor: colors.background }}>
      <StatusBar style="light" backgroundColor={colors.background} />
      <AuthProvider>
        <SocketProvider>
          <RoomProvider>
            <PlaybackSyncProvider>
              <CallProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'fade',
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)/login" />
                  <Stack.Screen name="(auth)/register" />
                  <Stack.Screen name="(main)/home" />
                  <Stack.Screen name="(main)/profile" />
                  <Stack.Screen name="(main)/history" />
                  <Stack.Screen name="room/[code]/index" />
                  <Stack.Screen name="room/[code]/player" />
                </Stack>
              </CallProvider>
            </PlaybackSyncProvider>
          </RoomProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
