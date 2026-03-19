import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, CheckCheck, Clock3 } from 'lucide-react-native';

const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function BriefsHero({
  briefsCount,
  activeTasksCount,
  finishedTasksCount,
}: {
  briefsCount: number;
  activeTasksCount: number;
  finishedTasksCount: number;
}) {
  const heroEntrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(heroEntrance, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [heroEntrance]);

  return (
    <Animated.View
      style={[
        styles.heroWrap,
        {
          opacity: heroEntrance,
          transform: [
            {
               translateY: heroEntrance.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={['#103B31', '#1C6A57', '#D7B989']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.eyebrow}>ANY TASK TO ACTION</Text>
        <Text style={styles.heroTitle}>Clarix</Text>
        <Text style={styles.heroSubtitle}>
          Turn any problem into a clear step by step plan
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Sparkles size={15} color="#103B31" />
            <Text style={styles.heroStatText}>{briefsCount} briefs</Text>
          </View>
          <View style={styles.heroStatPill}>
            <CheckCheck size={15} color="#103B31" />
            <Text style={styles.heroStatText}>{activeTasksCount} active</Text>
          </View>
          <View style={styles.heroStatPill}>
            <Clock3 size={15} color="#103B31" />
            <Text style={styles.heroStatText}>{finishedTasksCount} finished</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { borderRadius: 30 },
  heroCard: {
    borderRadius: 30,
    padding: Platform.select({ android: 22, default: 24 }),
    minHeight: Platform.select({ android: 208, default: 220 }),
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#F7F3EA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  heroTitle: {
    color: '#F7F3EA',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 36, default: 40 }),
    lineHeight: Platform.select({ android: 40, default: 44 }),
    marginTop: 8,
  },
  heroSubtitle: {
    color: '#E5DDD1',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: '92%',
  },
  heroStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
  heroStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F6D8AB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroStatText: {
    color: '#103B31',
    fontSize: 12,
    fontWeight: '700',
  },
});
