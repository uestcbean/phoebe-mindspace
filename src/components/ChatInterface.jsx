import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Plus, MessageSquare, Trash2, Menu, X, Sparkles, RefreshCw, MoreHorizontal, Edit3, Image, FileText, Mic, XCircle, Lightbulb, Copy, Check, Pencil } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { authFetch, authHeaders, clearAuth, getToken } from '../utils/auth';
import MarkdownRenderer from './MarkdownRenderer';

// Generate greeting based on time
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Generate unique session ID
const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const ChatInterface = ({ user, onLogout, onOpenNotes }) => {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentDbId, setCurrentDbId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ragInfo, setRagInfo] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  
  // Rename session state
  const [renamingSessionId, setRenamingSessionId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  
  // New session dialog state
  const [newSessionDialog, setNewSessionDialog] = useState({
    visible: false,
    title: '',
    topic: '',
    firstMessage: '', // 用户的开场消息
  });
  
  // Track if sessions have been loaded (to detect first-time users)
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  
  // Current session topic (for sending to API)
  const [currentTopic, setCurrentTopic] = useState(null);
  
  // Available topics
  const TOPICS = [
    { id: '技术', label: '💻 技术', desc: '编程、软件开发、技术问题' },
    { id: '学习', label: '📚 学习', desc: '知识学习、复习、考试准备' },
    { id: '日常', label: '☀️ 日常', desc: '生活聊天、休闲闲聊' },
    { id: '创作', label: '✨ 创作', desc: '写作、文案、创意灵感' },
    { id: '工作', label: '💼 工作', desc: '职业发展、项目管理' },
    { id: '思考', label: '🧠 思考', desc: '深度分析、哲学探讨' },
  ];
  
  // Multimodal state - only ONE can be active at a time
  const [multimodalType, setMultimodalType] = useState(null); // 'image' | 'audio' | 'file' | null
  const [multimodalData, setMultimodalData] = useState(null);
  const [multimodalPreview, setMultimodalPreview] = useState(null);
  const [multimodalFileName, setMultimodalFileName] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Group sessions by time period
  const groupedSessions = useMemo(() => {
    const groups = {
      today: { label: '今天', sessions: [] },
      yesterday: { label: '昨天', sessions: [] },
      past7Days: { label: '近 7 天', sessions: [] },
      past30Days: { label: '近 30 天', sessions: [] },
      older: { label: '更早', sessions: [] },
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const past7DaysStart = new Date(todayStart.getTime() - 7 * 86400000);
    const past30DaysStart = new Date(todayStart.getTime() - 30 * 86400000);

    sessions.forEach(session => {
      const date = new Date(session.updatedAt || session.createdAt);
      if (date >= todayStart) groups.today.sessions.push(session);
      else if (date >= yesterdayStart) groups.yesterday.sessions.push(session);
      else if (date >= past7DaysStart) groups.past7Days.sessions.push(session);
      else if (date >= past30DaysStart) groups.past30Days.sessions.push(session);
      else groups.older.sessions.push(session);
    });

    return Object.entries(groups)
      .filter(([_, group]) => group.sessions.length > 0)
      .map(([key, group]) => ({ key, ...group }));
  }, [sessions]);

  useEffect(() => {
    loadSessions();
  }, [user.id]);

  const loadSessions = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/chat/sessions/list`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        setSessionsLoaded(true);
        
        if (data.length === 0) {
          // If user has no sessions, force them to create one
          setNewSessionDialog({ visible: true, title: '', topic: '', firstMessage: '' });
        } else {
          // Auto-load the most recent session (first one in the list, sorted by updatedAt desc)
          const mostRecentSession = data[0];
          if (mostRecentSession) {
            setCurrentSessionId(mostRecentSession.sessionId);
            setCurrentDbId(mostRecentSession.id);
            setCurrentTopic(mostRecentSession.topic || null);
            // Load messages for this session
            await loadSessionMessages(mostRecentSession.sessionId);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
      setSessionsLoaded(true);
    }
  };

  const loadSessionMessages = async (sessionId) => {
    setLoadingSession(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}`);
      if (res.ok) {
        const session = await res.json();
        setMessages(session.messages || []);
        setCurrentDbId(session.id);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    } finally {
      setLoadingSession(false);
    }
  };

  const saveSession = useCallback(async (sessId, msgs, topic) => {
    if (!sessId || msgs.length === 0) return;
    
    setIsSaving(true);
    try {
      const title = getSessionTitle(msgs);
      const res = await authFetch(`${API_BASE_URL}/api/v1/chat/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessId,
          title: title,
          topic: topic, // 保存会话主题
          messages: msgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      
      if (res.ok) {
        const savedSession = await res.json();
        setCurrentDbId(savedSession.id);
        
        setSessions(prev => {
          const exists = prev.find(s => s.sessionId === sessId);
          if (exists) {
            return prev.map(s => s.sessionId === sessId 
              ? { ...s, title, updatedAt: new Date().toISOString() } : s);
          } else {
            return [{ id: savedSession.id, sessionId: sessId, title, userId: user.id,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev];
          }
        });
      }
    } catch (e) {
      console.error('Failed to save session:', e);
    } finally {
      setIsSaving(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (currentSessionId && messages.length > 0 && !messages.some(m => m.isLoading)) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveSession(currentSessionId, messages, currentTopic), 1000);
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [messages, currentSessionId, currentTopic, saveSession]);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const getSessionTitle = (msgs) => {
    if (!msgs || msgs.length === 0) return '新对话';
    const firstUserMsg = msgs.find(m => m.role === 'user');
    if (firstUserMsg) {
      const title = firstUserMsg.content.slice(0, 40);
      return title.length < firstUserMsg.content.length ? title + '...' : title;
    }
    return '新对话';
  };

  // Open new session dialog
  const openNewSessionDialog = () => {
    setNewSessionDialog({ visible: true, title: '', topic: '', firstMessage: '' });
  };

  // Reference for pending first message (to be sent after session is created)
  const pendingFirstMessageRef = useRef(null);
  const pendingTopicRef = useRef(null);
  
  // Create new session with topic and optional first message
  const createNewSession = (title, topic, firstMessage) => {
    const newSessionId = generateSessionId();
    const topicValue = topic || null;
    
    setCurrentSessionId(newSessionId);
    setCurrentDbId(null);
    setMessages([]);
    setRagInfo(null);
    setCurrentTopic(topicValue);
    clearMultimodal();
    setNewSessionDialog({ visible: false, title: '', topic: '', firstMessage: '' });
    
    // If there's a first message, store it and set input
    if (firstMessage && firstMessage.trim()) {
      pendingFirstMessageRef.current = firstMessage.trim();
      pendingTopicRef.current = topicValue; // Also store the topic
      setInput(firstMessage.trim());
    }
  };
  
  // Effect to send pending first message when input is ready
  useEffect(() => {
    if (pendingFirstMessageRef.current && input === pendingFirstMessageRef.current && currentSessionId && !isLoading) {
      const messageToSend = pendingFirstMessageRef.current;
      const topicToUse = pendingTopicRef.current;
      pendingFirstMessageRef.current = null;
      pendingTopicRef.current = null;
      
      // Ensure topic is set before sending
      if (topicToUse && currentTopic !== topicToUse) {
        setCurrentTopic(topicToUse);
      }
      
      // Small delay to ensure state is fully updated
      const timer = setTimeout(() => {
        handleSend();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [input, currentSessionId, isLoading, currentTopic]);

  // Confirm new session dialog
  const confirmNewSession = () => {
    const { title, topic, firstMessage } = newSessionDialog;
    createNewSession(title || null, topic || null, firstMessage || null);
  };

  // Cancel new session dialog (only allowed if user has sessions)
  const cancelNewSessionDialog = () => {
    // If user has no sessions, don't allow cancel - force them to create one
    if (sessions.length === 0) {
      return;
    }
    setNewSessionDialog({ visible: false, title: '', topic: '', firstMessage: '' });
  };

  const selectSession = async (session) => {
    if (session.sessionId === currentSessionId) return;
    setCurrentSessionId(session.sessionId);
    setCurrentDbId(session.id);
    setCurrentTopic(session.topic || null); // Load session's topic
    setRagInfo(null);
    clearMultimodal();
    await loadSessionMessages(session.sessionId);
  };

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    try {
      await authFetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setCurrentDbId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  // Start renaming a session
  const startRename = (sessionId, currentTitle, e) => {
    e.stopPropagation();
    setRenamingSessionId(sessionId);
    setRenameValue(currentTitle || '');
    setActiveMenu(null);
  };

  // Save the renamed session title
  const saveRename = async (sessionId) => {
    if (!renameValue.trim()) {
      setRenamingSessionId(null);
      return;
    }
    
    try {
      await authFetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}/title`, {
        method: 'PUT',
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      
      setSessions(prev => prev.map(s => 
        s.sessionId === sessionId ? { ...s, title: renameValue.trim() } : s
      ));
    } catch (e) {
      console.error('Failed to rename session:', e);
    } finally {
      setRenamingSessionId(null);
      setRenameValue('');
    }
  };

  // Cancel renaming
  const cancelRename = () => {
    setRenamingSessionId(null);
    setRenameValue('');
  };

  // ==================== Multimodal Handlers ====================
  
  const clearMultimodal = () => {
    setMultimodalType(null);
    setMultimodalData(null);
    setMultimodalPreview(null);
    setMultimodalFileName(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result.split(',')[1];
      setMultimodalType('image');
      setMultimodalData({ base64, mimeType: file.type });
      setMultimodalPreview(event.target.result);
      setMultimodalFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Read file as text for document types
    const reader = new FileReader();
    reader.onload = (event) => {
      setMultimodalType('file');
      setMultimodalData({ content: event.target.result, name: file.name });
      setMultimodalFileName(file.name);
      setMultimodalPreview(null);
    };
    reader.readAsText(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target.result.split(',')[1];
          setMultimodalType('audio');
          setMultimodalData({ base64, format: 'webm' });
          setMultimodalFileName('录音.webm');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !multimodalData) || isLoading) return;

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = generateSessionId();
      setCurrentSessionId(activeSessionId);
      setCurrentDbId(null);
    }

    // Build display content for user message
    let displayContent = input.trim();
    if (multimodalType === 'image') displayContent = `[图片] ${displayContent}`;
    else if (multimodalType === 'audio') displayContent = `[语音] ${displayContent}`;
    else if (multimodalType === 'file') displayContent = `[文件: ${multimodalFileName}] ${displayContent}`;

    // Save image preview for display in message history
    const userMessage = { 
      role: 'user', 
      content: displayContent,
      imagePreview: multimodalType === 'image' ? multimodalPreview : null,
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setRagInfo(null);

    try {
      // Build history WITHOUT multimodal data (text only)
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      // Build request body
      const requestBody = {
        sessionId: activeSessionId,
        message: input.trim() || '请分析这个内容',
        topic: currentTopic, // 当前会话主题
        enableRag: true, // Always enable RAG, even for multimodal
        history: history,
        inputType: multimodalType || 'text',
      };

      // Add multimodal data ONLY for current message
      if (multimodalType === 'image' && multimodalData) {
        requestBody.imageBase64 = multimodalData.base64;
        requestBody.imageMimeType = multimodalData.mimeType;
      } else if (multimodalType === 'audio' && multimodalData) {
        requestBody.audioBase64 = multimodalData.base64;
        requestBody.audioFormat = multimodalData.format;
      } else if (multimodalType === 'file' && multimodalData) {
        requestBody.fileContent = multimodalData.content;
        requestBody.fileName = multimodalData.name;
      }

      // Clear multimodal after sending
      clearMultimodal();

      const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
        method: 'POST',
        headers: authHeaders({ 'Accept': 'text/event-stream' }),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error('对话请求失败');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', isLoading: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            
            if (currentEvent === 'token' && data) {
              try {
                const parsed = JSON.parse(data);
                if (parsed.delta) {
                  assistantMessage += parsed.delta;
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: assistantMessage, isLoading: false };
                    return updated;
                  });
                }
              } catch (e) {
                assistantMessage += data;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage, isLoading: false };
                  return updated;
                });
              }
            } else if (currentEvent === 'retrieval' && data) {
              try { setRagInfo(JSON.parse(data)); } catch (e) {}
            } else if (currentEvent === 'error' && data) {
              try {
                const err = JSON.parse(data);
                assistantMessage = `抱歉，发生错误：${err.error || '未知错误'}`;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantMessage, isLoading: false };
                  return updated;
                });
              } catch (e) {}
            }
            currentEvent = '';
          }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0) updated[updated.length - 1].isLoading = false;
        return updated;
      });

    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: '抱歉，我遇到了问题。请检查网络连接。', isLoading: false };
          return updated;
        }
        return [...prev, { role: 'assistant', content: '抱歉，我遇到了问题。请检查网络连接。' }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Copy message to clipboard
  const handleCopy = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Start editing a user message
  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setEditingContent(messages[index].content);
  };

  // Save edited message and resend
  const handleSaveEdit = async () => {
    if (!editingContent.trim() || editingIndex === null) return;
    
    // Remove all messages from the edited one onwards
    const newMessages = messages.slice(0, editingIndex);
    setMessages(newMessages);
    setEditingIndex(null);
    
    // Set the edited content as input and send
    setInput(editingContent);
    setEditingContent('');
    
    // Trigger send after state update
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} };
      handleSend();
    }, 100);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingContent('');
  };

  // Export message as inspiration/note
  const [exportingIndex, setExportingIndex] = useState(null);
  
  // Export drawer state
  const [exportDrawer, setExportDrawer] = useState({
    visible: false,
    title: '',
    content: '',
    comment: '',
    tags: '',
    index: null,
  });
  
  // Suggested tags
  const suggestedTags = ['AI生成', '灵感', '学习', '技术', '想法', '日记', '工作', '生活'];
  
  const handleExportClick = (content, index) => {
    // Get the user's question as title
    let userQuestion = '';
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userQuestion = messages[i].content.replace(/^\[(图片|语音|文件.*?)\]\s*/, '');
        break;
      }
    }
    const title = userQuestion.length > 50 ? userQuestion.substring(0, 50) + '...' : userQuestion || 'AI 灵感';
    
    setExportDrawer({
      visible: true,
      title,
      content,
      comment: '',
      tags: 'AI生成',
      index,
    });
  };
  
  const handleTagSelect = (tag) => {
    setExportDrawer(prev => {
      const currentTags = prev.tags.split(',').map(t => t.trim()).filter(t => t);
      if (currentTags.includes(tag)) {
        return { ...prev, tags: currentTags.filter(t => t !== tag).join(', ') };
      } else {
        return { ...prev, tags: [...currentTags, tag].join(', ') };
      }
    });
  };
  
  const handleExportConfirm = async () => {
    const { title, content, comment, tags: tagsStr, index } = exportDrawer;
    
    const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (tags.length === 0) tags.push('AI生成');
    
    setExportingIndex(index);
    
    try {
      const noteData = { title, content, comment, source: 'Phoebe AI', tags };
      const response = await authFetch(`${API_BASE_URL}/api/v1/notes`, {
        method: 'POST',
        body: JSON.stringify(noteData),
      });
      
      if (response.ok) {
        setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null });
        // Show success toast
        const toast = document.createElement('div');
        toast.innerHTML = '✨ 灵感已保存';
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      } else {
        const errorData = await response.json();
        alert('导出失败：' + (errorData.error || '未知错误'));
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('导出失败：' + err.message);
    } finally {
      setExportingIndex(null);
    }
  };

  const toggleMenu = (e, sessionId) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === sessionId ? null : sessionId);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenu(null);
      setAttachMenuOpen(false);
    };
    if (activeMenu || attachMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu, attachMenuOpen]);

  const showEmptyState = !currentSessionId || messages.length === 0;
  
  // Multimodal input buttons - Claude style with + menu
  const renderMultimodalButtons = () => (
    <div style={styles.multimodalBtns}>
      {/* Plus button with dropdown menu for files and images */}
      <div style={{ position: 'relative' }}>
        <button 
          className="attach-btn"
          style={{ 
            ...styles.attachBtn, 
            ...(attachMenuOpen || multimodalType === 'image' || multimodalType === 'file' ? styles.attachBtnActive : {}) 
          }}
          onClick={(e) => { e.stopPropagation(); setAttachMenuOpen(!attachMenuOpen); }}
          disabled={isLoading}
          title="添加附件"
        >
          <Plus size={18} />
        </button>
        
        {attachMenuOpen && (
          <div style={styles.attachMenu} onClick={(e) => e.stopPropagation()}>
            <button 
              className="attach-menu-item"
              style={styles.attachMenuItem}
              onClick={() => { imageInputRef.current?.click(); setAttachMenuOpen(false); }}
            >
              <Image size={16} />
              <span>添加图片</span>
            </button>
            <button 
              className="attach-menu-item"
              style={styles.attachMenuItem}
              onClick={() => { fileInputRef.current?.click(); setAttachMenuOpen(false); }}
            >
              <FileText size={16} />
              <span>添加文件</span>
            </button>
          </div>
        )}
      </div>
      
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.json,.csv,.xml,.html,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.go,.rs"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      
      {/* Audio button - standalone */}
      <button 
        style={{ 
          ...styles.multimodalBtn, 
          ...(multimodalType === 'audio' || isRecording ? styles.multimodalBtnActive : {}),
          ...(isRecording ? styles.recordingBtn : {})
        }}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isLoading || (multimodalType && multimodalType !== 'audio' && !isRecording)}
        title={isRecording ? "停止录音" : "语音输入"}
      >
        <Mic size={18} />
      </button>
    </div>
  );

  // Multimodal preview
  const renderMultimodalPreview = () => {
    if (!multimodalType) return null;
    
    return (
      <div style={styles.multimodalPreview}>
        {multimodalType === 'image' && multimodalPreview && (
          <img src={multimodalPreview} alt="preview" style={styles.previewImage} />
        )}
        {multimodalType === 'audio' && (
          <div style={styles.audioPreview}>
            <Mic size={20} />
            <span>语音已录制</span>
          </div>
        )}
        {multimodalType === 'file' && (
          <div style={styles.filePreview}>
            <FileText size={20} />
            <span>{multimodalFileName}</span>
          </div>
        )}
        <button style={styles.clearPreviewBtn} onClick={clearMultimodal}>
          <XCircle size={16} />
        </button>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes pulse { 0%, 80%, 100% { opacity: 0.4; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes recording { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); } }
        .dot-1 { animation: pulse 1.4s ease-in-out infinite; animation-delay: 0s; }
        .dot-2 { animation: pulse 1.4s ease-in-out infinite; animation-delay: 0.2s; }
        .dot-3 { animation: pulse 1.4s ease-in-out infinite; animation-delay: 0.4s; }
        textarea::placeholder { color: #666; }
        textarea:focus { border-color: transparent !important; outline: none; }
        .session-item { position: relative; }
        .session-item:hover { background: rgba(255,255,255,0.05) !important; }
        .session-item.active { background: rgba(255,255,255,0.08) !important; }
        .more-btn { opacity: 0; transition: opacity 0.15s; }
        .session-item:hover .more-btn { opacity: 1; }
        .sidebar { transition: transform 0.3s ease; }
        .saving-indicator { animation: spin 1s linear infinite; }
        .sidebar::-webkit-scrollbar { width: 6px; }
        .sidebar::-webkit-scrollbar-track { background: transparent; }
        .sidebar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .msg-action-btn:hover { background: rgba(255,255,255,0.1) !important; color: #fff !important; }
        .nav-item:hover { background: rgba(255,255,255,0.05) !important; color: #e5e5e5 !important; }
        .attach-btn:hover { background: #3a3a3a !important; color: #d4a574 !important; }
        .attach-menu-item:hover { background: rgba(255,255,255,0.08) !important; }
        .tag-chip:hover { background: rgba(255,255,255,0.1) !important; border-color: #666 !important; }
        .export-drawer input:focus, .export-drawer textarea:focus { outline: none; border-color: #d4a574 !important; }
        .drawer-cancel:hover { background: rgba(255,255,255,0.05) !important; }
        .drawer-confirm:hover { background: #c49664 !important; }
        .topic-btn:hover { border-color: #555 !important; background: #2a2a2a !important; }
        .topic-btn:hover .topic-desc { color: #aaa !important; }
      `}</style>

      {/* Sidebar */}
      <aside className="sidebar" style={{ ...styles.sidebar, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', position: sidebarOpen ? 'relative' : 'absolute' }}>
        {/* Brand Header */}
        <div style={styles.brandHeader}>
          <div style={styles.brandLogo}>
            <img src={`${API_BASE_URL}/icon48.png`} alt="Phoebe" style={{ width: '24px', height: '24px' }} />
            <span style={styles.brandName}>Phoebe</span>
          </div>
          <button style={styles.closeSidebarBtn} onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Menu */}
        <div style={styles.navMenu}>
          <button className="nav-item" style={styles.navItem} onClick={openNewSessionDialog}>
            <Plus size={18} />
            <span>New chat</span>
          </button>
          <button className="nav-item" style={{ ...styles.navItem, ...styles.navItemActive }}>
            <MessageSquare size={18} />
            <span>Chats</span>
          </button>
          <button className="nav-item" style={styles.navItem} onClick={onOpenNotes}>
            <Lightbulb size={18} />
            <span>灵感管理</span>
          </button>
        </div>

        {/* Section Label */}
        <div style={styles.sectionLabel}>Recents</div>

        <div style={styles.sessionList}>
          {sessions.length === 0 ? (
            <div style={styles.noSessions}>
              <MessageSquare size={32} style={{ opacity: 0.2 }} />
              <span>开始新对话</span>
            </div>
          ) : (
            groupedSessions.map(group => (
              <div key={group.key} style={styles.sessionGroup}>
                <div style={styles.groupLabel}>{group.label}</div>
                {group.sessions.map(session => (
                  <div
                    key={session.sessionId}
                    className={`session-item ${session.sessionId === currentSessionId ? 'active' : ''}`}
                    style={styles.sessionItem}
                    onClick={() => renamingSessionId !== session.sessionId && selectSession(session)}
                  >
                    {renamingSessionId === session.sessionId ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(session.sessionId);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        onBlur={() => saveRename(session.sessionId)}
                        onClick={(e) => e.stopPropagation()}
                        style={styles.renameInput}
                        autoFocus
                      />
                    ) : (
                      <>
                        <span style={styles.sessionTitle}>{session.title || '新对话'}</span>
                        <button className="more-btn" style={styles.moreBtn} onClick={(e) => toggleMenu(e, session.sessionId)}>
                          <MoreHorizontal size={16} />
                        </button>
                        
                        {activeMenu === session.sessionId && (
                          <div style={styles.dropdown} onClick={(e) => e.stopPropagation()}>
                            <button style={styles.dropdownItem} onClick={(e) => startRename(session.sessionId, session.title, e)}>
                              <Edit3 size={14} />重命名
                            </button>
                            <button style={{ ...styles.dropdownItem, color: '#ef4444' }} onClick={(e) => { deleteSession(session.sessionId, e); setActiveMenu(null); }}>
                              <Trash2 size={14} />删除
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfoBox} onClick={onLogout}>
            <div style={styles.userAvatarSmall}>
              {(user.nickname || user.username || 'U').charAt(0).toUpperCase()}
            </div>
            <span style={styles.userName}>{user.nickname || user.username}</span>
            {isSaving && <RefreshCw size={12} className="saving-indicator" style={{ color: '#888' }} />}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Top Bar with Title */}
        <div style={styles.topBar}>
          {!sidebarOpen && (
            <button style={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
          )}
          <div style={styles.chatTitleArea}>
            <span style={styles.chatTitle}>
              {currentSessionId && sessions.find(s => s.sessionId === currentSessionId)?.title || '新对话'}
            </span>
            {currentTopic && (
              <span style={styles.topicBadge}>
                {TOPICS.find(t => t.id === currentTopic)?.label || currentTopic}
              </span>
            )}
          </div>
          <div style={{ width: '40px' }} /> {/* Spacer for balance */}
        </div>

        <div style={styles.messagesContainer}>
          {loadingSession ? (
            <div style={styles.loadingState}>
              <RefreshCw size={24} className="saving-indicator" style={{ color: '#888' }} />
              <span>加载中...</span>
            </div>
          ) : showEmptyState ? (
            <div style={styles.emptyState}>
              {/* Logo */}
              <img src={`${API_BASE_URL}/icon48.png`} alt="Phoebe" style={styles.logo} />
              <h1 style={styles.greeting}>{getGreeting()}, {user.nickname || user.username}</h1>
              <div style={styles.inputWrapper}>
                {renderMultimodalPreview()}
                <div style={styles.inputRow}>
                  {renderMultimodalButtons()}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息开始对话..."
                    style={styles.emptyInput}
                    rows={1}
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    style={{ ...styles.sendBtn, opacity: isLoading || (!input.trim() && !multimodalData) ? 0.3 : 1 }}
                    disabled={isLoading || (!input.trim() && !multimodalData)}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.messagesList}>
                {messages.map((msg, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      ...styles.messageWrapper, 
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' 
                    }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div style={{ 
                      ...styles.messageInner, 
                      ...(msg.role === 'user' ? styles.userMessageInner : styles.assistantMessageInner)
                    }}>
                      {/* Role Label */}
                      <div style={{ 
                        ...styles.roleLabel, 
                        textAlign: msg.role === 'user' ? 'right' : 'left' 
                      }}>
                        {msg.role === 'user' ? (user.nickname || user.username) : 'Phoebe'}
                      </div>
                      
                      <div style={{ 
                        ...styles.messageContent,
                        ...(msg.role === 'user' ? styles.userBubble : styles.assistantBubble)
                      }}>
                        {/* RAG Badge */}
                        {msg.role === 'assistant' && index === messages.length - 1 && ragInfo?.ragEnabled && (
                          <div style={styles.ragBadge}>
                            <Sparkles size={12} />
                            已检索 {ragInfo.nodeCount} 条相关知识
                          </div>
                        )}
                        
                        {/* Image Preview in User Message */}
                        {msg.role === 'user' && msg.imagePreview && (
                          <div style={styles.msgImageWrapper}>
                            <img src={msg.imagePreview} alt="上传的图片" style={styles.msgImage} />
                          </div>
                        )}
                        
                        {/* Message Content */}
                        {editingIndex === index ? (
                          <div style={styles.editBox}>
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              style={styles.editTextarea}
                              autoFocus
                            />
                            <div style={styles.editActions}>
                              <button style={styles.editBtn} onClick={handleCancelEdit}>取消</button>
                              <button style={{ ...styles.editBtn, ...styles.editBtnPrimary }} onClick={handleSaveEdit}>
                                发送
                              </button>
                            </div>
                          </div>
                        ) : msg.isLoading && !msg.content ? (
                          <div style={styles.thinking}>
                            <span className="dot-1" style={styles.dot}></span>
                            <span className="dot-2" style={styles.dot}></span>
                            <span className="dot-3" style={styles.dot}></span>
                          </div>
                        ) : msg.role === 'assistant' ? (
                          <MarkdownRenderer content={msg.content || ''} />
                        ) : (
                          <div style={styles.messageText}>{msg.content.replace(/^\[(图片|语音|文件.*?)\]\s*/, '')}</div>
                        )}
                      </div>
                      
                      {/* Action Buttons - Show on hover */}
                      {!msg.isLoading && editingIndex !== index && (hoveredIndex === index || copiedIndex === index) && (
                        <div style={{ 
                          ...styles.msgActions, 
                          justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' 
                        }}>
                          {/* Copy Button */}
                          <button 
                            className="msg-action-btn"
                            style={styles.msgActionBtn} 
                            onClick={() => handleCopy(msg.content, index)}
                            title="复制"
                          >
                            {copiedIndex === index ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          
                          {/* Edit Button (user messages only) */}
                          {msg.role === 'user' && (
                            <button 
                              className="msg-action-btn"
                              style={styles.msgActionBtn} 
                              onClick={() => handleStartEdit(index)}
                              title="编辑"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          
                          {/* Export as Inspiration Button (assistant messages only) */}
                          {msg.role === 'assistant' && (
                            <div style={{ position: 'relative' }}>
                              <button 
                                className="msg-action-btn"
                                style={styles.msgActionBtn} 
                                onClick={(e) => { e.stopPropagation(); handleExportClick(msg.content, index); }}
                                title="导出为灵感"
                                disabled={exportingIndex === index}
                              >
                                <Lightbulb size={14} style={exportingIndex === index ? { opacity: 0.5 } : {}} />
                              </button>
                              
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div style={styles.bottomInput}>
                <div style={styles.bottomInputInner}>
                  {renderMultimodalPreview()}
                  <div style={styles.inputRow}>
                    {renderMultimodalButtons()}
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="继续对话... (Shift+Enter 换行)"
                      style={styles.chatInput}
                      rows={1}
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSend}
                      style={{ ...styles.sendBtnSmall, opacity: isLoading || (!input.trim() && !multimodalData) ? 0.3 : 1 }}
                      disabled={isLoading || (!input.trim() && !multimodalData)}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      
      {/* Export Drawer */}
      <div 
        className="export-drawer"
        style={{ 
          ...styles.exportDrawer, 
          transform: exportDrawer.visible ? 'translateX(0)' : 'translateX(100%)',
          opacity: exportDrawer.visible ? 1 : 0,
        }}
      >
        <div style={styles.drawerHeader}>
          <div style={styles.drawerTitle}>
            <Lightbulb size={20} style={{ color: '#d4a574' }} />
            <span>导出为灵感</span>
          </div>
          <button 
            style={styles.drawerClose}
            onClick={() => setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null })}
          >
            <X size={20} />
          </button>
        </div>
        
        <div style={styles.drawerContent}>
          {/* Title */}
          <div style={styles.drawerSection}>
            <label style={styles.drawerLabel}>标题</label>
            <input
              type="text"
              value={exportDrawer.title}
              onChange={(e) => setExportDrawer(prev => ({ ...prev, title: e.target.value }))}
              placeholder="灵感标题"
              style={styles.drawerInput}
            />
          </div>
          
          {/* Content */}
          <div style={{ ...styles.drawerSection, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={styles.drawerLabel}>内容</label>
            <textarea
              value={exportDrawer.content}
              onChange={(e) => setExportDrawer(prev => ({ ...prev, content: e.target.value }))}
              placeholder="编辑灵感内容..."
              style={styles.drawerTextarea}
            />
          </div>
          
          {/* Comment */}
          <div style={styles.drawerSection}>
            <label style={styles.drawerLabel}>我的想法</label>
            <textarea
              value={exportDrawer.comment}
              onChange={(e) => setExportDrawer(prev => ({ ...prev, comment: e.target.value }))}
              placeholder="记录你对这个灵感的思考..."
              style={styles.drawerCommentArea}
              rows={3}
            />
          </div>
          
          {/* Tags */}
          <div style={styles.drawerSection}>
            <label style={styles.drawerLabel}>标签</label>
            <div style={styles.tagChips}>
              {suggestedTags.map(tag => (
                <button
                  key={tag}
                  className="tag-chip"
                  style={{
                    ...styles.tagChip,
                    ...(exportDrawer.tags.split(',').map(t => t.trim()).includes(tag) ? styles.tagChipActive : {})
                  }}
                  onClick={() => handleTagSelect(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={exportDrawer.tags}
              onChange={(e) => setExportDrawer(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="自定义标签，逗号分隔"
              style={{ ...styles.drawerInput, marginTop: '10px' }}
            />
          </div>
        </div>
        
        <div style={styles.drawerFooter}>
          <button 
            style={styles.drawerCancelBtn}
            onClick={() => setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null })}
          >
            取消
          </button>
          <button 
            style={styles.drawerConfirmBtn}
            onClick={handleExportConfirm}
            disabled={exportingIndex !== null}
          >
            {exportingIndex !== null ? '保存中...' : '保存灵感'}
          </button>
        </div>
      </div>
      
      {/* Drawer Overlay */}
      {exportDrawer.visible && (
        <div 
          style={styles.drawerOverlay}
          onClick={() => setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null })}
        />
      )}

      {/* New Session Dialog */}
      {newSessionDialog.visible && (
        <>
          <div 
            style={styles.dialogOverlay} 
            onClick={sessions.length > 0 ? cancelNewSessionDialog : undefined} 
          />
          <div style={styles.newSessionDialog}>
            <div style={styles.dialogHeader}>
              <h3 style={styles.dialogTitle}>
                {sessions.length === 0 ? '👋 欢迎！创建你的第一个对话' : '✨ 开始新对话'}
              </h3>
              {sessions.length > 0 && (
                <button style={styles.dialogClose} onClick={cancelNewSessionDialog}>
                  <X size={20} />
                </button>
              )}
            </div>
            
            <div style={styles.dialogContent}>
              {/* Welcome message for first-time users */}
              {sessions.length === 0 && (
                <div style={styles.welcomeMessage}>
                  <p>选择一个主题开始你的第一个对话吧！</p>
                </div>
              )}
              
              {/* Topic Selection */}
              <div style={styles.dialogSection}>
                <label style={styles.dialogLabel}>选择对话主题（可选）</label>
                <p style={styles.dialogHint}>主题会帮助 AI 更好地理解你的需求，并从知识库中检索相关内容</p>
                <div style={styles.topicGrid}>
                  {TOPICS.map(topic => (
                    <button
                      key={topic.id}
                      className="topic-btn"
                      style={{
                        ...styles.topicBtn,
                        ...(newSessionDialog.topic === topic.id ? styles.topicBtnActive : {})
                      }}
                      onClick={() => setNewSessionDialog(prev => ({ 
                        ...prev, 
                        topic: prev.topic === topic.id ? '' : topic.id 
                      }))}
                    >
                      <span style={styles.topicLabel}>{topic.label}</span>
                      <span style={styles.topicDesc}>{topic.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* First Message - 开场消息 */}
              <div style={styles.dialogSection}>
                <label style={styles.dialogLabel}>开场消息</label>
                <p style={styles.dialogHint}>输入你想问的第一个问题，创建后将自动发送</p>
                <textarea
                  value={newSessionDialog.firstMessage}
                  onChange={(e) => setNewSessionDialog(prev => ({ ...prev, firstMessage: e.target.value }))}
                  placeholder={newSessionDialog.topic 
                    ? `例如：我想聊${TOPICS.find(t => t.id === newSessionDialog.topic)?.id || '这个主题'}相关的问题...`
                    : '输入你想问的问题...'
                  }
                  style={styles.dialogTextarea}
                  rows={3}
                />
              </div>
              
              {/* Session Title */}
              <div style={styles.dialogSection}>
                <label style={styles.dialogLabel}>对话标题（可选）</label>
                <input
                  type="text"
                  value={newSessionDialog.title}
                  onChange={(e) => setNewSessionDialog(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="留空则自动根据第一条消息生成"
                  style={styles.dialogInput}
                />
              </div>
            </div>

            <div style={styles.dialogFooter}>
              {sessions.length > 0 && (
                <button style={styles.dialogCancelBtn} onClick={cancelNewSessionDialog}>
                  取消
                </button>
              )}
              <button 
                style={{ 
                  ...styles.dialogConfirmBtn, 
                  ...(sessions.length === 0 ? { flex: 'none', width: '100%' } : {}) 
                }} 
                onClick={confirmNewSession}
              >
                开始对话
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  container: { display: 'flex', height: '100vh', background: '#1a1a1a', color: '#e5e5e5', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  sidebar: { width: '280px', background: '#0d0d0d', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1f1f1f', flexShrink: 0, zIndex: 100 },
  
  // Brand Header
  brandHeader: { padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  brandLogo: { display: 'flex', alignItems: 'center', gap: '10px' },
  brandName: { fontSize: '18px', fontWeight: '600', color: '#d4a574' },
  closeSidebarBtn: { padding: '8px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', borderRadius: '6px' },
  
  // Navigation Menu
  navMenu: { padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid #1f1f1f' },
  navItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#888', fontSize: '14px', cursor: 'pointer', textAlign: 'left', width: '100%' },
  navItemActive: { background: 'rgba(255,255,255,0.05)', color: '#e5e5e5' },
  
  // Section Label
  sectionLabel: { fontSize: '11px', fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '16px 16px 8px' },
  
  menuBtn: { padding: '10px', background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', borderRadius: '8px' },
  sessionList: { flex: 1, overflowY: 'auto', padding: '0 8px' },
  noSessions: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 20px', color: '#555', fontSize: '14px' },
  sessionGroup: { marginBottom: '4px' },
  groupLabel: { fontSize: '10px', fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 12px 4px' },
  sessionItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '1px' },
  sessionTitle: { flex: 1, fontSize: '13px', color: '#b0b0b0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '8px' },
  renameInput: { flex: 1, padding: '4px 8px', background: '#252525', border: '1px solid #d4a574', borderRadius: '4px', color: '#fff', fontSize: '13px', outline: 'none' },
  moreBtn: { padding: '4px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dropdown: { position: 'absolute', top: '100%', right: '8px', background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '4px', minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200 },
  dropdownItem: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '6px', color: '#d1d1d1', fontSize: '13px', cursor: 'pointer', textAlign: 'left' },
  sidebarFooter: { padding: '12px', borderTop: '1px solid #1f1f1f' },
  userInfoBox: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer' },
  userAvatarSmall: { width: '32px', height: '32px', background: 'linear-gradient(135deg, #d4a574, #c4916a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a1a', fontSize: '14px', fontWeight: '600' },
  userName: { flex: 1, fontSize: '14px', color: '#d1d1d1' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  
  // Top Bar with Title
  topBar: { padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #252525' },
  chatTitleArea: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flex: 1, minWidth: 0 },
  chatTitle: { fontSize: '14px', fontWeight: '500', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  topicBadge: { padding: '3px 10px', background: 'rgba(212, 165, 116, 0.15)', border: '1px solid rgba(212, 165, 116, 0.3)', borderRadius: '12px', fontSize: '12px', color: '#d4a574', whiteSpace: 'nowrap', flexShrink: 0 },
  messagesContainer: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  loadingState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#888' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  logo: { width: '64px', height: '64px', marginBottom: '16px' },
  greeting: { fontSize: '28px', fontWeight: '400', color: '#d4c4b0', marginBottom: '32px', fontFamily: 'Georgia, serif' },
  hint: { marginTop: '16px', fontSize: '13px', color: '#666' },
  inputWrapper: { width: '100%', maxWidth: '800px', padding: '0 24px', boxSizing: 'border-box', position: 'relative' },
  inputRow: { display: 'flex', alignItems: 'flex-end', gap: '8px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '16px', padding: '8px 12px', width: '100%', boxSizing: 'border-box' },
  emptyInput: { flex: 1, padding: '8px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5' },
  sendBtn: { width: '36px', height: '36px', background: '#d4a574', border: 'none', borderRadius: '8px', color: '#1a1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  messagesList: { flex: 1, overflowY: 'auto', padding: '16px 0' },
  messageWrapper: { padding: '8px 24px', display: 'flex' },
  messageInner: { maxWidth: '70%', position: 'relative' },
  userMessageInner: { },
  assistantMessageInner: { maxWidth: '75%' },
  roleLabel: { fontSize: '12px', fontWeight: '500', color: '#666', marginBottom: '6px' },
  messageContent: { padding: '12px 16px', borderRadius: '16px', fontSize: '15px', lineHeight: '1.7' },
  userBubble: { background: '#d4a574', color: '#1a1a1a', borderRadius: '16px 16px 4px 16px' },
  assistantBubble: { background: '#2a2a2a', color: '#e5e5e5', borderRadius: '16px 16px 16px 4px', border: '1px solid #333' },
  ragBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '4px', fontSize: '12px', color: '#a78bfa', marginBottom: '8px' },
  messageText: { lineHeight: '1.7', fontSize: '15px', whiteSpace: 'pre-wrap' },
  msgImageWrapper: { marginBottom: '8px' },
  msgImage: { maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' },
  thinking: { display: 'flex', gap: '4px' },
  dot: { width: '6px', height: '6px', background: '#8b5cf6', borderRadius: '50%' },
  bottomInput: { padding: '16px 24px 24px', background: '#1a1a1a', borderTop: '1px solid #2a2a2a', display: 'flex', justifyContent: 'center', position: 'relative', overflow: 'visible' },
  bottomInputInner: { width: '100%', maxWidth: '800px', position: 'relative' },
  chatInput: { flex: 1, padding: '8px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5', minWidth: 0 },
  sendBtnSmall: { width: '32px', height: '32px', background: '#d4a574', border: 'none', borderRadius: '6px', color: '#1a1a1a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  
  // Multimodal styles
  multimodalBtns: { display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' },
  attachBtn: { width: '36px', height: '36px', background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  attachBtnActive: { background: '#3a3a3a', color: '#d4a574' },
  attachMenu: { position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: '12px', padding: '8px', minWidth: '180px', boxShadow: '0 -8px 24px rgba(0,0,0,0.4)', zIndex: 9999 },
  attachMenuItem: { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#d1d1d1', fontSize: '14px', cursor: 'pointer', textAlign: 'left' },
  multimodalBtn: { width: '36px', height: '36px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  multimodalBtnActive: { background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' },
  recordingBtn: { animation: 'recording 1.5s ease-in-out infinite', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
  multimodalPreview: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#252525', borderRadius: '8px', marginBottom: '8px', position: 'relative' },
  previewImage: { width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' },
  audioPreview: { display: 'flex', alignItems: 'center', gap: '8px', color: '#a78bfa' },
  filePreview: { display: 'flex', alignItems: 'center', gap: '8px', color: '#d4a574' },
  clearPreviewBtn: { position: 'absolute', top: '6px', right: '6px', padding: '4px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: '4px' },
  
  // Message action styles
  msgActions: { display: 'flex', gap: '4px', marginTop: '8px' },
  msgActionBtn: { padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', borderRadius: '6px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  
  // Export Drawer styles
  exportDrawer: { position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '100vw', background: '#1a1a1a', borderLeft: '1px solid #2a2a2a', display: 'flex', flexDirection: 'column', zIndex: 10000, transition: 'transform 0.3s ease, opacity 0.3s ease' },
  drawerOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999 },
  drawerHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2a2a2a', background: '#0d0d0d' },
  drawerTitle: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '600', color: '#fff' },
  drawerClose: { padding: '8px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: '6px', display: 'flex' },
  drawerContent: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' },
  drawerSection: { marginBottom: '16px' },
  drawerLabel: { display: 'block', fontSize: '12px', color: '#888', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' },
  drawerInput: { width: '100%', padding: '12px 14px', background: '#252525', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' },
  drawerTextarea: { flex: 1, width: '100%', minHeight: '200px', padding: '14px', background: '#252525', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', fontSize: '14px', lineHeight: '1.6', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  drawerCommentArea: { width: '100%', padding: '12px 14px', background: '#252525', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', fontSize: '14px', lineHeight: '1.5', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  drawerFooter: { display: 'flex', gap: '12px', padding: '16px 20px', borderTop: '1px solid #2a2a2a', background: '#0d0d0d' },
  drawerCancelBtn: { flex: 1, padding: '12px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#aaa', fontSize: '14px', cursor: 'pointer' },
  drawerConfirmBtn: { flex: 1, padding: '12px', background: '#d4a574', border: 'none', borderRadius: '8px', color: '#1a1a1a', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  tagChips: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  tagChip: { padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid #444', borderRadius: '16px', color: '#aaa', fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' },
  tagChipActive: { background: 'rgba(212, 165, 116, 0.25)', borderColor: '#d4a574', color: '#d4a574' },
  
  // Edit box styles
  editBox: { background: '#252525', borderRadius: '8px', padding: '12px', border: '1px solid #3a3a3a' },
  editTextarea: { width: '100%', minHeight: '80px', padding: '12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', marginBottom: '12px' },
  editActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  editBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid #444', borderRadius: '6px', color: '#aaa', fontSize: '13px', cursor: 'pointer' },
  editBtnPrimary: { background: '#d4a574', border: 'none', color: '#1a1a1a', fontWeight: '500' },
  
  // New Session Dialog styles
  dialogOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000 },
  newSessionDialog: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '520px', maxWidth: '90vw', maxHeight: '85vh', background: '#1a1a1a', borderRadius: '16px', border: '1px solid #333', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 10001, overflow: 'hidden' },
  dialogHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #2a2a2a' },
  dialogTitle: { margin: 0, fontSize: '18px', fontWeight: '600', color: '#fff' },
  dialogClose: { padding: '8px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: '6px', display: 'flex' },
  dialogContent: { flex: 1, padding: '24px', overflowY: 'auto' },
  dialogSection: { marginBottom: '24px' },
  dialogLabel: { display: 'block', fontSize: '14px', fontWeight: '600', color: '#e5e5e5', marginBottom: '8px' },
  dialogHint: { fontSize: '13px', color: '#888', marginBottom: '16px', marginTop: '-4px' },
  welcomeMessage: { padding: '16px', background: 'rgba(212, 165, 116, 0.1)', borderRadius: '10px', marginBottom: '20px', textAlign: 'center', color: '#d4a574', fontSize: '15px' },
  dialogInput: { width: '100%', padding: '12px 14px', background: '#252525', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box', outline: 'none' },
  dialogTextarea: { width: '100%', padding: '12px 14px', background: '#252525', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: '1.5' },
  dialogFooter: { display: 'flex', gap: '12px', padding: '16px 24px', borderTop: '1px solid #2a2a2a' },
  dialogCancelBtn: { flex: 1, padding: '12px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#aaa', fontSize: '14px', cursor: 'pointer' },
  dialogConfirmBtn: { flex: 1, padding: '12px', background: '#d4a574', border: 'none', borderRadius: '8px', color: '#1a1a1a', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  topicGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' },
  topicBtn: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 16px', background: '#252525', border: '2px solid #3a3a3a', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' },
  topicBtnActive: { background: 'rgba(212, 165, 116, 0.15)', borderColor: '#d4a574' },
  topicLabel: { fontSize: '15px', fontWeight: '500', color: '#fff', marginBottom: '4px' },
  topicDesc: { fontSize: '12px', color: '#888' },
};

export default ChatInterface;
