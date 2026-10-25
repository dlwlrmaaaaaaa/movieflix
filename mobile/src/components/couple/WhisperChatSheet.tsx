import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, typography, spacing } from '../../theme';
import { useRoom } from '../../context/RoomContext';
import { useAuth } from '../../context/AuthContext';
import { Send, X } from 'lucide-react-native';

interface WhisperChatSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function WhisperChatSheet({ visible, onClose }: WhisperChatSheetProps) {
  const { chatMessages, sendChatMessage } = useRoom();
  const { user } = useAuth();
  const [inputText, setInputText] = useState<string>('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendChatMessage(inputText);
    setInputText('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Movie Whisper Chat</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Message List */}
          <FlatList
            data={chatMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isMe = item.senderId === user?.id;
              return (
                <View style={[styles.bubbleWrapper, isMe ? styles.myWrapper : styles.partnerWrapper]}>
                  <View style={[styles.bubble, isMe ? styles.myBubble : styles.partnerBubble]}>
                    <Text style={styles.senderText}>{item.senderName}</Text>
                    <Text style={styles.messageText}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Whisper something to your partner... 💬</Text>
              </View>
            }
          />

          {/* Input Bar */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Send a whisper..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim()}
            >
              <Send size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: spacing.radius.xl,
    borderTopRightRadius: spacing.radius.xl,
    maxHeight: '65%',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  listContent: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  bubbleWrapper: {
    flexDirection: 'row',
  },
  myWrapper: {
    justifyContent: 'flex-end',
  },
  partnerWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: spacing.radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  partnerBubble: {
    backgroundColor: colors.surfaceHighlight,
    borderBottomLeftRadius: 4,
  },
  senderText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  messageText: {
    fontSize: typography.size.sm,
    color: colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.md,
    height: 48,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textInput: {
    flex: 1,
    color: colors.text,
    fontSize: typography.size.sm,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
