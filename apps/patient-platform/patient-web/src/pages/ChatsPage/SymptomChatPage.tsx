import React, { useEffect, useState, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { SymptomMessageBubble } from '../../components/chat/SymptomMessageBubble';
import { useWebSocket } from '../../hooks/useWebSocket';
import { chatService } from '../../services/chatService';
import type { ChatSession, Message } from '../../types/chat';
import '../../components/chat/SymptomChat.css';

/** Read summary-generation flags from a WebSocket payload (root or structured_data). */
function extractSummaryGenerationFlags(payload: unknown): {
  inProgress?: boolean;
  completed?: boolean;
} {
  if (!payload || typeof payload !== 'object') return {};
  const o = payload as Record<string, unknown>;
  const out: { inProgress?: boolean; completed?: boolean } = {};
  if (typeof o.summary_generation_in_progress === 'boolean') {
    out.inProgress = o.summary_generation_in_progress;
  } else if (typeof o.summaryGenerationInProgress === 'boolean') {
    out.inProgress = o.summaryGenerationInProgress;
  }
  if (typeof o.summary_generation_completed === 'boolean') {
    out.completed = o.summary_generation_completed;
  } else if (typeof o.summaryGenerationCompleted === 'boolean') {
    out.completed = o.summaryGenerationCompleted;
  }
  const sd = o.structured_data;
  if (sd && typeof sd === 'object' && !Array.isArray(sd)) {
    const s = sd as Record<string, unknown>;
    if (typeof s.summary_generation_in_progress === 'boolean') {
      out.inProgress = s.summary_generation_in_progress;
    } else if (typeof s.summaryGenerationInProgress === 'boolean') {
      out.inProgress = s.summaryGenerationInProgress;
    }
    if (typeof s.summary_generation_completed === 'boolean') {
      out.completed = s.summary_generation_completed;
    } else if (typeof s.summaryGenerationCompleted === 'boolean') {
      out.completed = s.summaryGenerationCompleted;
    }
  }
  return out;
}

/** Read can_undo_last_step flag from a WebSocket payload (root or structured_data). */
function extractCanUndoLastStep(payload: unknown): boolean | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const o = payload as Record<string, unknown>;

  if (typeof o.can_undo_last_step === 'boolean') return o.can_undo_last_step;
  if (typeof o.canUndoLastStep === 'boolean') return o.canUndoLastStep;

  const sd = o.structured_data;
  if (sd && typeof sd === 'object' && !Array.isArray(sd)) {
    const s = sd as Record<string, unknown>;
    if (typeof s.can_undo_last_step === 'boolean') return s.can_undo_last_step;
    if (typeof s.canUndoLastStep === 'boolean') return s.canUndoLastStep;
  }

  const cs = o.chat_state;
  if (cs && typeof cs === 'object' && !Array.isArray(cs)) {
    const c = cs as Record<string, unknown>;
    if (typeof c.can_undo_last_step === 'boolean') return c.can_undo_last_step;
    if (typeof c.canUndoLastStep === 'boolean') return c.canUndoLastStep;
  }

  return undefined;
}

function resolveCanUndoFromSession(sessionData: unknown): boolean {
  if (!sessionData || typeof sessionData !== 'object') return false;
  const sessionObj = sessionData as Record<string, unknown>;
  const conversationState =
    typeof sessionObj.conversation_state === 'string' ? sessionObj.conversation_state : undefined;
  if (conversationState === 'COMPLETED' || conversationState === 'EMERGENCY') {
    return false;
  }

  const fromSession = extractCanUndoLastStep(sessionData);
  if (fromSession !== undefined) return fromSession;

  const sessionMessages = sessionObj.messages;
  if (!Array.isArray(sessionMessages) || sessionMessages.length === 0) return false;

  const lastMessage = sessionMessages[sessionMessages.length - 1];
  if (lastMessage && typeof lastMessage === 'object') {
    const lm = lastMessage as Record<string, unknown>;
    const sd = lm.structured_data;
    if (sd && typeof sd === 'object' && !Array.isArray(sd)) {
      const s = sd as Record<string, unknown>;
      if (s.is_complete === true) return false;
    }
  }
  const fromLastMessage = extractCanUndoLastStep(lastMessage);
  return fromLastMessage === true;
}

