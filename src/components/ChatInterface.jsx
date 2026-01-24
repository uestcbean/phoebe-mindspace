import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Plus, MessageSquare, Trash2, Menu, X, Sparkles, RefreshCw, MoreHorizontal, Edit3, Image, FileText, Mic, XCircle, Lightbulb, Copy, Check, Pencil, LogOut, User, ChevronUp, Volume2, VolumeX } from 'lucide-react';
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

const ChatInterface = ({ user, onLogout, onOpenNotes, onOpenProfile }) => {
  // User tags from backend
  const [userTags, setUserTags] = useState([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingMedia, setEditingMedia] = useState(null); // { url, type, fileName } or null
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null); // 正在朗读的消息索引
  
  // Rename session state
  const [renamingSessionId, setRenamingSessionId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  
  // New session dialog state
  const [newSessionDialog, setNewSessionDialog] = useState({
    visible: false,
    title: '',
    topic: '',
  });
  
  // Track if sessions have been loaded (to detect first-time users)
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  
  // Current session topic (for sending to API)
  const [currentTopic, setCurrentTopic] = useState(null);
  
  // Available topics with system prompts and greetings
  const TOPICS = [
    { 
      id: '技术', 
      label: '💻 技术', 
      desc: '编程、软件开发、技术问题',
      greeting: '你好！我是你的技术助手 🛠️\n\n我擅长编程开发、软件架构、技术问题排查等领域。无论是代码调试、技术选型还是学习新技术，我都可以帮你！\n\n有什么技术问题想和我聊聊？'
    },
    { 
      id: '学习', 
      label: '📚 学习', 
      desc: '知识学习、复习、考试准备',
      greeting: '你好！我是你的学习伙伴 📖\n\n我可以帮助你理解复杂概念、制定学习计划、准备考试复习。无论是新知识探索还是旧知识巩固，我都会陪你一起！\n\n今天想学点什么呢？'
    },
    { 
      id: '日常', 
      label: '☀️ 日常', 
      desc: '生活聊天、休闲闲聊',
      greeting: '你好呀！很高兴见到你 ☺️\n\n今天过得怎么样？我可以陪你聊聊生活中的趣事、分享想法，或者只是随便聊聊天放松一下。\n\n有什么想聊的吗？'
    },
    { 
      id: '创作', 
      label: '✨ 创作', 
      desc: '写作、文案、创意灵感',
      greeting: '你好！我是你的创意伙伴 ✨\n\n无论是写作构思、文案创作、还是寻找创意灵感，我都可以和你一起头脑风暴！让我们一起把想法变成精彩的作品。\n\n今天想创作什么呢？'
    },
    { 
      id: '工作', 
      label: '💼 工作', 
      desc: '职业发展、项目管理',
      greeting: '你好！我是你的职业顾问 💼\n\n我可以帮你分析职业发展方向、提供项目管理建议、准备面试，或者帮你理清工作中的难题。\n\n工作上有什么想聊的？'
    },
    { 
      id: '思考', 
      label: '🧠 思考', 
      desc: '深度分析、哲学探讨',
      greeting: '你好！我是你的思考伙伴 🧠\n\n我喜欢深度对话——探讨人生、哲学、逻辑思考，或者一起分析复杂问题。让我们进行一次有深度的交流。\n\n有什么想深入探讨的话题吗？'
    },
  ];
  
  // Multimodal state - only ONE can be active at a time
  const [multimodalType, setMultimodalType] = useState(null); // 'image' | 'file' | null
  const [multimodalData, setMultimodalData] = useState(null);
  const [multimodalPreview, setMultimodalPreview] = useState(null);
  const [multimodalFileName, setMultimodalFileName] = useState(null);
  const [multimodalUrl, setMultimodalUrl] = useState(null); // OSS URL for the uploaded file
  const [isUploading, setIsUploading] = useState(false); // Upload progress
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const isUserScrolledUp = useRef(false);
  const lastScrollTop = useRef(0);
  const [isListening, setIsListening] = useState(false); // 语音识别状态
  const [voicePanel, setVoicePanel] = useState({
    visible: false,
    transcript: '',        // 已确认的文字
    interimTranscript: '', // 临时识别中的文字
  });
  const [voiceChatMode, setVoiceChatMode] = useState(false); // 语音对话模式
  const [voiceChatStatus, setVoiceChatStatus] = useState('idle'); // idle | listening | thinking | speaking
  const audioContextRef = useRef(null); // Web Audio API context for ding sound
  const voiceChatModeRef = useRef(false); // 用于在闭包中访问最新状态
  const currentTranscriptRef = useRef(''); // 用于在闭包中访问最新的识别文字
  const voiceChatStatusRef = useRef('idle'); // 用于在闭包中访问最新的语音状态
  const isSendingVoiceRef = useRef(false); // 防止重复发送

  // 播放"叮"提示音
  const playDingSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 880; // A5 音调
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error('播放提示音失败:', e);
    }
  };

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
          setNewSessionDialog({ visible: true, title: '', topic: '' });
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
          // 保存完整消息数据，包括多模态内容
          messages: msgs.map(m => ({ 
            role: m.role, 
            content: m.content,
            mediaUrl: m.mediaUrl,      // 图片/文件 URL
            mediaType: m.mediaType,    // 'image' | 'file'
            fileName: m.fileName,      // 文件名
          })),
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

  // Smart scroll: only auto-scroll if user is near bottom, prevents jitter during streaming
  const scrollToBottom = useCallback((force = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Check if user has scrolled up (more than 100px from bottom)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    if (force || isNearBottom) {
      // Use requestAnimationFrame to batch scroll updates
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, []);

  // Handle scroll events to detect if user scrolled up
  const handleMessagesScroll = useCallback((e) => {
    const container = e.target;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    isUserScrolledUp.current = !isNearBottom;
  }, []);

  // Auto-scroll on new messages, but respect user scroll position
  useEffect(() => {
    // Force scroll when user sends a new message (last message is from user)
    const lastMsg = messages[messages.length - 1];
    const shouldForceScroll = lastMsg?.role === 'user' || !isUserScrolledUp.current;
    scrollToBottom(shouldForceScroll);
  }, [messages, scrollToBottom]);

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
    setNewSessionDialog({ visible: true, title: '', topic: '' });
  };
  
  // Default greeting when no topic is selected
  const DEFAULT_GREETING = '你好！我是 Phoebe，你的 AI 助手 🦋\n\n我可以帮你解答问题、探讨想法、或者只是陪你聊聊天。我还能从你的知识库中检索相关内容来辅助回答。\n\n有什么我可以帮你的吗？';

  // Create new session with topic - LLM will initiate with a greeting
  const createNewSession = async (topic) => {
    const newSessionId = generateSessionId();
    const topicValue = topic || null;
    const topicData = TOPICS.find(t => t.id === topic);
    
    setCurrentSessionId(newSessionId);
    setCurrentDbId(null);
    setCurrentTopic(topicValue);
    clearMultimodal();
    setNewSessionDialog({ visible: false, title: '', topic: '' });
    setRagInfo(null);
    
    // Add greeting as assistant's first message
    const greeting = topicData?.greeting || DEFAULT_GREETING;
    const greetingMessage = {
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString()
    };
    setMessages([greetingMessage]);
    
    // Immediately save the session with the greeting message
    setTimeout(() => {
      saveSession(newSessionId, [greetingMessage], topicValue);
    }, 100);
  };

  // Confirm new session dialog
  const confirmNewSession = () => {
    const { topic } = newSessionDialog;
    createNewSession(topic || null);
  };

  // Cancel new session dialog (only allowed if user has sessions)
  const cancelNewSessionDialog = () => {
    // If user has no sessions, don't allow cancel - force them to create one
    if (sessions.length === 0) {
      return;
    }
    setNewSessionDialog({ visible: false, title: '', topic: '' });
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
    setMultimodalUrl(null);
    setIsUploading(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Upload file to OSS and get URL
  const uploadToOss = async (base64Data, mimeType, filename) => {
    try {
      setIsUploading(true);
      const response = await authFetch(`${API_BASE_URL}/api/v1/files/upload`, {
        method: 'POST',
        body: JSON.stringify({
          base64: base64Data,
          mimeType: mimeType,
          filename: filename,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.url;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      const base64 = dataUrl.split(',')[1];
      
      // Set preview immediately
      setMultimodalType('image');
      setMultimodalData({ base64, mimeType: file.type });
      setMultimodalPreview(dataUrl);
      setMultimodalFileName(file.name);
      
      // Upload to OSS in background
      try {
        const url = await uploadToOss(base64, file.type, file.name);
        setMultimodalUrl(url);
        console.log('Image uploaded to OSS:', url);
      } catch (err) {
        alert('图片上传失败: ' + err.message);
        clearMultimodal();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setMultimodalType('file');
    setMultimodalFileName(file.name);
    setMultimodalPreview(null);
    
    // Read file as text for LLM context
    const textReader = new FileReader();
    textReader.onload = (event) => {
      setMultimodalData({ content: event.target.result, name: file.name });
    };
    textReader.readAsText(file);
    
    // Also upload file to server for persistence (like images)
    const base64Reader = new FileReader();
    base64Reader.onload = async (event) => {
      const dataUrl = event.target.result;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'application/octet-stream';
      
      try {
        const url = await uploadToOss(base64, mimeType, file.name);
        setMultimodalUrl(url);
        console.log('File uploaded:', url);
      } catch (err) {
        console.error('File upload failed:', err);
        // Don't clear - file content is still available for LLM
      }
    };
    base64Reader.readAsDataURL(file);
  };

  // ==================== 语音输入面板 ====================
  
  // 打开语音输入面板并开始识别
  const openVoicePanel = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别功能，请使用 Chrome 或 Edge 浏览器');
      return;
    }

    // 打开面板，清空之前的内容
    setVoicePanel({
      visible: true,
      transcript: '',
      interimTranscript: '',
    });

    // 开始语音识别
    startVoiceRecognition();
  };

  // 开始/继续语音识别
  const startVoiceRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }
        
        setVoicePanel(prev => ({
          ...prev,
          transcript: finalText,
          interimTranscript: interimText,
        }));
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          alert('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风');
          closeVoicePanel();
        } else if (event.error === 'no-speech') {
          // 没检测到语音，自动重启
          setIsListening(false);
        } else if (event.error !== 'aborted') {
          console.log('语音识别暂停：', event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      alert('启动语音识别失败：' + err.message);
    }
  };

  // 停止语音识别（但保留面板）
  const pauseVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // 清空并重新开始
  const clearAndRestartVoice = () => {
    pauseVoiceRecognition();
    setVoicePanel(prev => ({
      ...prev,
      transcript: '',
      interimTranscript: '',
    }));
    // 稍后重新开始
    setTimeout(() => {
      startVoiceRecognition();
    }, 100);
  };

  // 确认语音输入，添加到输入框
  const confirmVoiceInput = () => {
    const text = voicePanel.transcript + voicePanel.interimTranscript;
    if (text.trim()) {
      setInput(prev => prev + (prev ? ' ' : '') + text.trim());
    }
    closeVoicePanel();
  };

  // 关闭语音面板
  const closeVoicePanel = () => {
    pauseVoiceRecognition();
    setVoicePanel({
      visible: false,
      transcript: '',
      interimTranscript: '',
    });
  };

  // 切换语音识别暂停/继续
  const toggleVoiceRecognition = () => {
    if (isListening) {
      pauseVoiceRecognition();
    } else {
      startVoiceRecognition();
    }
  };

  // ========== 语音对话模式 ==========
  
  // 开启语音对话模式
  const openVoiceChatMode = () => {
    voiceChatModeRef.current = true;
    voiceChatStatusRef.current = 'listening';
    isSendingVoiceRef.current = false;
    setVoiceChatMode(true);
    setVoiceChatStatus('listening');
    startVoiceChatRecognition();
  };

  // 关闭语音对话模式
  const closeVoiceChatMode = () => {
    voiceChatModeRef.current = false;
    voiceChatStatusRef.current = 'idle';
    isSendingVoiceRef.current = false;
    setVoiceChatMode(false);
    setVoiceChatStatus('idle');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (voiceSilenceTimerRef.current) {
      clearTimeout(voiceSilenceTimerRef.current);
    }
    currentTranscriptRef.current = '';
    setVoicePanel(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
    window.speechSynthesis.cancel();
  };

  // 语音对话模式的语音识别
  const voiceSilenceTimerRef = useRef(null); // 静默计时器
  
  const startVoiceChatRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别，请使用 Chrome 浏览器');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // 持续监听
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    let finalTranscript = '';
    let lastResultTime = Date.now();

    recognition.onresult = (event) => {
      let interim = '';
      finalTranscript = ''; // 重置，重新计算
      
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      
      lastResultTime = Date.now();
      
      // 合并所有识别到的文字（包括临时的）
      const allText = (finalTranscript + interim).trim();
      currentTranscriptRef.current = allText;
      
      setVoicePanel(prev => ({
        ...prev,
        transcript: finalTranscript,
        interimTranscript: interim
      }));
      
      // 清除之前的计时器
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
      }
      
      // 如果有任何文字（包括临时识别的），启动1秒静默计时器
      if (allText) {
        voiceSilenceTimerRef.current = setTimeout(() => {
          // 1秒没有新输入，自动发送
          const textToSend = currentTranscriptRef.current;
          // 检查是否可以发送：在语音模式、有文字、正在监听状态、没有正在发送
          if (voiceChatModeRef.current && textToSend && voiceChatStatusRef.current === 'listening' && !isSendingVoiceRef.current) {
            // 标记正在发送，防止重复
            isSendingVoiceRef.current = true;
            // 播放"叮"提示音
            playDingSound();
            // 更新状态
            voiceChatStatusRef.current = 'thinking';
            setVoiceChatStatus('thinking');
            // 停止当前识别
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
            // 清空
            currentTranscriptRef.current = '';
            setVoicePanel(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
            // 发送消息
            sendVoiceChatMessage(textToSend);
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      
      // 清除计时器
      if (voiceSilenceTimerRef.current) {
        clearTimeout(voiceSilenceTimerRef.current);
        voiceSilenceTimerRef.current = null;
      }
      
      // 只有在语音模式且处于监听状态时才继续监听
      if (voiceChatModeRef.current && voiceChatStatusRef.current === 'listening') {
        setTimeout(() => {
          if (voiceChatModeRef.current && voiceChatStatusRef.current === 'listening') {
            startVoiceChatRecognition();
          }
        }, 300);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' && voiceChatModeRef.current && voiceChatStatusRef.current === 'listening') {
        // 没有检测到语音，继续监听
        setTimeout(() => {
          if (voiceChatModeRef.current && voiceChatStatusRef.current === 'listening') {
            startVoiceChatRecognition();
          }
        }, 300);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  // 发送语音对话消息
  const sendVoiceChatMessage = async (text) => {
    if (!text.trim() || !currentSessionId) {
      isSendingVoiceRef.current = false;
      return;
    }

    const userMessage = { 
      role: 'user', 
      content: text,
      timestamp: new Date().toISOString()
    };

    const loadingMessage = { role: 'assistant', content: '', isLoading: true };
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    scrollToBottom(true);

    try {
      // 构建请求体，与 handleSend 保持一致
      const history = messages.filter(m => !m.isLoading).map(m => ({ role: m.role, content: m.content }));
      
      const requestBody = {
        sessionId: currentSessionId,
        message: text,
        topic: currentTopic,
        enableRag: true,
        history: history,
        inputType: 'text',
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/chat/stream`, {
        method: 'POST',
        headers: authHeaders({ 'Accept': 'text/event-stream' }),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

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
                  fullContent += parsed.delta;
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    const lastMsg = newMsgs[newMsgs.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                      lastMsg.content = fullContent;
                      lastMsg.isLoading = false;
                    }
                    return newMsgs;
                  });
                  scrollToBottom();
                }
              } catch (e) {
                // 直接作为文本处理
                fullContent += data;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.content = fullContent;
                    lastMsg.isLoading = false;
                  }
                  return newMsgs;
                });
                scrollToBottom();
              }
            } else if (currentEvent === 'retrieval' && data) {
              try { setRagInfo(JSON.parse(data)); } catch (e) {}
            } else if (currentEvent === 'error' && data) {
              try {
                const err = JSON.parse(data);
                fullContent = `抱歉，发生错误：${err.error || '未知错误'}`;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    lastMsg.content = fullContent;
                    lastMsg.isLoading = false;
                  }
                  return newMsgs;
                });
              } catch (e) {}
            }
            currentEvent = '';
          }
        }
      }
      
      // 确保最后一条消息不再是加载状态
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.isLoading = false;
        }
        return newMsgs;
      });

      // AI 回答完成，开始朗读
      if (fullContent && voiceChatModeRef.current) {
        voiceChatStatusRef.current = 'speaking';
        setVoiceChatStatus('speaking');
        speakVoiceChatResponse(fullContent);
      } else {
        // 没有内容或已关闭语音模式，恢复监听
        isSendingVoiceRef.current = false;
        if (voiceChatModeRef.current) {
          voiceChatStatusRef.current = 'listening';
          setVoiceChatStatus('listening');
          startVoiceChatRecognition();
        }
      }

    } catch (error) {
      console.error('Voice chat error:', error);
      setMessages(prev => prev.filter(m => !m.isLoading));
      isSendingVoiceRef.current = false;
      // 出错后继续监听
      if (voiceChatModeRef.current) {
        voiceChatStatusRef.current = 'listening';
        setVoiceChatStatus('listening');
        setTimeout(() => {
          if (voiceChatModeRef.current && voiceChatStatusRef.current === 'listening') {
            startVoiceChatRecognition();
          }
        }, 1000);
      }
    }
  };

  // 朗读 AI 回答
  const speakVoiceChatResponse = (content) => {
    // 清理文本
    const cleanText = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/>\s/g, '')
      .replace(/-\s/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]/gu, '')
      .replace(/[~～]/g, '')
      .replace(/\n{2,}/g, '。')
      .replace(/\n/g, '，')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    const chineseVoice = voices.find(v => 
      (v.lang.includes('zh') || v.lang.includes('cmn')) && 
      (v.name.toLowerCase().includes('female') || v.name.includes('女') || v.name.includes('Ting') || v.name.includes('Mei'))
    ) || voices.find(v => v.lang.includes('zh') || v.lang.includes('cmn'));
    
    if (chineseVoice) utterance.voice = chineseVoice;
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;  // 正常语速
    utterance.pitch = 1.0; // 正常音调，自然女声

    utterance.onend = () => {
      // 朗读完成，重置发送标记，继续监听
      isSendingVoiceRef.current = false;
      if (voiceChatModeRef.current) {
        voiceChatStatusRef.current = 'listening';
        setVoiceChatStatus('listening');
        setTimeout(() => {
          if (voiceChatModeRef.current && voiceChatStatusRef.current === 'listening') {
            startVoiceChatRecognition();
          }
        }, 500);
      }
    };

    utterance.onerror = () => {
      isSendingVoiceRef.current = false;
      if (voiceChatModeRef.current) {
        voiceChatStatusRef.current = 'listening';
        setVoiceChatStatus('listening');
        setTimeout(() => {
          if (voiceChatModeRef.current && voiceChatStatusRef.current === 'listening') {
            startVoiceChatRecognition();
          }
        }, 500);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if ((!input.trim() && !multimodalData) || isLoading) return;

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = generateSessionId();
      setCurrentSessionId(activeSessionId);
      setCurrentDbId(null);
    }

    // Build display content for user message (no prefix - media shown separately)
    let displayContent = input.trim();

    // Save image/file URL for display in message history (persisted)
    const userMessage = { 
      role: 'user', 
      content: displayContent,
      // Use OSS URL if available, fall back to local preview for images
      mediaUrl: multimodalUrl || (multimodalType === 'image' ? multimodalPreview : null),
      mediaType: multimodalType,
      fileName: multimodalFileName, // Save filename for file attachments
      // Keep local preview for immediate display
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
        // Prefer OSS URL if available, otherwise use base64
        if (multimodalUrl) {
          requestBody.imageUrl = multimodalUrl;
        } else {
          requestBody.imageBase64 = multimodalData.base64;
        }
        requestBody.imageMimeType = multimodalData.mimeType;
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

  // 语音朗读功能
  const handleSpeak = (content, index) => {
    // 如果正在朗读同一条消息，则停止
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }
    
    // 停止之前的朗读
    window.speechSynthesis.cancel();
    
    // 清理 Markdown 语法和 emoji，只保留纯文本
    const cleanText = content
      .replace(/#{1,6}\s/g, '') // 移除标题标记
      .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除粗体
      .replace(/\*([^*]+)\*/g, '$1') // 移除斜体
      .replace(/`([^`]+)`/g, '$1') // 移除行内代码
      .replace(/```[\s\S]*?```/g, '') // 移除代码块
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接只保留文字
      .replace(/>\s/g, '') // 移除引用标记
      .replace(/-\s/g, '') // 移除列表标记
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F910}-\u{1F96B}]|[\u{1F980}-\u{1F9E0}]/gu, '') // 移除 emoji 表情
      .replace(/[~～]/g, '') // 移除波浪号
      .replace(/\n{2,}/g, '。') // 多个换行变成句号
      .replace(/\n/g, '，') // 单个换行变成逗号
      .replace(/\s{2,}/g, ' ') // 多个空格变成单个
      .trim();
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // 尝试找一个可爱的中文女声
    const voices = window.speechSynthesis.getVoices();
    const chineseVoice = voices.find(v => 
      (v.lang.includes('zh') || v.lang.includes('cmn')) && 
      (v.name.toLowerCase().includes('female') || 
       v.name.includes('女') || 
       v.name.includes('Ting') ||
       v.name.includes('Mei'))
    ) || voices.find(v => v.lang.includes('zh') || v.lang.includes('cmn'));
    
    if (chineseVoice) {
      utterance.voice = chineseVoice;
    }
    
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;  // 正常语速
    utterance.pitch = 1.0; // 正常音调，自然女声
    
    utterance.onstart = () => setSpeakingIndex(index);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    
    window.speechSynthesis.speak(utterance);
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
    const msg = messages[index];
    setEditingIndex(index);
    // Remove any prefix like [图片] or [文件: xxx] from content
    setEditingContent(msg.content.replace(/^\[(图片|语音|文件.*?)\]\s*/, ''));
    // Save media info for display in edit box
    if (msg.mediaUrl || msg.mediaType) {
      setEditingMedia({
        url: msg.mediaUrl,
        type: msg.mediaType,
        fileName: msg.fileName,
      });
    } else {
      setEditingMedia(null);
    }
  };

  // Save edited message and resend
  const handleSaveEdit = async () => {
    if (!editingContent.trim() || editingIndex === null) return;
    
    // Remove all messages from the edited one onwards
    const newMessages = messages.slice(0, editingIndex);
    setMessages(newMessages);
    
    // Set up multimodal state if media is kept
    if (editingMedia) {
      if (editingMedia.type === 'image') {
        setMultimodalType('image');
        setMultimodalUrl(editingMedia.url);
        setMultimodalPreview(editingMedia.url?.startsWith('/uploads/') 
          ? `${API_BASE_URL}${editingMedia.url}` 
          : editingMedia.url);
        setMultimodalData({ base64: null, mimeType: 'image/png' }); // URL-based
      } else if (editingMedia.type === 'file') {
        setMultimodalType('file');
        setMultimodalUrl(editingMedia.url);
        setMultimodalFileName(editingMedia.fileName);
        setMultimodalData({ content: '', name: editingMedia.fileName }); // URL-based
      }
    }
    
    setEditingIndex(null);
    setEditingContent('');
    setEditingMedia(null);
    
    // Set the edited content as input and send
    setInput(editingContent);
    
    // Trigger send after state update
    setTimeout(() => {
      handleSend();
    }, 100);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingContent('');
    setEditingMedia(null);
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
  
  // Load user tags from backend
  const loadUserTags = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/tags?sort=usage`);
      if (res.ok) {
        const data = await res.json();
        setUserTags(data);
      }
    } catch (e) {
      console.error('Failed to load tags:', e);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  // Load tags when export drawer opens
  useEffect(() => {
    if (exportDrawer.visible && userTags.length === 0) {
      loadUserTags();
    }
  }, [exportDrawer.visible, userTags.length, loadUserTags]);
  
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
      tags: '',
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
    
    setExportingIndex(index);
    
    try {
      const noteData = { title, content, comment, source: 'Phoebe AI', tags };
      const response = await authFetch(`${API_BASE_URL}/api/v1/notes`, {
        method: 'POST',
        body: JSON.stringify(noteData),
      });
      
      if (response.ok) {
        setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null });
        // 刷新标签列表（更新 usageCount）
        loadUserTags();
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
    const handleClickOutside = (e) => {
      setActiveMenu(null);
      setAttachMenuOpen(false);
      setUserMenuOpen(false);
    };
    if (activeMenu || attachMenuOpen || userMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [activeMenu, attachMenuOpen, userMenuOpen]);

  // 组件卸载时停止语音识别和语音朗读
  useEffect(() => {
    // 预加载语音列表（某些浏览器需要）
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // 停止语音朗读
      window.speechSynthesis.cancel();
    };
  }, []);

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
      
      {/* Voice Chat button - 语音对话模式 */}
      <button 
        style={{ 
          ...styles.multimodalBtn, 
          ...(voiceChatMode ? styles.listeningBtn : {})
        }}
        onClick={openVoiceChatMode}
        disabled={isLoading || voiceChatMode || !currentSessionId}
        title="语音对话"
      >
        <Mic size={18} />
      </button>
    </div>
  );

  // Multimodal preview (图片和文件)
  const renderMultimodalPreview = () => {
    if (!multimodalType) return null;
    
    return (
      <div style={styles.multimodalPreview}>
        {multimodalType === 'image' && multimodalPreview && (
          <div style={{ position: 'relative' }}>
            <img src={multimodalPreview} alt="preview" style={styles.previewImage} />
            {isUploading && (
              <div style={styles.uploadingOverlay}>
                <RefreshCw size={16} className="saving-indicator" />
              </div>
            )}
            {multimodalUrl && !isUploading && (
              <div style={styles.uploadedBadge}>
                <Check size={12} />
              </div>
            )}
          </div>
        )}
        {multimodalType === 'file' && (
          <div style={styles.filePreview}>
            <FileText size={20} />
            <span>{multimodalFileName}</span>
          </div>
        )}
        <button style={styles.clearPreviewBtn} onClick={clearMultimodal} disabled={isUploading}>
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
        @keyframes wave { 0%, 100% { height: 4px; } 50% { height: 16px; } }
        @keyframes rippleExpand { 
          0% { transform: scale(0.8); opacity: 1; } 
          100% { transform: scale(2); opacity: 0; } 
        }
        .ripple-1 { animation-delay: 0s; }
        .ripple-2 { animation-delay: 0.6s; }
        .ripple-3 { animation-delay: 1.2s; }
        .ripple-wave.listening .ripple { border-color: rgba(212, 165, 116, 0.6); }
        .ripple-wave.thinking .ripple { border-color: rgba(139, 92, 246, 0.6); animation-duration: 1s; }
        .ripple-wave.speaking .ripple { border-color: rgba(34, 197, 94, 0.6); animation-duration: 1.5s; }
        
        /* Full Width Wave Animation */
        @keyframes fullWidthWave1 {
          0% { d: path("M0,100 C360,150 720,50 1080,100 C1260,130 1350,80 1440,100 L1440,200 L0,200 Z"); }
          50% { d: path("M0,100 C360,50 720,150 1080,100 C1260,70 1350,120 1440,100 L1440,200 L0,200 Z"); }
          100% { d: path("M0,100 C360,150 720,50 1080,100 C1260,130 1350,80 1440,100 L1440,200 L0,200 Z"); }
        }
        @keyframes fullWidthWave2 {
          0% { d: path("M0,120 C360,80 720,160 1080,120 C1260,100 1350,140 1440,120 L1440,200 L0,200 Z"); }
          50% { d: path("M0,120 C360,160 720,80 1080,120 C1260,140 1350,100 1440,120 L1440,200 L0,200 Z"); }
          100% { d: path("M0,120 C360,80 720,160 1080,120 C1260,100 1350,140 1440,120 L1440,200 L0,200 Z"); }
        }
        .voice-wave-path.wave-1 {
          animation: fullWidthWave1 3s ease-in-out infinite;
          d: path("M0,100 C360,150 720,50 1080,100 C1260,130 1350,80 1440,100 L1440,200 L0,200 Z");
        }
        .voice-wave-path.wave-2 {
          animation: fullWidthWave2 4s ease-in-out infinite;
          d: path("M0,120 C360,80 720,160 1080,120 C1260,100 1350,140 1440,120 L1440,200 L0,200 Z");
        }
        .voice-action-btn:hover { background: #333 !important; }
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
        .user-info-box:hover { background: rgba(255,255,255,0.05) !important; }
        .user-menu-item:hover { background: rgba(255,255,255,0.08) !important; }
        .attach-btn:hover { background: #3a3a3a !important; color: #d4a574 !important; }
        .attach-menu-item:hover { background: rgba(255,255,255,0.08) !important; }
        .tag-chip:hover { background: rgba(255,255,255,0.1) !important; border-color: #666 !important; }
        .tag-flat-item:hover { background: rgba(212, 165, 116, 0.15) !important; border-color: rgba(212, 165, 116, 0.5) !important; color: #d4a574 !important; }
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
            <span>新对话</span>
          </button>
          <button className="nav-item" style={{ ...styles.navItem, ...styles.navItemActive }}>
            <MessageSquare size={18} />
            <span>对话</span>
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
          <div style={{ position: 'relative' }}>
            <div 
              className="user-info-box"
              style={styles.userInfoBox} 
              onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}
            >
              <div style={styles.userAvatarSmall}>
                {(user.nickname || user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <span style={styles.userName}>{user.nickname || user.username}</span>
              <ChevronUp size={16} style={{ 
                color: '#888', 
                transition: 'transform 0.2s', 
                transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' 
              }} />
              {isSaving && <RefreshCw size={12} className="saving-indicator" style={{ color: '#888' }} />}
            </div>
            
            {userMenuOpen && (
              <div style={styles.userMenuDropdown} onClick={(e) => e.stopPropagation()}>
                <button 
                  className="user-menu-item"
                  style={styles.userMenuItem} 
                  onClick={() => { setUserMenuOpen(false); onOpenProfile(); }}
                >
                  <User size={14} />
                  <span>个人中心</span>
                </button>
                <div style={styles.userMenuDivider} />
                <button 
                  className="user-menu-item"
                  style={{ ...styles.userMenuItem, color: '#ef4444' }} 
                  onClick={() => { setUserMenuOpen(false); onLogout(); }}
                >
                  <LogOut size={14} />
                  <span>退出登录</span>
                </button>
              </div>
            )}
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
                    style={{ ...styles.sendBtn, opacity: isLoading || isUploading || (!input.trim() && !multimodalData) ? 0.3 : 1 }}
                    disabled={isLoading || isUploading || (!input.trim() && !multimodalData)}
                    title={isUploading ? '图片上传中...' : '发送'}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div 
                ref={messagesContainerRef}
                style={styles.messagesList}
                onScroll={handleMessagesScroll}
              >
                {messages.filter(msg => msg.role !== 'system').map((msg, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      ...styles.messageWrapper, 
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' 
                    }}
                  >
                    <div style={{ 
                      ...styles.messageInner, 
                      ...(msg.role === 'user' ? styles.userMessageInner : styles.assistantMessageInner)
                    }}>
                      
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
                        
                        {/* Image in User Message - hide when editing (shown in edit box instead) */}
                        {msg.role === 'user' && (msg.mediaUrl || msg.imagePreview) && msg.mediaType === 'image' && editingIndex !== index && (
                          <div style={styles.msgImageWrapper}>
                            <img 
                              src={
                                msg.mediaUrl?.startsWith('/uploads/') 
                                  ? `${API_BASE_URL}${msg.mediaUrl}` 
                                  : (msg.mediaUrl || msg.imagePreview)
                              } 
                              alt="上传的图片" 
                              style={styles.msgImage}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </div>
                        )}
                        {/* File attachment in User Message - hide when editing */}
                        {msg.role === 'user' && msg.mediaUrl && msg.mediaType === 'file' && editingIndex !== index && (
                          <a 
                            href={msg.mediaUrl?.startsWith('/uploads/') ? `${API_BASE_URL}${msg.mediaUrl}` : msg.mediaUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={styles.msgFileAttachment}
                          >
                            <FileText size={18} />
                            <span>{msg.fileName || '附件文件'}</span>
                          </a>
                        )}
                        {/* For backward compatibility - show old imagePreview if no mediaType, hide when editing */}
                        {msg.role === 'user' && msg.imagePreview && !msg.mediaType && editingIndex !== index && (
                          <div style={styles.msgImageWrapper}>
                            <img src={msg.imagePreview} alt="上传的图片" style={styles.msgImage} />
                          </div>
                        )}
                        
                        {/* Message Content */}
                        {editingIndex === index ? (
                          <div style={styles.editBox}>
                            {/* Show media preview in edit mode with remove button */}
                            {editingMedia && (
                              <div style={styles.editMediaPreview}>
                                {editingMedia.type === 'image' && (
                                  <img 
                                    src={editingMedia.url?.startsWith('/uploads/') 
                                      ? `${API_BASE_URL}${editingMedia.url}` 
                                      : editingMedia.url} 
                                    alt="图片" 
                                    style={styles.editMediaImage}
                                  />
                                )}
                                {editingMedia.type === 'file' && (
                                  <div style={styles.editMediaFile}>
                                    <FileText size={18} />
                                    <span>{editingMedia.fileName || '附件'}</span>
                                  </div>
                                )}
                                <button 
                                  style={styles.editMediaRemoveBtn}
                                  onClick={() => setEditingMedia(null)}
                                  title="移除附件"
                                >
                                  <XCircle size={18} />
                                </button>
                              </div>
                            )}
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
                      
                      {/* Action Buttons - Always visible */}
                      {!msg.isLoading && editingIndex !== index && (
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
                          
                          {/* Voice Read Button (assistant messages only) */}
                          {msg.role === 'assistant' && (
                            <button 
                              className="msg-action-btn"
                              style={{
                                ...styles.msgActionBtn,
                                ...(speakingIndex === index ? { background: 'rgba(212, 165, 116, 0.2)', color: '#d4a574', borderColor: '#d4a574' } : {})
                              }}
                              onClick={() => handleSpeak(msg.content, index)}
                              title={speakingIndex === index ? "停止朗读" : "语音朗读"}
                            >
                              {speakingIndex === index ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                          )}
                          
                          {/* Export as Inspiration Button (assistant messages only) */}
                          {msg.role === 'assistant' && (
                            <button 
                              className="msg-action-btn"
                              style={styles.msgActionBtn} 
                              onClick={(e) => { e.stopPropagation(); handleExportClick(msg.content, index); }}
                              title="导出为灵感"
                              disabled={exportingIndex === index}
                            >
                              <Lightbulb size={14} style={exportingIndex === index ? { opacity: 0.5 } : {}} />
                            </button>
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
                      style={{ ...styles.sendBtnSmall, opacity: isLoading || isUploading || (!input.trim() && !multimodalData) ? 0.3 : 1 }}
                      disabled={isLoading || isUploading || (!input.trim() && !multimodalData)}
                      title={isUploading ? '图片上传中...' : '发送'}
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
            onClick={() => { setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null }); }}
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
          
          {/* Tags - 平铺多选 */}
          <div style={styles.drawerSection}>
            <label style={styles.drawerLabel}>标签</label>
            
            {/* 平铺标签列表 */}
            <div style={styles.tagsFlatContainer}>
              {isLoadingTags ? (
                <div style={styles.tagsLoadingFlat}>
                  <RefreshCw size={14} className="saving-indicator" />
                  <span>加载标签...</span>
                </div>
              ) : userTags.length > 0 ? (
                userTags.map(tag => {
                  const isSelected = exportDrawer.tags.split(',').map(t => t.trim()).includes(tag.name);
                  return (
                    <div
                      key={tag.id}
                      className="tag-flat-item"
                      style={{
                        ...styles.tagFlatItem,
                        ...(isSelected ? styles.tagFlatItemSelected : {})
                      }}
                      onClick={() => handleTagSelect(tag.name)}
                    >
                      <span style={styles.tagFlatName}>{tag.name}</span>
                      <span style={{
                        ...styles.tagFlatCount,
                        ...(isSelected ? styles.tagFlatCountSelected : {})
                      }}>{tag.usageCount || 0}</span>
                    </div>
                  );
                })
              ) : (
                <div style={styles.noTagsFlat}>暂无标签</div>
              )}
            </div>
            
            {/* 管理标签链接 */}
            <div style={styles.tagManageRow}>
              <button 
                style={styles.tagManageLinkInline}
                onClick={() => {
                  setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null });
                  onOpenProfile();
                }}
              >
                去个人中心管理标签 →
              </button>
            </div>
          </div>
        </div>
        
        <div style={styles.drawerFooter}>
          <button 
            style={styles.drawerCancelBtn}
            onClick={() => { setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null }); }}
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
          onClick={() => { setExportDrawer({ visible: false, title: '', content: '', comment: '', tags: '', index: null }); }}
        />
      )}

      {/* Voice Input Panel - 语音输入面板 */}
      {voicePanel.visible && (
        <div style={styles.voicePanelOverlay} onClick={closeVoicePanel}>
          <div style={styles.voicePanel} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={styles.voicePanelHeader}>
              <div style={styles.voicePanelTitle}>
                <Mic size={20} style={{ color: isListening ? '#22c55e' : '#888' }} />
                <span>语音输入</span>
                {isListening && (
                  <div style={styles.voiceWave}>
                    <span style={{ ...styles.waveBar, animationDelay: '0s' }}></span>
                    <span style={{ ...styles.waveBar, animationDelay: '0.1s' }}></span>
                    <span style={{ ...styles.waveBar, animationDelay: '0.2s' }}></span>
                    <span style={{ ...styles.waveBar, animationDelay: '0.3s' }}></span>
                    <span style={{ ...styles.waveBar, animationDelay: '0.4s' }}></span>
                  </div>
                )}
              </div>
              <button style={styles.voicePanelClose} onClick={closeVoicePanel}>
                <X size={20} />
              </button>
            </div>

            {/* Content - 显示识别结果 */}
            <div style={styles.voicePanelContent}>
              {(voicePanel.transcript || voicePanel.interimTranscript) ? (
                <div style={styles.voiceTranscript}>
                  <span style={styles.finalTranscript}>{voicePanel.transcript}</span>
                  <span style={styles.interimTranscript}>{voicePanel.interimTranscript}</span>
                </div>
              ) : (
                <div style={styles.voicePlaceholder}>
                  {isListening ? (
                    <>
                      <span style={styles.listeningIcon}>🎤</span>
                      <span>正在聆听，请说话...</span>
                    </>
                  ) : (
                    <>
                      <span style={styles.pausedIcon}>⏸️</span>
                      <span>已暂停，点击下方按钮继续</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Tips */}
            <div style={styles.voiceTips}>
              <span>💡 提示：说话清晰、语速适中可提高识别准确率</span>
            </div>

            {/* Actions */}
            <div style={styles.voicePanelActions}>
              <button 
                className="voice-action-btn"
                style={styles.voiceActionBtn}
                onClick={toggleVoiceRecognition}
                title={isListening ? '暂停' : '继续'}
              >
                {isListening ? (
                  <>
                    <span style={styles.pauseIcon}>⏸</span>
                    <span>暂停</span>
                  </>
                ) : (
                  <>
                    <Mic size={16} />
                    <span>继续</span>
                  </>
                )}
              </button>
              
              <button 
                className="voice-action-btn"
                style={styles.voiceActionBtn}
                onClick={clearAndRestartVoice}
                title="清空重录"
              >
                <RefreshCw size={16} />
                <span>重录</span>
              </button>
              
              <button 
                className="voice-action-btn"
                style={{ ...styles.voiceActionBtn, ...styles.voiceCancelBtn }}
                onClick={closeVoicePanel}
              >
                <X size={16} />
                <span>取消</span>
              </button>
              
              <button 
                style={{ 
                  ...styles.voiceActionBtn, 
                  ...styles.voiceConfirmBtn,
                  opacity: (voicePanel.transcript || voicePanel.interimTranscript) ? 1 : 0.5,
                }}
                onClick={confirmVoiceInput}
                disabled={!voicePanel.transcript && !voicePanel.interimTranscript}
              >
                <Check size={16} />
                <span>确认</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Chat Mode - Full Width Wave */}
      {voiceChatMode && (
        <div style={styles.voiceChatOverlay}>
          {/* Full Width Wave Animation at Bottom */}
          <div style={styles.fullWidthWaveContainer}>
            <svg style={styles.fullWidthWaveSvg} viewBox="0 0 1440 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={voiceChatStatus === 'listening' ? '#d4a574' : voiceChatStatus === 'thinking' ? '#8b5cf6' : '#22c55e'} stopOpacity="0.6" />
                  <stop offset="50%" stopColor={voiceChatStatus === 'listening' ? '#f0c896' : voiceChatStatus === 'thinking' ? '#a78bfa' : '#4ade80'} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={voiceChatStatus === 'listening' ? '#d4a574' : voiceChatStatus === 'thinking' ? '#8b5cf6' : '#22c55e'} stopOpacity="0.6" />
                </linearGradient>
                <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={voiceChatStatus === 'listening' ? '#c49664' : voiceChatStatus === 'thinking' ? '#7c3aed' : '#16a34a'} stopOpacity="0.4" />
                  <stop offset="50%" stopColor={voiceChatStatus === 'listening' ? '#e0b080' : voiceChatStatus === 'thinking' ? '#9575fa' : '#34d399'} stopOpacity="0.6" />
                  <stop offset="100%" stopColor={voiceChatStatus === 'listening' ? '#c49664' : voiceChatStatus === 'thinking' ? '#7c3aed' : '#16a34a'} stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <path className="voice-wave-path wave-1" fill="url(#waveGradient1)" />
              <path className="voice-wave-path wave-2" fill="url(#waveGradient2)" />
            </svg>
          </div>

          {/* Bottom Control Panel */}
          <div style={styles.voiceChatBottomPanel}>
            {/* Status Icon */}
            <div style={styles.voiceStatusIcon}>
              {voiceChatStatus === 'listening' && <Mic size={24} style={{ color: '#d4a574' }} />}
              {voiceChatStatus === 'thinking' && <RefreshCw size={24} className="spin" style={{ color: '#8b5cf6' }} />}
              {voiceChatStatus === 'speaking' && <Volume2 size={24} style={{ color: '#22c55e' }} />}
            </div>

            {/* Status & Transcript */}
            <div style={styles.voiceChatInfo}>
              {voiceChatStatus === 'listening' && (
                <span style={styles.voiceChatStatusLabel}>
                  {(voicePanel.transcript || voicePanel.interimTranscript) 
                    ? '停顿1秒后自动发送...' 
                    : '请说话...'}
                </span>
              )}
              {voiceChatStatus === 'thinking' && (
                <span style={styles.voiceChatStatusLabel}>思考中...</span>
              )}
              {voiceChatStatus === 'speaking' && (
                <span style={styles.voiceChatStatusLabel}>正在回答...</span>
              )}
              
              {/* Transcript Preview */}
              {(voicePanel.transcript || voicePanel.interimTranscript) && voiceChatStatus === 'listening' && (
                <div style={styles.voiceChatTranscriptInline}>
                  "{voicePanel.transcript}
                  <span style={{ opacity: 0.5 }}>{voicePanel.interimTranscript}</span>"
                </div>
              )}
            </div>

            {/* Close Button */}
            <button 
              style={styles.voiceChatCloseBtn}
              onClick={closeVoiceChatMode}
            >
              <X size={20} />
            </button>
          </div>
        </div>
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
                <label style={styles.dialogLabel}>选择对话主题</label>
                <p style={styles.dialogHint}>选择后 AI 会根据主题自我介绍并开始对话</p>
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
  userInfoBox: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.15s' },
  userAvatarSmall: { width: '32px', height: '32px', background: 'linear-gradient(135deg, #d4a574, #c4916a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a1a', fontSize: '14px', fontWeight: '600' },
  userName: { flex: 1, fontSize: '14px', color: '#d1d1d1' },
  userMenuDropdown: { position: 'absolute', bottom: '100%', left: '0', right: '0', marginBottom: '8px', background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200 },
  userMenuItem: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '6px', color: '#d1d1d1', fontSize: '13px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' },
  userMenuDivider: { height: '1px', background: '#2a2a2a', margin: '4px 0' },
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
  messagesList: { flex: 1, overflowY: 'auto', padding: '24px 0' },
  messageWrapper: { padding: '12px 24px', display: 'flex', maxWidth: '900px', margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  messageInner: { maxWidth: '100%', position: 'relative', minWidth: 0 },
  userMessageInner: { marginLeft: 'auto', maxWidth: '85%' },
  assistantMessageInner: { maxWidth: '100%' },
  messageContent: { padding: '0', fontSize: '15px', lineHeight: '1.8' },
  userBubble: { background: '#2a2a2a', color: '#e5e5e5', padding: '14px 18px', borderRadius: '20px', border: '1px solid #3a3a3a' },
  assistantBubble: { background: 'transparent', color: '#e5e5e5', padding: '4px 0' },
  ragBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '4px', fontSize: '12px', color: '#a78bfa', marginBottom: '8px' },
  messageText: { lineHeight: '1.7', fontSize: '15px', whiteSpace: 'pre-wrap' },
  msgImageWrapper: { marginBottom: '8px' },
  msgImage: { maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' },
  msgFileAttachment: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '8px', color: 'inherit', textDecoration: 'none', fontSize: '13px', transition: 'background 0.15s' },
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
  multimodalBtn: { width: '36px', height: '36px', background: 'transparent', border: 'none', borderRadius: '8px', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', position: 'relative' },
  multimodalBtnActive: { background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' },
  recordingBtn: { animation: 'recording 1.5s ease-in-out infinite', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
  listeningBtn: { animation: 'recording 1.5s ease-in-out infinite', background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
  listeningDot: { position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', animation: 'pulse 1s infinite' },
  multimodalPreview: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#252525', borderRadius: '8px', marginBottom: '8px', position: 'relative' },
  previewImage: { width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' },
  uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  uploadedBadge: { position: 'absolute', bottom: '-4px', right: '-4px', width: '18px', height: '18px', background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px' },
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
  // Tags flat styles - 平铺式标签选择
  tagsFlatContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: '#252525', border: '1px solid #3a3a3a', borderRadius: '8px', minHeight: '50px' },
  tagFlatItem: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid #3a3a3a', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', color: '#aaa', fontSize: '13px' },
  tagFlatItemSelected: { background: 'rgba(212, 165, 116, 0.25)', borderColor: '#d4a574', color: '#d4a574' },
  tagFlatName: { fontWeight: '500' },
  tagFlatCount: { fontSize: '11px', padding: '2px 6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '10px', color: '#666' },
  tagFlatCountSelected: { background: 'rgba(212, 165, 116, 0.3)', color: '#d4a574' },
  noTagsFlat: { color: '#666', fontSize: '13px', width: '100%', textAlign: 'center', padding: '8px' },
  tagsLoadingFlat: { display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '13px', width: '100%', justifyContent: 'center', padding: '8px' },
  tagManageRow: { marginTop: '8px', textAlign: 'right' },
  tagManageLinkInline: { background: 'none', border: 'none', color: '#888', fontSize: '12px', cursor: 'pointer', padding: 0, transition: 'color 0.15s' },
  
  // Edit box styles
  editBox: { background: '#252525', borderRadius: '8px', padding: '12px', border: '1px solid #3a3a3a' },
  editMediaPreview: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px', background: '#1a1a1a', borderRadius: '6px', position: 'relative' },
  editMediaImage: { maxWidth: '120px', maxHeight: '80px', borderRadius: '4px', objectFit: 'cover' },
  editMediaFile: { display: 'flex', alignItems: 'center', gap: '8px', color: '#aaa', fontSize: '13px' },
  editMediaRemoveBtn: { marginLeft: 'auto', background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'all 0.15s' },
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
  
  // Voice Panel Styles
  voicePanelOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 },
  voicePanel: { width: '480px', maxWidth: '90vw', background: '#1a1a1a', borderRadius: '16px', border: '1px solid #333', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' },
  voicePanelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2a2a2a', background: '#0d0d0d' },
  voicePanelTitle: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '600', color: '#fff' },
  voicePanelClose: { padding: '8px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: '6px', display: 'flex' },
  voiceWave: { display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '8px' },
  waveBar: { width: '3px', height: '16px', background: '#22c55e', borderRadius: '2px', animation: 'wave 0.6s ease-in-out infinite' },
  voicePanelContent: { minHeight: '150px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  voiceTranscript: { fontSize: '18px', lineHeight: '1.8', color: '#fff', textAlign: 'center', maxHeight: '200px', overflowY: 'auto', width: '100%' },
  finalTranscript: { color: '#fff' },
  interimTranscript: { color: '#888', fontStyle: 'italic' },
  voicePlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#666', fontSize: '15px' },
  listeningIcon: { fontSize: '32px', animation: 'pulse 1.5s ease-in-out infinite' },
  pausedIcon: { fontSize: '32px', opacity: 0.5 },
  voiceTips: { padding: '0 20px 16px', textAlign: 'center', fontSize: '12px', color: '#666' },
  voicePanelActions: { display: 'flex', gap: '10px', padding: '16px 20px', borderTop: '1px solid #2a2a2a', background: '#0d0d0d' },
  voiceActionBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px', background: '#252525', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#d1d1d1', fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s' },
  pauseIcon: { fontSize: '14px' },
  voiceCancelBtn: { background: 'transparent', borderColor: '#444', color: '#888' },
  voiceConfirmBtn: { background: '#22c55e', border: 'none', color: '#fff', fontWeight: '500' },
  
  // Voice Chat Mode - Full Width Wave
  voiceChatOverlay: { 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    background: 'transparent',
    pointerEvents: 'none',
    zIndex: 10001,
  },
  fullWidthWaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '200px',
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  fullWidthWaveSvg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '200px',
  },
  voiceChatBottomPanel: {
    position: 'absolute',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 20px',
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(20px)',
    borderRadius: '50px',
    pointerEvents: 'auto',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
    minWidth: '300px',
  },
  voiceStatusIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rippleContainer: {
    width: '56px',
    height: '56px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleWave: {
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid rgba(212, 165, 116, 0.6)',
    animation: 'rippleExpand 2s ease-out infinite',
  },
  rippleCenter: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #d4a574, #c4916a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  voiceChatInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: '0',
  },
  voiceChatStatusLabel: {
    fontSize: '13px',
    color: '#999',
  },
  voiceChatTranscriptInline: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: '500',
    lineHeight: '1.4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  voiceChatCloseBtn: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '50%',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.2s',
    pointerEvents: 'auto',
    flexShrink: 0,
  },
};

export default ChatInterface;
