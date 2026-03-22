import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, ArrowRight } from 'lucide-react-native';

const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function BriefComposer({
  draftEmail,
  setDraftEmail,
  errorMessage,
  submitting,
  onSummarize,
}: {
  draftEmail: string;
  setDraftEmail: (text: string) => void;
  errorMessage: string;
  submitting: boolean;
  onSummarize: () => void;
}) {
  return (
    <View style={styles.composerCard}>
      <Text style={styles.sectionEyebrow}>PASTE ANYTHING</Text>
      <Text style={styles.sectionTitle}>Break it into simple steps</Text>
      <Text style={styles.sectionSubtitle}>
        Paste any task, problem, document or idea. Clarix breaks it down into
        clear visual steps instantly.
      </Text>

      <TextInput
        style={styles.emailInput}
        multiline
        value={draftEmail}
        onChangeText={setDraftEmail}
        placeholder={
          "Example:\nI need to launch my app on the Play Store by Friday but don't know where to start."
        }
        placeholderTextColor="#7B8A83"
        textAlignVertical="top"
        returnKeyType="done"
        onSubmitEditing={onSummarize}
        blurOnSubmit={true}
      />

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButtonWrap}
        onPress={onSummarize}
        disabled={submitting}
      >
        <LinearGradient
          colors={['#0F4737', '#216B56']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.primaryButton,
            submitting && styles.primaryButtonDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#F7F3EA" />
          ) : (
            <>
              <Sparkles size={18} color="#F7F3EA" />
              <Text style={styles.primaryButtonText}>Break It Down</Text>
              <ArrowRight size={18} color="#F7F3EA" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  composerCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 28,
    padding: Platform.select({ android: 18, default: 20 }),
    shadowColor: '#17392E',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  sectionEyebrow: {
    color: '#1B5A49',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sectionTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: Platform.select({ android: 28, default: 31 }),
    lineHeight: Platform.select({ android: 33, default: 36 }),
    marginTop: 10,
  },
  sectionSubtitle: {
    color: '#5A6A63',
    fontSize: 15,
    lineHeight: 24,
    marginTop: 10,
  },
  emailInput: {
    backgroundColor: '#F2ECE1',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 16,
    color: '#102D24',
    minHeight: 140,
    marginTop: 22,
  },
  errorBanner: {
    backgroundColor: '#FFE2DC',
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  errorBannerText: {
    color: '#8D2D20',
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButtonWrap: {
    marginTop: 22,
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#F7F3EA',
    fontSize: 16,
    fontWeight: '700',
  },
});
