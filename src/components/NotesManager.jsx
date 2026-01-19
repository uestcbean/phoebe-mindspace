import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, Lightbulb, RefreshCw, Edit3, Trash2, Check, X, Clock, 
  CheckCircle, AlertCircle, Search, Tag, Hash
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { authFetch } from '../utils/auth';
import MarkdownRenderer from './MarkdownRenderer';

/**
 * Inspiration Manager - View, edit, and sync inspirations (notes) to knowledge base.
 * Features: Tag-based categorization and filtering.
 */
const NotesManager = ({ user, onBack }) => {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editComment, setEditComment] = useState('');
  const [syncStatus, setSyncStatus] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null); // null = all

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

  // Delete a note
  const deleteNote = async (noteId) => {
    if (!confirm('确定要删除这条灵感吗？')) return;
    
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
  };

  // Start editing
  const startEdit = (note) => {
    setEditTitle(note.title || '');
    setEditContent(note.content || '');
    setEditComment(note.comment || '');
    try {
      const tags = JSON.parse(note.tags || '[]');
      setEditTags(tags.join(', '));
    } catch (e) {
      setEditTags('');
    }
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
    setEditTags('');
    setEditComment('');
  };

  // Save edit
  const saveEdit = async () => {
    if (!selectedNote) return;
    
    try {
      const tagsArray = editTags.split(',').map(t => t.trim()).filter(t => t);
      const res = await authFetch(`${API_BASE_URL}/api/v1/notes/${selectedNote.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          comment: editComment,
          tags: tagsArray,
          source: selectedNote.source,
        }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
        setSelectedNote(updated);
        cancelEdit();
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
        .spin { animation: spin 1s linear infinite; }
        .note-item:hover { background: rgba(255,255,255,0.05) !important; }
        .note-item.selected { background: rgba(212, 165, 116, 0.15) !important; border-left-color: #d4a574 !important; }
        .tag-item:hover { background: rgba(255,255,255,0.08) !important; }
        .tag-item.selected { background: rgba(212, 165, 116, 0.2) !important; color: #d4a574 !important; }
      `}</style>

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
        <aside style={styles.sidebar}>
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
              <span>筛选: {selectedTag}</span>
              <button style={styles.clearFilter} onClick={() => setSelectedTag(null)}>
                <X size={14} />
              </button>
            </div>
          )}

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
                    <span>{note.source}</span>
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
                      <button style={{ ...styles.toolBtn, color: '#ef4444' }} onClick={() => deleteNote(selectedNote.id)}>
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
                    : 'rgba(234, 179, 8, 0.1)',
                  borderColor: syncStatus[selectedNote.id].synced ? '#22c55e' : '#eab308',
                }}>
                  {syncStatus[selectedNote.id].synced ? (
                    <>
                      <CheckCircle size={16} style={{ color: '#22c55e' }} />
                      <span>已同步到知识库</span>
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
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="灵感内容（支持 Markdown）"
                      style={styles.editContent}
                    />
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="标签（用逗号分隔，如：AI, 日记, 想法）"
                      style={styles.editTagsInput}
                    />
                    <div style={styles.editCommentSection}>
                      <label style={styles.editLabel}>备注</label>
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

              {/* Comment */}
              {selectedNote.comment && (
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
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
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
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'none',
    lineHeight: '1.6',
  },
  editTagsInput: {
    padding: '12px 16px',
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
  },
  editCommentSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  editLabel: {
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
};

export default NotesManager;
