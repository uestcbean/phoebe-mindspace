import React, { useState } from 'react';
import { styles } from '../styles/styles';
import { API_BASE_URL } from '../config/api';

const RegisterForm = ({ onRegisterSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    nickname: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async () => {
    if (!formData.username || formData.username.length < 2 || formData.username.length > 50) {
      setError('用户名必须在2-50个字符之间');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const user = await response.json();
        onRegisterSuccess(user);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '注册失败,请重试');
      }
    } catch (err) {
      setError('网络错误,请检查后端服务是否启动');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={{ color: '#6B4423', textAlign: 'center', marginBottom: '30px', fontSize: '2em' }}>
        🐾 欢迎加入 Phoebe mindSpace
      </h2>
      
      {error && <div style={styles.error}>{error}</div>}
      
      <div>
        <div style={styles.formGroup}>
          <label style={styles.label}>用户名 *</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            style={styles.input}
            placeholder="请输入用户名 (2-50字符)"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>昵称</label>
          <input
            type="text"
            name="nickname"
            value={formData.nickname}
            onChange={handleChange}
            style={styles.input}
            placeholder="给自己起个可爱的昵称吧"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>邮箱</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            style={styles.input}
            placeholder="your@email.com"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>手机号</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            style={styles.input}
            placeholder="可选"
          />
        </div>

        <button
          onClick={handleSubmit}
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          disabled={loading}
        >
          {loading ? '注册中...' : '开始我的陪伴之旅 🐶'}
        </button>
      </div>
    </div>
  );
};

export default RegisterForm;



