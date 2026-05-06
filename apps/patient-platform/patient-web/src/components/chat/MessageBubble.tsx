import React from 'react';
import { chatService } from '../../services/chatService';
import { Camera, Send, X } from 'lucide-react';
import type { Message } from '../../types/chat';
import { MultiSelectMessage } from './MultiSelectMessage';
import { FeelingSelector } from './FeelingSelector';
import { formatTimeForDisplay } from '@oncolife/shared-utils';
import './FeelingSelector.css';

interface MessageBubbleProps {
  message: Message;
  onButtonClick?: (option: string) => void;
  onMultiSelectSubmit?: (selections: string[]) => void;
  onFeelingSelect?: (feeling: string) => void;
  onImageSubmit?: (base64: string) => void;
  shouldShowInteractiveElements?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  onButtonClick, 
  onMultiSelectSubmit,
  onFeelingSelect,
  onImageSubmit,
  shouldShowInteractiveElements = false
}) => {
  const isUser = message.sender === 'user';
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isImageContent = (content: string): boolean => {
    if (!content) return false;
    const isBase64 = content.startsWith('data:image/') && content.includes(';base64,');
    const isUrl = /^https?:\/\/.*?\.(jpg|jpeg|png|gif|webp|svg)(?:\?.*)?$/i.test(content);
    return isBase64 || isUrl;
  };
  
  const renderMessageContent = () => {
    switch (message.message_type) {
      case 'single-select':
      case 'button_prompt': // Backwards compatibility
        return (
          <>
            <div className="message-content">{message.content}</div>
            {shouldShowInteractiveElements && message.structured_data?.options && (
              <div className="button-options">
                {message.structured_data.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => onButtonClick?.(option)}
                    className="option-button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </>
        );
      case 'multi-select':
        return (
          <>
            <div className="message-content">{message.content}</div>
            {shouldShowInteractiveElements && (
              <MultiSelectMessage
                message={message}
                onSubmitSelections={onMultiSelectSubmit || (() => {})}
              />
            )}
          </>
        );
      case 'feeling-select':
        return (
          <>
            <div className="message-content">{message.content}</div>
            {shouldShowInteractiveElements && (
              <FeelingSelector onSelectFeeling={onFeelingSelect || (() => {})} />
            )}
          </>
        );
      case 'image':
        return (
          <>
            <div className="message-content">{message.content}</div>
            {shouldShowInteractiveElements && (
              <div className="image-selector-container">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      setSelectedFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setImagePreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                {!imagePreview ? (
                  <button 
                    className="option-button primary"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ margin: '12px auto 0' }}
                  >
                    Select Image
                  </button>
                ) : (
                  <div className="image-preview-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%', marginTop: '12px' }}>
                    <img src={imagePreview} alt="Preview" className="image-preview-thumb" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '12px', border: '2px solid #007bff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <div className="image-preview-actions" style={{ display: 'flex', gap: '12px', width: '100%', justifyContent: 'center' }}>
                      <button className="option-button" onClick={() => {
                        setImagePreview(null);
                        setSelectedFile(null);
                      }} style={{ flex: 1, minWidth: '110px', maxWidth: '160px', padding: '12px 20px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', fontSize: '14px', borderRadius: '22px' }} disabled={isUploading}>
                        Cancel
                      </button>
                      <button className="option-button primary" onClick={async () => {
                        if (!selectedFile || !onImageSubmit) return;
                        try {
                          setIsUploading(true);
                          const { upload_url, file_url } = await chatService.generateUploadUrl(selectedFile.name);
                          await chatService.uploadFile(upload_url, selectedFile);
                          onImageSubmit(file_url);
                          setImagePreview(null);
                          setSelectedFile(null);
                        } catch (error: any) {
                          console.error('Upload failed:', error);
                          const errorMsg = error?.message || 'Unknown error';
                          alert(`Failed to upload image: ${errorMsg}.`);
                        } finally {
                          setIsUploading(false);
                        }
                      }} style={{ flex: 1, minWidth: '110px', maxWidth: '160px', padding: '12px 20px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', fontSize: '14px', borderRadius: '22px' }} disabled={isUploading}>
                        {isUploading ? 'Uploading...' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        );
      case 'text':
      case 'button_response':
      case 'multi_select_response':
      case 'feeling_response':
      default:
        // For feeling_response, render the image instead of text
        if (message.message_type === 'feeling_response') {
          const feelingImages: { [key: string]: string } = {
            'Very Happy': '/src/assets/VeryHappy.png',
            'Happy': '/src/assets/Happy.png',
            'Neutral': '/src/assets/Neutral.png',
            'Sad': '/src/assets/Sad.png',
            'Very Sad': '/src/assets/VerySad.png',
          };
          const imageSrc = feelingImages[message.content];
          return (
            <div className="feeling-response-image">
              <img src={imageSrc} alt={message.content} style={{ width: '60px', height: '60px' }}/>
            </div>
          );
        }
        const isHtml = /<\/?[a-z][\s\S]*>/i.test(message.content);
        return (
          <>
            {isHtml ? (
              <div
                className="message-content"
                dangerouslySetInnerHTML={{ __html: message.content }}
              />
            ) : isImageContent(message.content) ? (
              <div className="chat-image-content">
                <img 
                  src={message.content} 
                  alt="Sent image" 
                  style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', cursor: 'pointer' }}
                  onClick={() => window.open(message.content, '_blank')}
                />
              </div>
            ) : (
              <div className="message-content">{message.content}</div>
            )}
            {/* Show buttons if structured_data.options exists (e.g., disclaimer) */}
            {shouldShowInteractiveElements && message.structured_data?.options && (
              <div className="button-options">
                {message.structured_data.options.map((option: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => onButtonClick?.(option)}
                    className="option-button primary"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </>
        );
    }
  };

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      {renderMessageContent()}
      <div className="message-time">
        {formatTimeForDisplay(message.created_at)}
      </div>
    </div>
  );
}; 