// Send icon SVG
const SendIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

// Plus icon for new chat
const PlusIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SymptomChatPage: React.FC = () => {
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [summaryGenInProgress, setSummaryGenInProgress] = useState(false);
  const [summaryGenCompleted, setSummaryGenCompleted] = useState(false);
  const [canUndoNewCheckIn, setCanUndoNewCheckIn] = useState(false);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const awaitingUndoResponseRef = useRef(false);

  // Handle incoming WebSocket messages
  const handleNewMessage = useCallback((wsMessage: any) => {
    console.log('Received WebSocket message:', wsMessage);

    const genFlags = extractSummaryGenerationFlags(wsMessage);
    if (genFlags.inProgress !== undefined) {
      setSummaryGenInProgress(genFlags.inProgress);
    }
    if (genFlags.completed !== undefined) {
      setSummaryGenCompleted(genFlags.completed);
    }
    // New generation run (e.g. summary refresh): clear stale completed so the bar can show again.
    if (genFlags.inProgress === true) {
      setSummaryGenCompleted(false);
    }
    const canUndoFlag = extractCanUndoLastStep(wsMessage);
    if (canUndoFlag === true) {
      setCanUndoNewCheckIn(true);
    } else if (canUndoFlag === false) {
      setCanUndoNewCheckIn(false);
    } else if (wsMessage?.id !== undefined || wsMessage?.type === 'connection_established') {
      // Strict behavior: show Undo only when backend explicitly sends can_undo_last_step=true.
      // If flag is false OR missing for a chat message or connection sync, default to New Check-in.
      setCanUndoNewCheckIn(false);
    }

    setMessages(prevMessages => {
      // Handle regular message
      if (wsMessage.id) {
        setIsThinking(false);

        // Check if this is a completion message
        if (wsMessage.structured_data?.is_complete) {
          setChatSession(prev => prev ? {
            ...prev,
            conversation_state: wsMessage.structured_data?.triage_level === 'call_911' ? 'EMERGENCY' : 'COMPLETED'
          } : null);
          setCanUndoNewCheckIn(false);
        }

        if (awaitingUndoResponseRef.current) {
          awaitingUndoResponseRef.current = false;
        }

        // 1. Initial filter: remove any message with identical ID or optimistic marker
        let filtered = prevMessages.filter(m => 
          String(m.id) !== String(wsMessage.id) && 
          String(m.id) !== '-1'
        );

        // 2. Strict Content Deduplication:
        // If the last message in history is from the assistant and has identical content/type,
        // we treat this as a replacement (e.g., after an undo or a sync glitch).
        if (filtered.length > 0) {
          const lastMsg = filtered[filtered.length - 1];
          const isIdenticalAssistant = 
            lastMsg.sender === 'assistant' && 
            wsMessage.sender === 'assistant' && 
            lastMsg.content === wsMessage.content &&
            (lastMsg.message_type === wsMessage.message_type || 
             lastMsg.structured_data?.frontend_type === wsMessage.structured_data?.frontend_type);

          if (isIdenticalAssistant) {
            // Replace the last message with the new one (likely has updated tracking/undo flags)
            return [...filtered.slice(0, -1), wsMessage];
          }
        }
        
        return [...filtered, wsMessage];
      }

      return prevMessages;
    });
  }, []);

  const { isConnected, sendMessage, connectionError } = useWebSocket(
    chatSession?.chat_uuid || null,
    handleNewMessage
  );

  // Auto-scroll to ensure last message top is visible
  useEffect(() => {
    const scrollToLastMessage = () => {
      if (lastMessageRef.current) {
        // Scroll specifically to the top of the last message
        lastMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    
    // Use requestAnimationFrame to ensure layout is complete
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(scrollToLastMessage);
    });
    return () => cancelAnimationFrame(rafId);
  }, [messages, isThinking]);

  // Load today's session
  const loadTodaySession = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await chatService.getTodaySession();
      const sessionData = response.data;
      
      if (!sessionData) {
        throw new Error('No session data returned');
      }
      
      setChatSession(sessionData);
      setMessages(Array.isArray(sessionData.messages) ? sessionData.messages : []);
      setSummaryGenInProgress(false);
      setSummaryGenCompleted(false);
      setCanUndoNewCheckIn(resolveCanUndoFromSession(sessionData));
      awaitingUndoResponseRef.current = false;
      setLoading(false);
    } catch (err) {
      setError('Failed to load chat session');
      console.error('Failed to load chat session:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodaySession();
  }, []);

  // Start new conversation
  const handleStartNewConversation = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionData = await chatService.startNewSession();
      setChatSession(sessionData);
      setMessages(Array.isArray(sessionData.messages) ? sessionData.messages : []);
      setSummaryGenInProgress(false);
      setSummaryGenCompleted(false);
      setCanUndoNewCheckIn(resolveCanUndoFromSession(sessionData));
      awaitingUndoResponseRef.current = false;
    } catch (err) {
      setError('Failed to start a new chat session');
      console.error('Failed to start a new chat session:', err);
    } finally {
      setLoading(false);
    }
  };

  // Send a message
  const sendUserMessage = (
    content: string, 
    messageType: Message['message_type'] = 'text',
    structuredData?: Record<string, any>
  ) => {
    if (!chatSession || !isConnected) return;

    const userMessage: Message = {
      id: -1,
      chat_uuid: chatSession.chat_uuid,
      sender: 'user',
      message_type: messageType,
      content: content,
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsThinking(true);
    setCanUndoNewCheckIn(false);
    sendMessage(content, messageType, structuredData);
  };

  // Handle option selection (yes/no, single choice)
  const handleOptionSelect = (value: string | boolean) => {
    const content = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
    sendUserMessage(content, 'button_response');
  };

  // Handle text submission (e.g. chemo date YYYY-MM-DD) — sends as message_type "text"
  const handleTextSubmitFromBubble = (value: string) => {
    sendUserMessage(value, 'text');
  };

  // Handle image submission
  const handleImageSubmit = (imageUrl: string) => {
    sendUserMessage(imageUrl, 'image_response');
  };

  // Handle multi-select submission
  const handleMultiSelectSubmit = (values: string[]) => {
    const content = values.join(', ');
    sendUserMessage(content, 'multi_select_response');
  };

  // Symptom selection: show names in chat; IDs go in structured_data for the engine
  const handleSymptomSelect = (symptomIds: string[], displayText: string) => {
    sendUserMessage(displayText, 'multi_select_response', {
      selected_values: symptomIds,
    });
  };

  // Handle text input submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && isConnected && !isThinking) {
      sendUserMessage(textInput.trim(), 'text');
      setTextInput('');
    }
  };

  // Send exact undo payload: { type: "user_message", message_type: "undo_last_step", content: "undo" }
  const handleUndoCheckIn = () => {
    if (!chatSession || !isConnected || awaitingUndoResponseRef.current || isThinking || !canUndoNewCheckIn) return;

    awaitingUndoResponseRef.current = true;
    setIsThinking(true);
    
    // Optimistically remove the last turn (Last Assistant Q + User A) from local state.
    // This MUST match the backend behavior in symptom_checker_service.py (process_message_stream).
    setMessages(prev => {
      const current = prev.filter(m => String(m.id) !== '-1');
      if (current.length === 0) return current;

      // Identify the last turn indices
      const lastIdx = current.length - 1;
      let toRemoveIndices = [lastIdx];

      // If last is assistant, we also remove the user message that came immediately before it
      if (current[lastIdx].sender === 'assistant' && lastIdx > 0 && current[lastIdx - 1].sender === 'user') {
        toRemoveIndices.push(lastIdx - 1);
      }

      // Truncate EVERYTHING after the earliest removed index to be 100% sure no stale data remains
      const firstToRemove = Math.min(...toRemoveIndices);
      return current.slice(0, firstToRemove);
    });

    sendMessage('undo', 'undo_last_step');
  };

  // Determine if we should show text input
  const shouldShowTextInput = () => {
    if (!messages || messages.length === 0) return false;
    if (isThinking) return false;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.sender === 'user') return false;
    
    const frontendType = lastMessage.structured_data?.frontend_type || lastMessage.message_type;
    const phase = lastMessage.structured_data?.phase;
    
    // Always show text input when in ADDING_NOTES phase (personal notes after completion)
    if (phase === 'ADDING_NOTES' || frontendType === 'text_input') {
      return true;
    }
    
    // Don't show input for completed conversations (unless adding notes)
    if (chatSession?.conversation_state === 'COMPLETED' || chatSession?.conversation_state === 'EMERGENCY') {
      return false;
    }
    
    // Show text input for text, number type questions during normal flow
    return frontendType === 'text' || frontendType === 'number';
  };

  // Download summary as text file
  const downloadSummary = () => {
    // Build summary content from messages
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    let summaryText = `SYMPTOM CHECK SUMMARY\n`;
    summaryText += `${'='.repeat(50)}\n`;
    summaryText += `Date: ${date}\n\n`;
    
    // Extract symptoms from chat session
    if (chatSession?.symptom_names && chatSession.symptom_names.length > 0) {
      summaryText += `SYMPTOMS REPORTED:\n`;
      chatSession.symptom_names.forEach((symptom: string) => {
        summaryText += `  • ${symptom.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n`;
      });
      summaryText += `\n`;
    }
    
    // Add conversation history
    summaryText += `CONVERSATION LOG:\n`;
    summaryText += `${'-'.repeat(50)}\n`;
    messages.forEach(msg => {
      const sender = msg.sender === 'user' ? 'You' : 'Ruby';
      const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      // Clean up content - remove markdown formatting
      const content = msg.content
        .replace(/\*\*/g, '')
        .replace(/\n{3,}/g, '\n\n');
      summaryText += `[${time}] ${sender}:\n${content}\n\n`;
    });

    // Add footer
    summaryText += `${'-'.repeat(50)}\n`;
    summaryText += `Generated by OncoLife Symptom Checker\n`;
    summaryText += `This is not a medical diagnosis. Please consult your healthcare provider.\n`;

    // Create and trigger download
    const blob = new Blob([summaryText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `symptom-check-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Check if message should show interactive elements
  const shouldShowInteractive = (message: Message, index: number): boolean => {
    if (message.sender !== 'assistant') return false;
    if (isThinking) return false;

    // Only show for the last assistant message if no user response after
    for (let i = index + 1; i < messages.length; i++) {
      if (messages[i].sender === 'user') {
        return false;
      }
    }

    return true;
  };

  // Render thinking indicator
  const renderThinkingIndicator = () => (
    <div className="message-wrapper assistant">
      <div className="message-with-avatar">
        <div className="mini-avatar">💎</div>
        <div className="thinking-indicator">
          <div className="thinking-dots">
            <div className="thinking-dot" />
            <div className="thinking-dot" />
            <div className="thinking-dot" />
          </div>
          <span className="thinking-text">Ruby is thinking...</span>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="symptom-chat-container">
        <div className="connection-overlay">
          <div className="connection-spinner" />
          <span className="connection-text">Loading symptom checker...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="symptom-chat-container">
        <div className="connection-overlay">
          <span className="connection-text">Error: {error}</span>
          <button className="retry-btn" onClick={loadTodaySession}>Retry</button>
        </div>
      </div>
    );
  }

  /** True while the server reports summary generation in progress (initial or subsequent updates). */
  const showSummaryProgressBar =
    summaryGenInProgress === true && summaryGenCompleted === false;

  return (
    <div className="symptom-chat-container">
      {/* Header */}
      <div className="symptom-chat-header">
        <div className="header-left">
          <div className="ruby-avatar">💎</div>
          <div className="header-info">
            <h1>Ruby - Symptom Checker</h1>
            <div className="header-status">
              <span className="status-dot" />
              <span>Online • Here to help</span>
            </div>
          </div>
        </div>
        <div className="header-right">

          {/* <button 
            className="exit-chat-btn" 
            onClick={() => window.location.href = '/'}
            title="Exit Chat"
          >
            ✕
          </button> */}
        </div>
      </div>

      {/* Connection status */}
      {!isConnected && !connectionError && (
        <div className="connection-overlay">
          <div className="connection-spinner" />
          <span className="connection-text">Connecting to Ruby...</span>
        </div>
      )}

      {connectionError && (
        <div className="connection-error-banner">
          <span>⚠️ {connectionError}</span>
          <button className="retry-btn" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="symptom-messages-container">
        {messages.map((message, index) => (
          <div
            key={`${message.id}-${index}`}
            ref={index === messages.length - 1 && !isThinking ? lastMessageRef : null}
            className={`message-bubble-wrapper ${message.sender === 'user' ? 'user' : 'assistant'}`}
          >
            <SymptomMessageBubble
              message={message}
              onOptionSelect={handleOptionSelect}
              onTextSubmit={handleTextSubmitFromBubble}
              onMultiSelectSubmit={handleMultiSelectSubmit}
              onSymptomSelect={handleSymptomSelect}
              onDisclaimerAccept={() => handleOptionSelect('accept')}
              onEmergencyCheck={(selected) => {
                // Send emergency selection - 'none' or array of selected symptoms
                const content = selected.join(', ') || 'none';
                sendUserMessage(content, 'button_response');
              }}
              onSummaryAction={(action) => {
                // Handle download action
                if (action === 'download') {
                  downloadSummary();
                }
                // Send message to backend for other actions
                sendUserMessage(action, 'button_response');
              }}
              onImageSubmit={handleImageSubmit}
              shouldShowInteractive={shouldShowInteractive(message, index)}
            />
          </div>
        ))}
        {isThinking && renderThinkingIndicator()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {shouldShowTextInput() && (
        <div className="symptom-input-container">
          <form onSubmit={handleTextSubmit} className="input-wrapper">
            <input
              type="text"
              className="text-input"
              placeholder="Type your response..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={!isConnected || isThinking}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={!textInput.trim() || !isConnected || isThinking}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}

      {showSummaryProgressBar && (
        <Box
          sx={{
            flexShrink: 0,
            alignSelf: 'stretch',
            mx: { xs: 2, sm: 3 },
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            pb: 'env(safe-area-inset-bottom, 0px)',
            pt: 1,
            borderTop: '1px solid var(--border-light)',
            backgroundColor: 'var(--ruby-bubble)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'var(--ruby-primary)',
            },
          }}
        >
          <Typography
            component="p"
            variant="body2"
            sx={{
              m: 0,
              lineHeight: 1.35,
              color: 'var(--text-secondary)',
              textAlign: 'center',
              fontSize: '0.8125rem',
              fontWeight: 500,
            }}
          >
            Please wait—summary generation in progress.
          </Typography>
          <Box sx={{ lineHeight: 0, width: '100%' }}>
            <LinearProgress aria-label="Summary generation in progress" />
          </Box>
        </Box>
      )}

      {/* Floating Action Button for New Check-in */}
      <button
        className={`new-chat-fab ${shouldShowTextInput() ? 'with-input' : ''}`}
        onClick={canUndoNewCheckIn ? handleUndoCheckIn : handleStartNewConversation}
        title={canUndoNewCheckIn ? 'Undo last step' : 'Start New Check-in'}
      >
        {!canUndoNewCheckIn && <PlusIcon />}
        <span className="new-chat-text">{canUndoNewCheckIn ? 'Go back' : 'New Check-in'}</span>
      </button>
    </div>
  );
};

export default SymptomChatPage;