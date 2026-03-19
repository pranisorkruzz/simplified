import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function DeadlineModal({
  visible,
  deadlineInput,
  setDeadlineInput,
  deadlineError,
  savingDeadline,
  onClose,
  onClear,
  onSave,
}: {
  visible: boolean;
  deadlineInput: string;
  setDeadlineInput: (text: string) => void;
  deadlineError: string;
  savingDeadline: boolean;
  onClose: () => void;
  onClear: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalEyebrow}>MANUAL DEADLINE</Text>
          <Text style={styles.modalTitle}>Add or edit a deadline</Text>
          <Text style={styles.modalCopy}>
            Use `YYYY-MM-DD` or `YYYY-MM-DD HH:mm`. Leaving it blank removes the
            deadline.
          </Text>

          <TextInput
            style={styles.modalInput}
            value={deadlineInput}
            onChangeText={setDeadlineInput}
            placeholder="2026-03-19 10:00"
            placeholderTextColor="#7B8A83"
            autoCapitalize="none"
          />

          {deadlineError ? (
            <View style={styles.modalError}>
              <Text style={styles.modalErrorText}>{deadlineError}</Text>
            </View>
          ) : null}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalSecondary} onPress={onClose}>
              <Text style={styles.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondary}
              onPress={onClear}
              disabled={savingDeadline}
            >
              <Text style={styles.modalSecondaryText}>Clear</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={onSave}
              disabled={savingDeadline}
            >
              {savingDeadline ? (
                <ActivityIndicator size="small" color="#F7F3EA" />
              ) : (
                <Text style={styles.modalPrimaryText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 45, 36, 0.34)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    backgroundColor: '#FBF8F2',
    borderRadius: 28,
    padding: Platform.select({ android: 20, default: 22 }),
  },
  modalEyebrow: {
    color: '#1B5A49',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  modalTitle: {
    color: '#102D24',
    fontFamily: DISPLAY_FONT,
    fontSize: 28,
    marginTop: 10,
  },
  modalCopy: {
    color: '#5A6A63',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  modalInput: {
    marginTop: 18,
    backgroundColor: '#F2ECE1',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#102D24',
  },
  modalError: {
    marginTop: 12,
    backgroundColor: '#FFE2DC',
    borderRadius: 14,
    padding: 12,
  },
  modalErrorText: {
    color: '#8D2D20',
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  modalSecondary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#E8E1D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: '#163D32',
    fontSize: 13,
    fontWeight: '700',
  },
  modalPrimary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#102D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    color: '#F7F3EA',
    fontSize: 13,
    fontWeight: '700',
  },
});
