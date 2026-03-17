/**
 * src/components/audio/AudioPlayer.tsx
 *
 * Plays back a saved audio recording using expo-av.
 * Shows a play/pause button and current position.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../constants/theme';
import { formatDuration } from '../../utils/date';

interface Props {
  /** URI of the audio file (file:// path on native, blob: on web). */
  uri: string;
  /** Duration in seconds (shown before playback starts, then overridden by AVPlayer). */
  durationSeconds?: number;
  compact?: boolean; // Smaller version for list items
}

export function AudioPlayer({ uri, durationSeconds, compact }: Props): React.JSX.Element {
  const soundRef = useRef<Audio.Sound | null>(null);

  const [isPlaying,   setIsPlaying]   = useState(false);
  const [positionMs,  setPositionMs]  = useState(0);
  const [durationMs,  setDurationMs]  = useState((durationSeconds ?? 0) * 1000);
  const [isLoaded,    setIsLoaded]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Load sound on mount
  useEffect(() => {
    let sound: Audio.Sound;

    (async () => {
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );
        sound = s;
        soundRef.current = s;
        setIsLoaded(true);
      } catch (e) {
        setError('Failed to load audio.');
        console.warn('[AudioPlayer]', e);
      }
    })();

    return () => {
      sound?.unloadAsync();
    };
  }, [uri]);  // eslint-disable-line react-hooks/exhaustive-deps

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis);
    if (status.durationMillis) setDurationMs(status.durationMillis);

    // Reset to start when finished
    if (status.didJustFinish) {
      soundRef.current?.setPositionAsync(0);
      setPositionMs(0);
      setIsPlaying(false);
    }
  }, []);

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  }, [isPlaying, isLoaded]);

  if (error) {
    return (
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle-outline" size={14} color={Colors.danger} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const progressPercent = durationMs > 0 ? positionMs / durationMs : 0;

  if (compact) {
    return (
      <Pressable onPress={togglePlayback} style={styles.compactRow} disabled={!isLoaded}>
        <Ionicons
          name={isPlaying ? 'pause-circle' : 'play-circle'}
          size={22}
          color={isLoaded ? Colors.gold : Colors.textMuted}
        />
        <Text style={styles.compactTime}>
          {formatDuration(positionMs)} / {formatDuration(durationMs)}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={togglePlayback} disabled={!isLoaded} style={styles.playBtn}>
        <Ionicons
          name={isPlaying ? 'pause-circle' : 'play-circle'}
          size={44}
          color={isLoaded ? Colors.gold : Colors.textMuted}
        />
      </Pressable>

      <View style={styles.trackInfo}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatDuration(positionMs)}</Text>
          <Text style={styles.timeText}>{formatDuration(durationMs)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
  } as ViewStyle,
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  trackInfo: {
    flex: 1,
  } as ViewStyle,
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  } as ViewStyle,
  progressFill: {
    height: 4,
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
  } as ViewStyle,
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xxs,
  } as ViewStyle,
  timeText: {
    fontSize: Typography.size.xs,
    color: Colors.textMuted,
  } as TextStyle,

  // Compact variant
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  } as ViewStyle,
  compactTime: {
    fontSize: Typography.size.xs,
    color: Colors.textSecondary,
  } as TextStyle,

  // Error state
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  } as ViewStyle,
  errorText: {
    fontSize: Typography.size.sm,
    color: Colors.danger,
  } as TextStyle,
});
