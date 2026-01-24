import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, User, Tag, Plus, Trash2, Edit3, Check, X, Hash, 
  Mail, Phone, LogOut, Settings, Palette, AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { authFetch, clearAuth } from '../utils/auth';

/**
 * User Profile Page - Personal info management and tag management
 */
const UserProfile = ({ user, onBack, onLogout, onUserUpdate }) => {
  // User edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    nickname: user.nickname || '',
    email: user.email || '',
    phone: user.phone || '',
  });

  // Tags state
  const [userTags, setUserTags] = useState([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagForm, setEditingTagForm] = useState({ name: '', color: '', description: '' });
  const [tagError, setTagError] = useState('');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    visible: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'warning', // 'warning' | 'danger' | 'info'
  });

  // Predefined colors for tags
  const TAG_COLORS = [
    '#d4a574', '#ef4444', '#f97316', '#eab308', '#22c55e', 
    '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
  ];

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

  useEffect(() => {
    loadUserTags();
  }, [loadUserTags]);

  // Add new tag
  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      setTagError('请输入标签名称');
      return;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/tags`, {
        method: 'POST',
        body: JSON.stringify({ 
          name, 
          color: newTagColor || null 
        }),
      });

      if (res.ok) {
        const newTag = await res.json();
        setUserTags(prev => [newTag, ...prev]);
        setNewTagName('');
        setNewTagColor('');
        setTagError('');
      } else {
        const err = await res.json();
        setTagError(err.error || '添加标签失败');
      }
    } catch (e) {
      console.error('Failed to add tag:', e);
      setTagError('网络错误，请重试');
    }
  };

  // Show confirm dialog
  const showConfirm = (title, message, onConfirm, type = 'warning') => {
    setConfirmDialog({
      visible: true,
      title,
      message,
      onConfirm,
      type,
    });
  };

  // Close confirm dialog
  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, visible: false }));
  };

  // Delete tag with custom confirm dialog
  const handleDeleteTag = (tagId, tagName) => {
    showConfirm(
      '删除标签',
      `确定要删除标签"${tagName}"吗？删除后不可恢复。`,
      async () => {
        closeConfirmDialog();
        try {
          const res = await authFetch(`${API_BASE_URL}/api/v1/tags/${tagId}`, {
            method: 'DELETE',
          });

          if (res.ok) {
            setUserTags(prev => prev.filter(t => t.id !== tagId));
          } else {
            const err = await res.json();
            showConfirm('删除失败', err.error || '删除标签失败，请重试', closeConfirmDialog, 'danger');
          }
        } catch (e) {
          console.error('Failed to delete tag:', e);
          showConfirm('网络错误', '请检查网络连接后重试', closeConfirmDialog, 'danger');
        }
      },
      'danger'
    );
  };

  // Start editing tag
  const startEditTag = (tag) => {
    setEditingTagId(tag.id);
    setEditingTagForm({
      name: tag.name,
      color: tag.color || '',
      description: tag.description || '',
    });
  };

  // Save edited tag
  const handleSaveTag = async () => {
    if (!editingTagForm.name.trim()) {
      alert('标签名称不能为空');
      return;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/api/v1/tags/${editingTagId}`, {
        method: 'PUT',
        body: JSON.stringify(editingTagForm),
      });

      if (res.ok) {
        const updated = await res.json();
        setUserTags(prev => prev.map(t => t.id === editingTagId ? updated : t));
        setEditingTagId(null);
        setEditingTagForm({ name: '', color: '', description: '' });
      } else {
        const err = await res.json();
        alert(err.error || '更新失败');
      }
    } catch (e) {
      console.error('Failed to update tag:', e);
      alert('网络错误，请重试');
    }
  };

  // Cancel editing
  const cancelEditTag = () => {
    setEditingTagId(null);
    setEditingTagForm({ name: '', color: '', description: '' });
  };

  // Update profile (placeholder - would need backend API)
  const handleSaveProfile = async () => {
    // TODO: Call backend API to update user profile
    setIsEditingProfile(false);
    if (onUserUpdate) {
      onUserUpdate({ ...user, ...profileForm });
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .tag-item:hover { background: rgba(255,255,255,0.05) !important; }
        .tag-item:hover .tag-actions { opacity: 1 !important; }
        .color-option:hover { transform: scale(1.15); }
        .color-option.selected { transform: scale(1.15); box-shadow: 0 0 0 2px #fff; }
        .profile-field:hover { background: rgba(255,255,255,0.03) !important; }
        .confirm-dialog { animation: fadeIn 0.2s ease-out; }
        .confirm-btn:hover { opacity: 0.9 !important; }
        .confirm-cancel:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      {/* Custom Confirm Dialog */}
      {confirmDialog.visible && (
        <div style={styles.dialogOverlay} onClick={closeConfirmDialog}>
          <div 
            className="confirm-dialog"
            style={styles.confirmDialog} 
            onClick={e => e.stopPropagation()}
          >
            {/* Dialog Header with Icon */}
            <div style={styles.dialogHeader}>
              <img 
                src={`${API_BASE_URL}/icon48.png`} 
                alt="Phoebe" 
                style={styles.dialogIcon}
              />
              <h3 style={styles.dialogTitle}>{confirmDialog.title}</h3>
            </div>
            
            {/* Dialog Content */}
            <div style={styles.dialogContent}>
              <p style={styles.dialogMessage}>{confirmDialog.message}</p>
            </div>
            
            {/* Dialog Actions */}
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
          <Settings size={24} style={{ color: '#d4a574' }} />
          <h1 style={styles.title}>个人中心</h1>
        </div>
        <button style={styles.logoutBtn} onClick={onLogout}>
          <LogOut size={16} />
          退出登录
        </button>
      </header>

      <div style={styles.content}>
        {/* User Profile Section */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              <User size={18} style={{ color: '#d4a574' }} />
              个人信息
            </h2>
            {!isEditingProfile && (
              <button style={styles.editBtn} onClick={() => setIsEditingProfile(true)}>
                <Edit3 size={14} />
                编辑
              </button>
            )}
          </div>

          <div style={styles.profileCard}>
            {/* Avatar */}
            <div style={styles.avatarSection}>
              <div style={styles.avatar}>
                {(user.nickname || user.username || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={styles.userBasic}>
                <div style={styles.username}>{user.username}</div>
                <div style={styles.userId}>ID: {user.id}</div>
              </div>
            </div>

            {/* Profile Fields */}
            <div style={styles.profileFields}>
              {isEditingProfile ? (
                <>
                  <div style={styles.formField}>
                    <label style={styles.fieldLabel}>昵称</label>
                    <input
                      type="text"
                      value={profileForm.nickname}
                      onChange={(e) => setProfileForm({ ...profileForm, nickname: e.target.value })}
                      style={styles.fieldInput}
                      placeholder="设置昵称"
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.fieldLabel}>邮箱</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      style={styles.fieldInput}
                      placeholder="设置邮箱"
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.fieldLabel}>手机</label>
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      style={styles.fieldInput}
                      placeholder="设置手机号"
                    />
                  </div>
                  <div style={styles.formActions}>
                    <button style={styles.cancelBtn} onClick={() => setIsEditingProfile(false)}>
                      取消
                    </button>
                    <button style={styles.saveBtn} onClick={handleSaveProfile}>
                      保存
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="profile-field" style={styles.profileField}>
                    <div style={styles.fieldIcon}><User size={16} /></div>
                    <div style={styles.fieldContent}>
                      <div style={styles.fieldLabel}>昵称</div>
                      <div style={styles.fieldValue}>{user.nickname || '未设置'}</div>
                    </div>
                  </div>
                  <div className="profile-field" style={styles.profileField}>
                    <div style={styles.fieldIcon}><Mail size={16} /></div>
                    <div style={styles.fieldContent}>
                      <div style={styles.fieldLabel}>邮箱</div>
                      <div style={styles.fieldValue}>{user.email || '未设置'}</div>
                    </div>
                  </div>
                  <div className="profile-field" style={styles.profileField}>
                    <div style={styles.fieldIcon}><Phone size={16} /></div>
                    <div style={styles.fieldContent}>
                      <div style={styles.fieldLabel}>手机</div>
                      <div style={styles.fieldValue}>{user.phone || '未设置'}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Tags Management Section */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              <Tag size={18} style={{ color: '#d4a574' }} />
              标签管理
            </h2>
            <span style={styles.tagCount}>{userTags.length} 个标签</span>
          </div>

          {/* Add New Tag */}
          <div style={styles.addTagCard}>
            <div style={styles.addTagRow}>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => { setNewTagName(e.target.value); setTagError(''); }}
                placeholder="输入新标签名称..."
                style={styles.addTagInput}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              />
              <button 
                style={styles.addTagBtn}
                onClick={handleAddTag}
                disabled={!newTagName.trim()}
              >
                <Plus size={16} />
                添加
              </button>
            </div>
            
            {/* Color Selection */}
            <div style={styles.colorSection}>
              <span style={styles.colorLabel}>
                <Palette size={14} />
                选择颜色（可选）
              </span>
              <div style={styles.colorOptions}>
                <div
                  className={`color-option ${!newTagColor ? 'selected' : ''}`}
                  style={{ ...styles.colorOption, background: '#3a3a3a' }}
                  onClick={() => setNewTagColor('')}
                  title="默认"
                />
                {TAG_COLORS.map(color => (
                  <div
                    key={color}
                    className={`color-option ${newTagColor === color ? 'selected' : ''}`}
                    style={{ ...styles.colorOption, background: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
            </div>

            {tagError && (
              <div style={styles.errorMsg}>
                <AlertCircle size={14} />
                {tagError}
              </div>
            )}
          </div>

          {/* Tags List */}
          <div style={styles.tagsList}>
            {isLoadingTags ? (
              <div style={styles.loading}>加载中...</div>
            ) : userTags.length === 0 ? (
              <div style={styles.emptyTags}>
                <Tag size={32} style={{ opacity: 0.3 }} />
                <span>暂无标签</span>
                <span style={styles.emptyHint}>在上方添加标签，编辑笔记时可快速选择</span>
              </div>
            ) : (
              userTags.map(tag => (
                <div key={tag.id} className="tag-item" style={styles.tagItem}>
                  {editingTagId === tag.id ? (
                    // Edit mode
                    <div style={styles.tagEditForm}>
                      <input
                        type="text"
                        value={editingTagForm.name}
                        onChange={(e) => setEditingTagForm({ ...editingTagForm, name: e.target.value })}
                        style={styles.tagEditInput}
                        autoFocus
                      />
                      <div style={styles.colorOptions}>
                        <div
                          className={`color-option ${!editingTagForm.color ? 'selected' : ''}`}
                          style={{ ...styles.colorOptionSmall, background: '#3a3a3a' }}
                          onClick={() => setEditingTagForm({ ...editingTagForm, color: '' })}
                        />
                        {TAG_COLORS.map(color => (
                          <div
                            key={color}
                            className={`color-option ${editingTagForm.color === color ? 'selected' : ''}`}
                            style={{ ...styles.colorOptionSmall, background: color }}
                            onClick={() => setEditingTagForm({ ...editingTagForm, color })}
                          />
                        ))}
                      </div>
                      <div style={styles.tagEditActions}>
                        <button style={styles.tagEditSave} onClick={handleSaveTag}>
                          <Check size={14} />
                        </button>
                        <button style={styles.tagEditCancel} onClick={cancelEditTag}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div style={styles.tagInfo}>
                        <div 
                          style={{ 
                            ...styles.tagColorDot, 
                            background: tag.color || '#d4a574' 
                          }} 
                        />
                        <span style={styles.tagName}>{tag.name}</span>
                        {tag.usageCount > 0 && (
                          <span style={styles.tagUsage}>{tag.usageCount} 篇</span>
                        )}
                      </div>
                      <div className="tag-actions" style={styles.tagActions}>
                        <button 
                          style={styles.tagActionBtn}
                          onClick={() => startEditTag(tag)}
                          title="编辑"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          style={{ ...styles.tagActionBtn, color: '#ef4444' }}
                          onClick={() => handleDeleteTag(tag.id, tag.name)}
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
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
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '14px',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  section: {
    marginBottom: '32px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: 0,
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  editBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    color: '#888',
    fontSize: '13px',
    cursor: 'pointer',
  },
  tagCount: {
    fontSize: '13px',
    color: '#666',
    background: 'rgba(212, 165, 116, 0.1)',
    padding: '4px 10px',
    borderRadius: '12px',
  },
  profileCard: {
    background: '#252525',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #333',
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    paddingBottom: '20px',
    borderBottom: '1px solid #333',
    marginBottom: '20px',
  },
  avatar: {
    width: '64px',
    height: '64px',
    background: 'linear-gradient(135deg, #d4a574, #c4916a)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1a1a1a',
    fontSize: '24px',
    fontWeight: '600',
  },
  userBasic: {},
  username: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '4px',
  },
  userId: {
    fontSize: '13px',
    color: '#666',
  },
  profileFields: {},
  profileField: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '4px',
  },
  fieldIcon: {
    width: '36px',
    height: '36px',
    background: 'rgba(212, 165, 116, 0.1)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#d4a574',
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '2px',
  },
  fieldValue: {
    fontSize: '14px',
    color: '#e5e5e5',
  },
  formField: {
    marginBottom: '16px',
  },
  fieldInput: {
    width: '100%',
    padding: '10px 12px',
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    marginTop: '6px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    background: 'transparent',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    color: '#888',
    fontSize: '14px',
    cursor: 'pointer',
  },
  saveBtn: {
    flex: 1,
    padding: '10px',
    background: '#d4a574',
    border: 'none',
    borderRadius: '6px',
    color: '#1a1a1a',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  
  // Tags styles
  addTagCard: {
    background: '#252525',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #333',
    marginBottom: '16px',
  },
  addTagRow: {
    display: 'flex',
    gap: '10px',
  },
  addTagInput: {
    flex: 1,
    padding: '10px 14px',
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  addTagBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 18px',
    background: '#d4a574',
    border: 'none',
    borderRadius: '8px',
    color: '#1a1a1a',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  colorSection: {
    marginTop: '12px',
  },
  colorLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#888',
    marginBottom: '10px',
  },
  colorOptions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  colorOption: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'transform 0.15s',
  },
  colorOptionSmall: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'transform 0.15s',
  },
  errorMsg: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '12px',
    padding: '10px 12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#ef4444',
    fontSize: '13px',
  },
  tagsList: {
    background: '#252525',
    borderRadius: '12px',
    border: '1px solid #333',
    overflow: 'hidden',
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: '#666',
  },
  emptyTags: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '40px',
    color: '#666',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: '13px',
    color: '#555',
  },
  tagItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #333',
  },
  tagInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  tagColorDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  tagName: {
    fontSize: '14px',
    color: '#e5e5e5',
  },
  tagUsage: {
    fontSize: '12px',
    color: '#666',
    background: 'rgba(255,255,255,0.05)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  tagActions: {
    display: 'flex',
    gap: '4px',
    opacity: 0,
    transition: 'opacity 0.15s',
  },
  tagActionBtn: {
    padding: '6px',
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    borderRadius: '4px',
    display: 'flex',
  },
  tagEditForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
  },
  tagEditInput: {
    flex: 1,
    padding: '8px 12px',
    background: '#1a1a1a',
    border: '1px solid #d4a574',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  tagEditActions: {
    display: 'flex',
    gap: '4px',
  },
  tagEditSave: {
    padding: '8px',
    background: '#22c55e',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
  },
  tagEditCancel: {
    padding: '8px',
    background: '#333',
    border: 'none',
    borderRadius: '6px',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
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

export default UserProfile;
