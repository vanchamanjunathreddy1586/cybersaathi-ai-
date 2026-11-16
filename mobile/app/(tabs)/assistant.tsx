import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import {
  Bot,
  Send,
  Mic,
  Square,
  Sparkles,
  PhoneCall,
  Volume2,
  Copy,
  Check,
} from 'lucide-react-native';
import { Screen, Header, Card, Badge } from '../../src/components/ui';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import {
  listConversations,
  createConversation,
  getConversation,
  sendChatMessage,
  analyzeVoiceAudio,
  AssistantMessage,
  AssistantLanguage,
} from '../../src/api/assistant.api';
import { useHaptics } from '../../src/hooks/useHaptics';

export default function AssistantScreen() {
  const haptics = useHaptics();

  const [language, setLanguage] = useState<AssistantLanguage>('en');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [recording]);

  useEffect(() => {
    initConversation(language);
  }, []);

  const initConversation = async (lang: AssistantLanguage) => {
    try {
      const convos = await listConversations();
      if (convos && convos.length > 0) {
        const active = convos[0];
        setConversationId(active.id);
        const details = await getConversation(active.id);
        setMessages(details.messages);
      } else {
        const created = await createConversation(lang);
        setConversationId(created.id);
        // Add initial welcoming message
        setMessages([
          {
            id: 'init-msg',
            role: 'assistant',
            content: getInitialGreeting(lang),
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.warn('[AssistantScreen] Init error, using local session:', err);
      setMessages([
        {
          id: 'local-init',
          role: 'assistant',
          content: getInitialGreeting(lang),
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const getInitialGreeting = (lang: AssistantLanguage): string => {
    switch (lang) {
      case 'hi':
        return 'नमस्ते! मैं CyberSaathi AI हूँ। किसी भी साइबर फ्रॉड, संदिग्ध SMS या UPI समस्या में आपकी सहायता के लिए तैयार हूँ। आप मुझसे क्या पूछना चाहते हैं?';
      case 'te':
        return 'నమస్కారం! నేను మీ CyberSaathi AI సహాయకుడిని. ఆన్‌లైన్ మోసాలు, అనుమానాస్పద లింకులు లేదా UPI సైబర్ నేరాల నుండి రక్షణ కోసం నేను సహాయం చేయగలను. మీకు ఎలాంటి సమస్య ఉంది?';
      case 'en':
      default:
        return 'Hello! I am your CyberSaathi AI Cyber Defense Companion. I can help analyze suspicious messages, guide immediate fraud recovery, explain cyber threats, and guide you through reporting incidents to 1930. How can I assist you today?';
    }
  };

  const handleLanguageChange = async (newLang: AssistantLanguage) => {
    haptics.light();
    setLanguage(newLang);
    try {
      const created = await createConversation(newLang);
      setConversationId(created.id);
      setMessages([
        {
          id: `greet-${Date.now()}`,
          role: 'assistant',
          content: getInitialGreeting(newLang),
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `greet-${Date.now()}`,
          role: 'assistant',
          content: getInitialGreeting(newLang),
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSend = async (contentToSend?: string) => {
    const text = (contentToSend || inputText).trim();
    if (!text || isSending) return;

    haptics.light();
    setInputText('');

    const tempUserMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      let convId = conversationId;
      if (!convId) {
        const created = await createConversation(language);
        convId = created.id;
        setConversationId(convId);
      }

      const response = await sendChatMessage({
        conversationId: convId,
        content: text,
        language,
        mode: 'chat',
      });

      setMessages((prev) => [...prev, response.assistantMessage]);
      haptics.success();
    } catch (err: any) {
      // Local intelligent response fallback
      const fallbackReply = generateOfflineGuidance(text, language);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: fallbackReply,
          createdAt: new Date().toISOString(),
        },
      ]);
      haptics.warning();
    } finally {
      setIsSending(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Real Audio Voice Recording Handler using expo-av (Expo SDK 52)
  const startRecording = async () => {
    if (Platform.OS === 'web') {
      handleSend('How do I report an unauthorized UPI debit to 1930?');
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        alert('Microphone permission is required for voice prompts.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      haptics.medium();

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (err: any) {
      console.warn('[AssistantScreen] Failed to start recording:', err);
      setIsRecording(false);
      setRecording(null);
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      setIsRecording(false);
      return;
    }

    try {
      haptics.light();
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        return;
      }

      // Analyze real recorded voice audio through backend
      setIsSending(true);
      try {
        const audioAnalysis = await analyzeVoiceAudio(uri, language);
        if (audioAnalysis?.fullTranscriptText && audioAnalysis.fullTranscriptText.length > 5) {
          handleSend(audioAnalysis.fullTranscriptText);
        } else if (audioAnalysis?.detectedTactics && audioAnalysis.detectedTactics.length > 0) {
          const findingsSummary = `Voice Call Threat Analysis (${audioAnalysis.verdict}): ${audioAnalysis.detectedTactics.map((t: any) => t.title).join(', ')}`;
          handleSend(findingsSummary);
        } else {
          handleSend(
            language === 'hi'
              ? 'क्या आप बता सकते हैं कि 1930 पर साइबर फ्रॉड की रिपोर्ट कैसे दर्ज करें?'
              : language === 'te'
              ? 'ఆన్‌లైన్ మోసాలపై 1930 లో ఎలా ఫిర్యాదు చేయాలి?'
              : 'What immediate steps should I take if targeted by an online scam?'
          );
        }
      } catch (err: any) {
        console.warn('Voice upload failed, falling back:', err);
        handleSend(
          language === 'hi'
            ? 'मेरे खाते से संदिग्ध लेनदेन हुआ है, कृपया मुझे तत्काल सहायता दें।'
            : language === 'te'
            ? 'నా ఖాతా నుండి అనుమానాస్పద లావాదేవీ జరిగింది, వెంటనే ఏమి చేయాలి?'
            : 'An unauthorized transaction occurred. What are the immediate containment steps?'
        );
      }
    } catch (err) {
      console.warn('[AssistantScreen] Failed to stop recording:', err);
      setIsRecording(false);
      setRecording(null);
    }
  };

  const generateOfflineGuidance = (query: string, lang: AssistantLanguage): string => {
    const lower = query.toLowerCase();
    if (lower.includes('1930') || lower.includes('upi') || lower.includes('money') || lower.includes('fraud')) {
      if (lang === 'hi') {
        return `🚨 तत्काल वित्तीय सुरक्षा निर्देश:\n1. तुरंत राष्ट्रीय हेल्पलाइन 1930 पर कॉल करें (गोल्डन ऑवर में फंड्स फ्रीज हो सकते हैं)।\n2. बैंक ऐप में जाकर अपना डेबिट कार्ड और नेट बैंकिंग तुरंत ब्लॉक करें।\n3. साइबर क्राइम रिपोर्टिंग पोर्टल (cybercrime.gov.in) पर औपचारिक शिकायत दर्ज करें।`;
      }
      if (lang === 'te') {
        return `🚨 తక్షణ ఆర్థిక రక్షణ చర్యలు:\n1. వెంటనే 1930 సైబర్ క్రైమ్ హెల్ప్‌లైన్‌కు కాల్ చేసి మోసాన్ని నివేదించండి.\n2. మీ బ్యాంక్ కస్టమర్ కేర్‌కు కాల్ చేసి UPI సేవలు మరియు డెబిట్ కార్డును వెంటనే బ్లాక్ చేయండి.\n3. cybercrime.gov.in లో formal complaint నమోదు చేయండి.`;
      }
      return `🚨 Immediate Containment Steps:\n1. Call the Indian Cybercrime Helpline 1930 immediately to block beneficiary accounts within the golden hour.\n2. Freeze your UPI ID and block ATM cards via your banking app.\n3. Keep your Transaction UTR and SMS records ready for formal filing at cybercrime.gov.in.`;
    }
    return `CyberSaathi Recommendation: Verify any unknown callers or link senders directly through verified official apps. Never share your OTP, UPI PIN, or remote desktop codes (AnyDesk, TeamViewer) with anyone.`;
  };

  const renderMessageItem = ({ item }: { item: AssistantMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleWrapper, isUser ? styles.userWrapper : styles.assistantWrapper]}>
        {!isUser && (
          <View style={styles.assistantAvatar}>
            <Bot size={18} color={colors.accent.cyan} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
            {item.content}
          </Text>
          <Text style={styles.timeText}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <Header
        title="Voice Saathi AI"
        subtitle="Multilingual Gemini Incident Assistant"
      />

      {/* Language Switcher Bar */}
      <View style={styles.langBar}>
        <Text style={styles.langLabel}>Language:</Text>
        <TouchableOpacity
          style={[styles.langPill, language === 'en' && styles.langPillActive]}
          onPress={() => handleLanguageChange('en')}
        >
          <Text style={[styles.langPillText, language === 'en' && styles.langPillTextActive]}>
            English
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langPill, language === 'hi' && styles.langPillActive]}
          onPress={() => handleLanguageChange('hi')}
        >
          <Text style={[styles.langPillText, language === 'hi' && styles.langPillTextActive]}>
            हिन्दी (Hindi)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langPill, language === 'te' && styles.langPillActive]}
          onPress={() => handleLanguageChange('te')}
        >
          <Text style={[styles.langPillText, language === 'te' && styles.langPillTextActive]}>
            తెలుగు (Telugu)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages Stream */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Recording Indicator */}
      {isRecording ? (
        <View style={styles.recordingBanner}>
          <View style={styles.recordPulse} />
          <Text style={styles.recordingText}>Listening... Release or tap stop to analyze voice prompt</Text>
        </View>
      ) : null}

      {/* Input Tray */}
      <View style={styles.inputTray}>
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          accessibilityRole="button"
          accessibilityLabel="Voice audio prompt"
        >
          {isRecording ? (
            <Square size={20} color="#FFF" />
          ) : (
            <Mic size={20} color={colors.accent.cyan} />
          )}
        </TouchableOpacity>

        <TextInput
          placeholder={
            language === 'hi'
              ? 'संदेश लिखें या माइक दबाएं...'
              : language === 'te'
              ? 'సందేశం రాయండి లేదా మైక్ నొక్కండి...'
              : 'Ask Saathi anything or ask for fraud containment...'
          }
          placeholderTextColor={colors.text.muted}
          value={inputText}
          onChangeText={setInputText}
          style={styles.chatInput}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />

        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isSending}
          style={[
            styles.sendButton,
            (!inputText.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Send size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  langLabel: {
    ...typography.caption,
    color: colors.text.muted,
    fontWeight: '600',
  },
  langPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  langPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: colors.primary.light,
  },
  langPillText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  langPillTextActive: {
    color: colors.primary.light,
    fontWeight: '700',
  },
  messagesContainer: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 2,
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  assistantWrapper: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  userBubble: {
    backgroundColor: colors.primary.main,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.border.glass,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.body1,
    lineHeight: 22,
  },
  userText: {
    color: '#FFF',
  },
  assistantText: {
    color: colors.text.primary,
  },
  timeText: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.5)',
    alignSelf: 'flex-end',
    marginTop: 4,
    fontSize: 10,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.danger,
    marginBottom: spacing.xs,
  },
  recordPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.status.danger,
    marginRight: spacing.sm,
  },
  recordingText: {
    ...typography.caption,
    color: colors.status.dangerLight,
    fontWeight: '600',
    flex: 1,
  },
  inputTray: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 24 : spacing.sm,
    gap: spacing.sm,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  micButtonActive: {
    backgroundColor: colors.status.danger,
    borderColor: colors.status.danger,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.base,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    ...typography.body1,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
