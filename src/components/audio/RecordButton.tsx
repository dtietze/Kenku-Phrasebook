/**
 * src/components/audio/RecordButton.tsx
 *
 * Large animated record/stop button for the Capture screen.
 * Pulses with a glowing ring while recording is active.
 */

import React, { useEffect, useRef } from 'react';
import {
  Pressable,
  Animated,
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { RecordingStatus } from '../../types';

interface Props {
  status:   RecordingStatus;
  onPress:  () => void;
  disabled?: boolean;
}

const BUTTON_SIZE = 80;
const RING_SIZE   = BUTTON_SIZE + 24;

export function RecordButton({ status, onPress, disabled }: Props): React.JSX.Element {
  const isRecording = status === 'recording';
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  // Pulsing animation while recording
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      return undefined;
    }
  }, [isRecording, pulseAnim]);

  return (
    <View style={styles.wrapper}>
      {/* Animated outer ring (visible only while recording) */}
      {isRecording && (
        <Animated.View
          style={[
            styles.ring,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      )}

      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          isRecording ? styles.buttonRecording : styles.buttonIdle,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
        accessibilityRole="button"
      >
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={36}
          color="#fff"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: RING_SIZE,
    height: RING_SIZE,
  } as ViewStyle,
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.danger + '88',
    backgroundColor: Colors.danger + '15',
  } as ViewStyle,
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  buttonIdle: {
    backgroundColor: Colors.gold,
  } as ViewStyle,
  buttonRecording: {
    backgroundColor: Colors.danger,
  } as ViewStyle,
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  } as ViewStyle,
  disabled: {
    opacity: 0.4,
  } as ViewStyle,
});
