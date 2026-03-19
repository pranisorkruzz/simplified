import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function TasksHero({
  activeCount,
  finishedCount,
  totalCount,
  completionRate,
}: {
  activeCount: number;
  finishedCount: number;
  totalCount: number;
  completionRate: number;
}) {
  return (
    <>
      <LinearGradient
        colors={['#103B31', '#1D5A49', '#CDB086']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>TASK BOARD</Text>
        <Text style={styles.heroTitle}>From brief to done</Text>
        <Text style={styles.heroSubtitle}>
          Each task shows when it was added, when it is due, and how much time is
          left.
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{activeCount}</Text>
            <Text style={styles.heroStatLabel}>Active</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{finishedCount}</Text>
            <Text style={styles.heroStatLabel}>Finished</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNumber}>{completionRate}%</Text>
            <Text style={styles.heroStatLabel}>Complete</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.progressShell}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(completionRate, totalCount ? 8 : 0)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {totalCount === 0
            ? 'No tasks yet'
            : `${finishedCount} of ${totalCount} tasks closed`}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 30,
    padding: Platform.select({ android: 22, default: 24 }),
  },
  heroEyebrow: {
    color: '#F7F3EA',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heroTitle: {
    color: '#F7F3EA',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 35, default: 39 }),
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
    gap: 10,
    marginTop: 24,
  },
  heroStat: {
    flex: 1,
    backgroundColor: 'rgba(247, 243, 234, 0.16)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  heroStatNumber: {
    color: '#F7F3EA',
    fontSize: 24,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: '#E5DDD1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  progressShell: {
    backgroundColor: '#FBF8F2',
    borderRadius: 22,
    padding: 16,
    marginTop: 18, // Added margin since it was separated in the view.
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#E6DDD0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1D6D58',
    borderRadius: 999,
  },
  progressLabel: {
    marginTop: 10,
    color: '#52635B',
    fontSize: 13,
    fontWeight: '600',
  },
});
