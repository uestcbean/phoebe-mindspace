import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Lightbulb, RefreshCw, Edit3, Trash2, Check, X, Clock, 
  CheckCircle, AlertCircle, Search, Tag, Hash, ChevronDown, Bold, Italic, 
  List, Code, Link, Image, Quote, Eye, Edit, FileText, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { authFetch } from '../utils/auth';
import MarkdownRenderer from './MarkdownRenderer';

// 来源类型选项
const SOURCE_OPTIONS = [
  { value: 'AI生成', label: 'AI 生成', icon: '🤖' },
  { value: '手动录入', label: '手动录入', icon: '✍️' },
  { value: '网页摘录', label: '网页摘录', icon: '🌐' },
  { value: '阅读笔记', label: '阅读笔记', icon: '📖' },
  { value: '灵感闪现', label: '灵感闪现', icon: '💡' },
  { value: '会议记录', label: '会议记录', icon: '📝' },
  { value: '其他', label: '其他', icon: '📌' },
];

/**
 * Inspiration Manager - View, edit, and sync inspirations (notes) to knowledge base.
 * Features: Tag-based categorization and filtering.
 */
const NotesManager = ({ user, onBack, onOpenProfile }) => {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editSource, setEditSource] = useState('AI生成');
  const [syncStatus, setSyncStatus] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null); // null = all
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showPreview, setShowPreview] = useState(false); // Markdown 预览开关
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // 侧边栏折叠状态
  const [lastSyncTime, setLastSyncTime] = useState(null); // 最近同步时间
  const [selectedEditTags, setSelectedEditTags] = useState([]); // 已选中的标签（数组）
  const [userTags, setUserTags] = useState([]); // 用户标签列表（从后端获取）
  const [isLoadingTags, setIsLoadingTags] = useState(false); // 标签加载状态
  const [confirmDialog, setConfirmDialog] = useState({ // 确认弹框状态
    visible: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'warning',
  });
  const textareaRef = useRef(null);
  const pendingScrollRef = useRef(null); // 保存待恢复的滚动位置

  // 在内容变化后恢复滚动位置（使用 useLayoutEffect 确保在浏览器绑定前同步执行）
  useLayoutEffect(() => {
    if (pendingScrollRef.current !== null && textareaRef.current) {
      // 使用 requestAnimationFrame 确保在下一帧渲染时恢复滚动位置
      requestAnimationFrame(() => {
        if (textareaRef.current && pendingScrollRef.current !== null) {
          textareaRef.current.scrollTop = pendingScrollRef.current;
          pendingScrollRef.current = null;
        }
      });
    }
  }, [editContent]);

  // Load notes
  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/notes`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
        // Load sync status for each note
        for (const note of data) {
          loadSyncStatus(note.id);
        }
      }
    } catch (e) {
      console.error('Failed to load inspirations:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Calculate tag statistics
  const tagStats = useMemo(() => {
    const stats = {};
    notes.forEach(note => {
      try {
        const tags = JSON.parse(note.tags || '[]');
        tags.forEach(tag => {
          stats[tag] = (stats[tag] || 0) + 1;
        });
      } catch (e) {
        // Ignore invalid JSON
      }
    });
    // Sort by count descending
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [notes]);

  // Load user tags from backend API
  const loadUserTags = useCallback(async () => {
    setIsLoadingTags(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/tags?sort=usage`);
      if (res.ok) {
        const data = await res.json();
        setUserTags(data);
      }
    } catch (e) {
      console.error('Failed to load user tags:', e);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  useEffect(() => {
    loadUserTags();
  }, [loadUserTags]);

  // Toggle tag selection
  const toggleTagSelection = (tag) => {
    if (selectedEditTags.includes(tag)) {
      setSelectedEditTags(selectedEditTags.filter(t => t !== tag));
    } else {
      setSelectedEditTags([...selectedEditTags, tag]);
    }
  };

  // Load sync status for a note
  const loadSyncStatus = async (noteId) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/api/knowledge-base/note/${noteId}/sync-status`);
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(prev => ({ ...prev, [noteId]: data }));
      }
    } catch (e) {
      console.error('Failed to load sync status:', e);
    }
  };

  // Sync a single note to knowledge base
  const syncNote = async (noteId) => {
    setIsSyncing(true);
    setSyncStatus(prev => ({ ...prev, [noteId]: { ...prev[noteId], syncing: true } }));
    try {
      const res = await authFetch(`${API_BASE_URL}/api/knowledge-base/note/${noteId}/update`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(prev => ({ 
          ...prev, 
          [noteId]: { 
            synced: data.success, 
            syncing: false,
            lastSync: new Date().toISOString()
          } 
        }));
      }
    } catch (e) {
      console.error('Failed to sync inspiration:', e);
      setSyncStatus(prev => ({ ...prev, [noteId]: { ...prev[noteId], syncing: false, error: true } }));
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync all notes
  const syncAllNotes = async () => {
    setIsSyncing(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/knowledge-base/sync`, {
        method: 'POST',
      });
      if (res.ok) {
        // 记录同步时间
        setLastSyncTime(new Date().toISOString());
        // Reload sync status for all notes
        for (const note of notes) {
          await loadSyncStatus(note.id);
        }
      }
    } catch (e) {
      console.error('Failed to sync all inspirations:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Show confirm dialog
  const showConfirm = (title, message, onConfirm, type = 'warning') => {
    setConfirmDialog({ visible: true, title, message, onConfirm, type });
  };

  // Close confirm dialog
  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, visible: false }));
  };

  // Delete a note with custom confirm dialog
  const deleteNote = (noteId, noteTitle) => {
    showConfirm(
      '删除灵感',
      `确定要删除"${noteTitle || '这条灵感'}"吗？删除后不可恢复。`,
      async () => {
        closeConfirmDialog();
        try {
          const res = await authFetch(`${API_BASE_URL}/api/v1/notes/${noteId}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            setNotes(prev => prev.filter(n => n.id !== noteId));
            if (selectedNote?.id === noteId) {
              setSelectedNote(null);
            }
          }
        } catch (e) {
          console.error('Failed to delete inspiration:', e);
        }
      },
      'danger'
    );
  };

  // Start editing
  const startEdit = (note) => {
    setEditTitle(note.title || '');
    setEditContent(note.content || '');
    setEditComment(note.comment || '');
    setEditSource(note.source || 'AI生成');
    try {
      const tags = JSON.parse(note.tags || '[]');
      setSelectedEditTags(tags);
    } catch (e) {
      setSelectedEditTags([]);
    }
    setIsEditing(true);
    setShowPreview(false);
  };

  // Markdown 工具栏功能
  const insertMarkdown = (prefix, suffix = '', placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editContent.substring(start, end) || placeholder;
    
    // 保存当前滚动位置
    const savedScrollTop = textarea.scrollTop;
    pendingScrollRef.current = savedScrollTop;
    
    const newText = editContent.substring(0, start) + prefix + selectedText + suffix + editContent.substring(end);
    setEditContent(newText);
    
    // 重新聚焦、设置光标位置并恢复滚动位置
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        // 双重保险：在 setTimeout 中也恢复滚动位置
        textarea.scrollTop = savedScrollTop;
      }
    }, 0);
  };

  const markdownTools = [
    { icon: Bold, title: '粗体', action: () => insertMarkdown('**', '**', '粗体文字') },
    { icon: Italic, title: '斜体', action: () => insertMarkdown('*', '*', '斜体文字') },
    { icon: Code, title: '代码', action: () => insertMarkdown('`', '`', 'code') },
    { icon: Link, title: '链接', action: () => insertMarkdown('[', '](url)', '链接文字') },
    { icon: Image, title: '图片', action: () => insertMarkdown('![', '](url)', '图片描述') },
    { icon: Quote, title: '引用', action: () => insertMarkdown('\n> ', '', '引用内容') },
    { icon: List, title: '列表', action: () => insertMarkdown('\n- ', '', '列表项') },
  ];

  // Cancel editing
  const cancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
    setSelectedEditTags([]);
    setEditComment('');
  };

  // Save edit
  const saveEdit = async () => {
    if (!selectedNote) return;
    
    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/notes/${selectedNote.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          comment: editComment,
          tags: selectedEditTags,
          source: editSource,
        }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
        setSelectedNote(updated);
        cancelEdit();
        // 更新后标记该笔记需要同步
        setSyncStatus(prev => ({ 
          ...prev, 
          [updated.id]: { ...prev[updated.id], synced: false, needsSync: true } 
        }));
        // 刷新标签列表（更新 usageCount）
        loadUserTags();
      } else {
        alert('保存失败，请重试');
      }
    } catch (e) {
      console.error('Failed to save:', e);
      alert('保存失败：' + e.message);
    }
  };

  // Filter notes by search term and selected tag
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      // Search filter
      const term = searchTerm.toLowerCase();
      const matchesSearch = !term || 
        (note.title && note.title.toLowerCase().includes(term)) ||
        (note.content && note.content.toLowerCase().includes(term));
      
      // Tag filter
      let matchesTag = true;
      if (selectedTag) {
        try {
          const tags = JSON.parse(note.tags || '[]');
          matchesTag = tags.includes(selectedTag);
        } catch (e) {
          matchesTag = false;
        }
      }
      
      return matchesSearch && matchesTag;
    });
  }, [notes, searchTerm, selectedTag]);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get sync status icon
  const getSyncStatusIcon = (noteId) => {
    const status = syncStatus[noteId];
    if (!status) return <Clock size={14} style={{ color: '#666' }} />;
    if (status.syncing) return <RefreshCw size={14} className="spin" style={{ color: '#a78bfa' }} />;
    if (status.error) return <AlertCircle size={14} style={{ color: '#ef4444' }} />;
    if (status.synced) return <CheckCircle size={14} style={{ color: '#22c55e' }} />;
    return <Clock size={14} style={{ color: '#666' }} />;
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .spin { animation: spin 1s linear infinite; }
        .note-item:hover { background: rgba(255,255,255,0.05) !important; }
        .note-item.selected { background: rgba(212, 165, 116, 0.15) !important; border-left-color: #d4a574 !important; }
        .tag-item:hover { background: rgba(255,255,255,0.08) !important; }
        .tag-item.selected { background: rgba(212, 165, 116, 0.2) !important; color: #d4a574 !important; }
        .confirm-dialog { animation: fadeIn 0.2s ease-out; }
        .confirm-btn:hover { opacity: 0.9 !important; }
        .confirm-cancel:hover { background: rgba(255,255,255,0.08) !important; }
        .tag-flat-item:hover { background: rgba(212, 165, 116, 0.15) !important; border-color: rgba(212, 165, 116, 0.5) !important; color: #d4a574 !important; }
      `}</style>

      {/* Custom Confirm Dialog */}
      {confirmDialog.visible && (
        <div style={styles.dialogOverlay} onClick={closeConfirmDialog}>
          <div 
            className="confirm-dialog"
            style={styles.confirmDialog} 
            onClick={e => e.stopPropagation()}
          >
            <div style={styles.dialogHeader}>
              <img 
                src={`${API_BASE_URL}/icon48.png`} 
                alt="Phoebe" 
                style={styles.dialogIcon}
              />
              <h3 style={styles.dialogTitle}>{confirmDialog.title}</h3>
            </div>
            <div style={styles.dialogContent}>
              <p style={styles.dialogMessage}>{confirmDialog.message}</p>
            </div>
            <div style={styles.dialogActions}>
              <button 
                className="confirm-cancel"
                style={styles.dialogCancelBtn}
                onClick={closeConfirmDialog}
              >
                取消
              </button>
              <button 
                className="confirm-btn"
                style={{
                  ...styles.dialogConfirmBtn,
                  background: confirmDialog.type === 'danger' ? '#ef4444' : '#d4a574',
                }}
                onClick={confirmDialog.onConfirm}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
          <Lightbulb size={24} style={{ color: '#d4a574' }} />
          <h1 style={styles.title}>灵感管理</h1>
          <span style={styles.noteCount}>{notes.length} 条灵感</span>
        </div>
        <div style={styles.headerRight}>
          {/* 同步时间提示 */}
          {lastSyncTime && (
            <div style={styles.syncTimeInfo}>
              <Clock size={14} style={{ color: '#666' }} />
              <span>知识库同步: {formatDate(lastSyncTime)}</span>
            </div>
          )}
          <button 
            style={styles.syncAllBtn} 
            onClick={syncAllNotes}
            disabled={isSyncing}
          >
            <RefreshCw size={16} className={isSyncing ? 'spin' : ''} />
            同步全部到知识库
          </button>
        </div>
      </header>

      <div style={styles.content}>
        {/* Tags Sidebar */}
        <aside style={styles.tagsSidebar}>
          <div style={styles.tagsHeader}>
            <Tag size={16} style={{ color: '#888' }} />
            <span>标签分类</span>
          </div>
          <div style={styles.tagsList}>
            {/* All Tags */}
            <div 
              className={`tag-item ${selectedTag === null ? 'selected' : ''}`}
              style={styles.tagItem}
              onClick={() => setSelectedTag(null)}
            >
              <span>全部灵感</span>
              <span style={styles.tagCount}>{notes.length}</span>
            </div>
            
            {/* Individual Tags */}
            {tagStats.map(({ tag, count }) => (
              <div 
                key={tag}
                className={`tag-item ${selectedTag === tag ? 'selected' : ''}`}
                style={styles.tagItem}
                onClick={() => setSelectedTag(tag)}
              >
                <span style={styles.tagName}>
                  <Hash size={12} style={{ opacity: 0.5 }} />
                  {tag}
                </span>
                <span style={styles.tagCount}>{count}</span>
              </div>
            ))}
            
            {tagStats.length === 0 && (
              <div style={styles.noTags}>暂无标签</div>
            )}
          </div>
        </aside>

        {/* Notes List */}
        <aside style={{
          ...styles.sidebar,
          ...(sidebarCollapsed ? styles.sidebarCollapsed : {})
        }}>
          {/* 折叠按钮 */}
          <button 
            style={{
              ...styles.collapseBtn,
              ...(sidebarCollapsed ? styles.collapseBtnCollapsed : {})
            }}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
          
          {!sidebarCollapsed && (
            <>
              <div style={styles.searchBox}>
                <Search size={16} style={{ color: '#666' }} />
                <input
                  type="text"
                  placeholder="搜索灵感..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
              </div>

              {selectedTag && (
                <div style={styles.filterBadge}>
                  <span>标签: {selectedTag}</span>
                  <button style={styles.clearFilter} onClick={() => setSelectedTag(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}
            </>
          )}

          {!sidebarCollapsed && (
              <div style={styles.notesList}>
                {isLoading ? (
                  <div style={styles.loading}>
                    <RefreshCw size={24} className="spin" style={{ color: '#888' }} />
                    <span>加载中...</span>
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div style={styles.empty}>
                    <Lightbulb size={32} style={{ opacity: 0.3 }} />
                    <span>{selectedTag ? `没有"${selectedTag}"相关的灵感` : '暂无灵感'}</span>
                  </div>
                ) : (
                  filteredNotes.map(note => (
                    <div
                      key={note.id}
                      className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
                      style={styles.noteItem}
                      onClick={() => setSelectedNote(note)}
                    >
                      <div style={styles.noteHeader}>
                        <span style={styles.noteTitle}>{note.title || '无标题'}</span>
                        {getSyncStatusIcon(note.id)}
                      </div>
                      <div style={styles.noteMeta}>
                        <span>{SOURCE_OPTIONS.find(s => s.value === note.source)?.icon || '📌'} {note.source}</span>
                        <span>·</span>
                        <span>{formatDate(note.createdAt)}</span>
                      </div>
                      <div style={styles.notePreview}>
                        {note.content?.substring(0, 80)}...
                      </div>
                      {/* Note Tags Preview */}
                      {note.tags && (
                        <div style={styles.noteTags}>
                          {JSON.parse(note.tags || '[]').slice(0, 3).map((tag, i) => (
                            <span key={i} style={styles.noteTagBadge}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
        </aside>

        {/* Note Detail */}
        <main style={styles.main}>
          {selectedNote ? (
            <div style={styles.noteDetail}>
              {/* Note Toolbar */}
              <div style={styles.toolbar}>
                {isEditing ? (
                  // 编辑模式：标题和按钮在同一行
                  <>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="标题"
                      style={styles.editTitleInline}
                    />
                    <div style={styles.toolbarButtons}>
                      <button style={styles.saveBtn} onClick={saveEdit}>
                        <Check size={16} />
                        保存
                      </button>
                      <button style={styles.cancelBtn} onClick={cancelEdit}>
                        <X size={16} />
                        取消
                      </button>
                    </div>
                  </>
                ) : (
                  // 查看模式
                  <>
                    <div style={styles.toolbarLeft}>
                      <h2 style={styles.detailTitle}>{selectedNote.title || '无标题'}</h2>
                      <div style={styles.detailMeta}>
                        <span>来源: {selectedNote.source}</span>
                        <span>·</span>
                        <span>创建: {formatDate(selectedNote.createdAt)}</span>
                        {syncStatus[selectedNote.id]?.lastSync && (
                          <>
                            <span>·</span>
                            <span>同步: {formatDate(syncStatus[selectedNote.id].lastSync)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={styles.toolbarRight}>
                      <button 
                        style={styles.toolBtn} 
                        onClick={() => syncNote(selectedNote.id)}
                        disabled={syncStatus[selectedNote.id]?.syncing}
                      >
                        <RefreshCw size={16} className={syncStatus[selectedNote.id]?.syncing ? 'spin' : ''} />
                        同步
                      </button>
                      <button style={styles.toolBtn} onClick={() => startEdit(selectedNote)}>
                        <Edit3 size={16} />
                        编辑
                      </button>
                      <button style={{ ...styles.toolBtn, color: '#ef4444' }} onClick={() => deleteNote(selectedNote.id, selectedNote.title)}>
                        <Trash2 size={16} />
                        删除
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Sync Status Banner */}
              {syncStatus[selectedNote.id] && (
                <div style={{
                  ...styles.syncBanner,
                  background: syncStatus[selectedNote.id].synced 
                    ? 'rgba(34, 197, 94, 0.1)' 
                    : syncStatus[selectedNote.id].needsSync
                      ? 'rgba(249, 115, 22, 0.1)'
                      : 'rgba(234, 179, 8, 0.1)',
                  borderColor: syncStatus[selectedNote.id].synced 
                    ? '#22c55e' 
                    : syncStatus[selectedNote.id].needsSync
                      ? '#f97316'
                      : '#eab308',
                }}>
                  {syncStatus[selectedNote.id].synced ? (
                    <>
                      <CheckCircle size={16} style={{ color: '#22c55e' }} />
                      <span>已同步到知识库</span>
                      {syncStatus[selectedNote.id].lastSync && (
                        <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>
                          同步时间: {formatDate(syncStatus[selectedNote.id].lastSync)}
                        </span>
                      )}
                    </>
                  ) : syncStatus[selectedNote.id].needsSync ? (
                    <>
                      <AlertCircle size={16} style={{ color: '#f97316' }} />
                      <span>内容已更新，需要重新同步到知识库</span>
                      <button 
                        style={styles.syncNowBtn}
                        onClick={() => syncNote(selectedNote.id)}
                        disabled={syncStatus[selectedNote.id]?.syncing}
                      >
                        <RefreshCw size={12} className={syncStatus[selectedNote.id]?.syncing ? 'spin' : ''} />
                        立即同步
                      </button>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} style={{ color: '#eab308' }} />
                      <span>未同步到知识库，点击上方"同步"按钮同步</span>
                    </>
                  )}
                </div>
              )}

              {/* Note Content */}
              <div style={styles.noteContent}>
                {isEditing ? (
                  <div style={styles.editArea}>
                    {/* 标签选择 - 放在编辑区上方 */}
                    <div style={styles.tagsInputWrapperTop}>
                      <div style={styles.tagsHeaderRow}>
                        <label style={styles.editLabel}>
                          <Tag size={14} style={{ marginRight: 4 }} />
                          标签
                        </label>
                        <button 
                          style={styles.tagManageLinkInline}
                          onClick={() => onOpenProfile && onOpenProfile()}
                        >
                          管理标签 →
                        </button>
                      </div>
                      
                      {/* 平铺标签列表 */}
                      <div style={styles.tagsFlatContainerCompact}>
                        {isLoadingTags ? (
                          <div style={styles.tagsLoadingFlat}>
                            <RefreshCw size={14} className="spin" />
                            <span>加载标签...</span>
                          </div>
                        ) : userTags.length > 0 ? (
                          userTags.map(tag => {
                            const isSelected = selectedEditTags.includes(tag.name);
                            return (
                              <div
                                key={tag.id}
                                className="tag-flat-item"
                                style={{
                                  ...styles.tagFlatItem,
                                  ...(isSelected ? styles.tagFlatItemSelected : {})
                                }}
                                onClick={() => toggleTagSelection(tag.name)}
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
                    </div>

                    {/* Markdown 工具栏 */}
                    <div style={styles.markdownToolbar}>
                      <div style={styles.toolbarGroup}>
                        {markdownTools.map((tool, idx) => (
                          <button
                            key={idx}
                            style={styles.mdToolBtn}
                            onClick={tool.action}
                            title={tool.title}
                          >
                            <tool.icon size={16} />
                          </button>
                        ))}
                      </div>
                      <div style={styles.toolbarGroup}>
                        <button
                          style={{
                            ...styles.mdToolBtn,
                            background: showPreview ? 'rgba(212, 165, 116, 0.2)' : 'transparent',
                            color: showPreview ? '#d4a574' : '#888',
                          }}
                          onClick={() => setShowPreview(!showPreview)}
                          title={showPreview ? '编辑模式' : '预览模式'}
                        >
                          {showPreview ? <Edit size={16} /> : <Eye size={16} />}
                          <span style={{ marginLeft: 4, fontSize: 12 }}>{showPreview ? '编辑' : '预览'}</span>
                        </button>
                      </div>
                    </div>

                    {/* 内容编辑/预览区 */}
                    <div style={styles.editorContainer}>
                      {showPreview ? (
                        <div style={styles.previewArea}>
                          <MarkdownRenderer content={editContent || '*暂无内容*'} />
                        </div>
                      ) : (
                        <textarea
                          ref={textareaRef}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="灵感内容（支持 Markdown 语法）&#10;&#10;试试：&#10;**粗体** *斜体* `代码`&#10;- 列表项&#10;> 引用"
                          style={styles.editContent}
                        />
                      )}
                    </div>

                    {/* 备注输入 */}
                    <div style={styles.editCommentSection}>
                      <label style={styles.editLabel}>
                        <FileText size={14} style={{ marginRight: 4 }} />
                        备注
                      </label>
                      <input
                        type="text"
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        placeholder="添加备注..."
                        style={styles.editCommentInput}
                      />
                    </div>
                  </div>
                ) : (
                  <MarkdownRenderer content={selectedNote.content || ''} />
                )}
              </div>

              {/* Tags */}
              {selectedNote.tags && !isEditing && (
                <div style={styles.tags}>
                  {JSON.parse(selectedNote.tags || '[]').map((tag, i) => (
                    <span 
                      key={i} 
                      style={styles.tag}
                      onClick={() => setSelectedTag(tag)}
                    >
                      <Hash size={12} />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Comment - 编辑模式下不显示，避免重复 */}
              {selectedNote.comment && !isEditing && (
                <div style={styles.comment}>
                  <strong>备注：</strong> {selectedNote.comment}
                </div>
              )}
            </div>
          ) : (
            <div style={styles.noSelection}>
              <Lightbulb size={48} style={{ opacity: 0.2, color: '#d4a574' }} />
              <span>选择一条灵感查看详情</span>
            </div>
          )}
        </main>
      </div>

    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#1a1a1a',
    color: '#e5e5e5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #2a2a2a',
    background: '#0d0d0d',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerRight: {
    display: 'flex',
    gap: '12px',
  },
  backBtn: {
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    margin: 0,
    color: '#fff',
  },
  noteCount: {
    fontSize: '14px',
    color: '#666',
    background: 'rgba(212, 165, 116, 0.1)',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  syncAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(139, 92, 246, 0.2)',
    border: '1px solid #a78bfa',
    borderRadius: '8px',
    color: '#a78bfa',
    fontSize: '14px',
    cursor: 'pointer',
  },
  syncTimeInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#666',
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
  },
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  // Tags Sidebar
  tagsSidebar: {
    width: '200px',
    borderRight: '1px solid #2a2a2a',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
  },
  tagsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #1f1f1f',
  },
  tagsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  },
  tagItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#aaa',
    fontSize: '14px',
    marginBottom: '2px',
  },
  tagName: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tagCount: {
    fontSize: '12px',
    color: '#666',
    background: 'rgba(255,255,255,0.05)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  noTags: {
    padding: '20px',
    textAlign: 'center',
    color: '#555',
    fontSize: '13px',
  },
  // Notes List Sidebar
  sidebar: {
    width: '320px',
    borderRight: '1px solid #2a2a2a',
    display: 'flex',
    flexDirection: 'column',
    background: '#0d0d0d',
    position: 'relative',
    transition: 'width 0.2s ease',
  },
  sidebarCollapsed: {
    width: '48px',
  },
  collapseBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '6px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    transition: 'all 0.15s',
  },
  collapseBtnCollapsed: {
    position: 'static',
    margin: '12px auto',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    paddingRight: '48px', // 给折叠按钮留出空间
    borderBottom: '1px solid #2a2a2a',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  filterBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: 'rgba(212, 165, 116, 0.1)',
    borderBottom: '1px solid #2a2a2a',
    fontSize: '13px',
    color: '#d4a574',
  },
  clearFilter: {
    padding: '4px',
    background: 'transparent',
    border: 'none',
    color: '#d4a574',
    cursor: 'pointer',
    display: 'flex',
  },
  notesList: {
    flex: 1,
    overflowY: 'auto',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '60px 20px',
    color: '#888',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '60px 20px',
    color: '#555',
    fontSize: '14px',
    textAlign: 'center',
  },
  noteItem: {
    padding: '14px 16px',
    borderBottom: '1px solid #1a1a1a',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
  },
  noteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  noteTitle: {
    fontWeight: '500',
    fontSize: '14px',
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    marginRight: '8px',
  },
  noteMeta: {
    display: 'flex',
    gap: '6px',
    fontSize: '12px',
    color: '#666',
    marginBottom: '6px',
  },
  notePreview: {
    fontSize: '13px',
    color: '#888',
    lineHeight: '1.4',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  noteTags: {
    display: 'flex',
    gap: '4px',
    marginTop: '8px',
    flexWrap: 'wrap',
  },
  noteTagBadge: {
    fontSize: '11px',
    padding: '2px 6px',
    background: 'rgba(212, 165, 116, 0.15)',
    color: '#d4a574',
    borderRadius: '4px',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  noSelection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: '#555',
    fontSize: '16px',
  },
  noteDetail: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #2a2a2a',
    gap: '16px',
  },
  toolbarLeft: {
    flex: 1,
    minWidth: 0,
  },
  toolbarRight: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  toolbarButtons: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: '#22c55e',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  cancelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#d1d1d1',
    fontSize: '13px',
    cursor: 'pointer',
  },
  detailTitle: {
    margin: '0 0 6px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#fff',
  },
  editTitleInline: {
    flex: 1,
    minWidth: 0,
    padding: '10px 14px',
    background: '#2a2a2a',
    border: '2px solid #d4a574',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
    outline: 'none',
    boxSizing: 'border-box',
  },
  detailMeta: {
    display: 'flex',
    gap: '8px',
    fontSize: '13px',
    color: '#666',
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#d1d1d1',
    fontSize: '13px',
    cursor: 'pointer',
  },
  syncBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 24px',
    fontSize: '13px',
    borderBottom: '1px solid',
  },
  noteContent: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
  editArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    height: '100%',
  },
  // Markdown 工具栏
  markdownToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#1f1f1f',
    borderRadius: '8px 8px 0 0',
    borderBottom: '1px solid #333',
  },
  toolbarGroup: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },
  mdToolBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  editorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '200px',
  },
  previewArea: {
    flex: 1,
    padding: '16px',
    background: '#2a2a2a',
    borderRadius: '0 0 8px 8px',
    overflow: 'auto',
  },
  editTitle: {
    padding: '12px 16px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
  },
  editContent: {
    flex: 1,
    padding: '16px',
    background: '#2a2a2a',
    border: 'none',
    borderRadius: '0 0 8px 8px',
    color: '#fff',
    fontSize: '14px',
    fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
    resize: 'none',
    lineHeight: '1.7',
    outline: 'none',
    minHeight: '200px',
  },
  // 来源选择
  sourceSelectWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    position: 'relative',
  },
  sourceSelect: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  sourceValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#fff',
    fontSize: '14px',
  },
  sourceDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    overflow: 'hidden',
    zIndex: 100,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  sourceOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    cursor: 'pointer',
    color: '#e5e5e5',
    fontSize: '14px',
    transition: 'background 0.15s',
  },
  // 标签输入
  tagsInputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    position: 'relative',
  },
  editTagsInput: {
    padding: '12px 16px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  editCommentSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  editLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '500',
    color: '#888',
  },
  editCommentInput: {
    padding: '12px 16px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  // 立即同步按钮
  syncNowBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginLeft: 'auto',
    padding: '4px 10px',
    background: 'rgba(249, 115, 22, 0.2)',
    border: '1px solid #f97316',
    borderRadius: '4px',
    color: '#f97316',
    fontSize: '12px',
    cursor: 'pointer',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '0 24px 16px',
  },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    background: 'rgba(212, 165, 116, 0.15)',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#d4a574',
    cursor: 'pointer',
  },
  comment: {
    padding: '12px 24px',
    borderTop: '1px solid #2a2a2a',
    fontSize: '13px',
    color: '#888',
  },
  
  // 标签平铺选择样式（放在编辑区上方）
  tagsInputWrapperTop: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  tagsHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagsFlatContainerCompact: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '10px 12px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    minHeight: '40px',
  },
  tagsFlatContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '12px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    minHeight: '50px',
  },
  tagFlatItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid #3a3a3a',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#aaa',
    fontSize: '13px',
  },
  tagFlatItemSelected: {
    background: 'rgba(212, 165, 116, 0.25)',
    borderColor: '#d4a574',
    color: '#d4a574',
  },
  tagFlatName: {
    fontWeight: '500',
  },
  tagFlatCount: {
    fontSize: '11px',
    padding: '2px 6px',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    color: '#666',
  },
  tagFlatCountSelected: {
    background: 'rgba(212, 165, 116, 0.3)',
    color: '#d4a574',
  },
  noTagsFlat: {
    color: '#666',
    fontSize: '13px',
    width: '100%',
    textAlign: 'center',
    padding: '8px',
  },
  tagsLoadingFlat: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#888',
    fontSize: '13px',
    width: '100%',
    justifyContent: 'center',
    padding: '8px',
  },
  tagManageRow: {
    marginTop: '8px',
    textAlign: 'right',
  },
  tagManageLinkInline: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    transition: 'color 0.15s',
  },
  
  // Confirm Dialog styles
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(4px)',
  },
  confirmDialog: {
    width: '400px',
    maxWidth: '90vw',
    background: 'linear-gradient(180deg, #252525 0%, #1a1a1a 100%)',
    borderRadius: '16px',
    border: '1px solid #333',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  dialogHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 24px 16px',
    borderBottom: '1px solid #2a2a2a',
  },
  dialogIcon: {
    width: '48px',
    height: '48px',
    marginBottom: '12px',
  },
  dialogTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
  },
  dialogContent: {
    padding: '20px 24px',
  },
  dialogMessage: {
    margin: 0,
    fontSize: '15px',
    color: '#aaa',
    textAlign: 'center',
    lineHeight: '1.6',
  },
  dialogActions: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px 24px',
  },
  dialogCancelBtn: {
    flex: 1,
    padding: '12px 20px',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '10px',
    color: '#aaa',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  dialogConfirmBtn: {
    flex: 1,
    padding: '12px 20px',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};

export default NotesManager;
