import React, { useState } from 'react';
import { User, Lock, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { saveAuth } from '../utils/auth';

const LoginForm = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || formData.username.length < 2) {
      setError('请输入用户名');
      return;
    }

    if (!formData.password) {
      setError('请输入密码');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        // Save token and user info
        saveAuth(data.token, data);
        onLoginSuccess(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '登录失败，请检查用户名和密码');
      }
    } catch (err) {
      setError('网络错误，请检查后端服务是否启动');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        input::placeholder { color: #666; }
        input:focus { border-color: #d4a574 !important; outline: none; }
        button:hover:not(:disabled) { opacity: 0.9; }
      `}</style>

      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>✦</div>
          <h1 style={styles.title}>Phoebe</h1>
          <p style={styles.subtitle}>你的智能学习伙伴</p>
        </div>

        <form style={styles.form} onSubmit={handleSubmit}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.inputGroup}>
            <User size={18} style={styles.inputIcon} />
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="用户名"
              style={styles.input}
              autoComplete="username"
            />
          </div>

          <div style={styles.inputGroup}>
            <Lock size={18} style={styles.inputIcon} />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="密码"
              style={styles.input}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
          >
            {loading ? '登录中...' : (
              <>
                开始对话
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a1a',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    background: '#212121',
    borderRadius: '16px',
    padding: '40px 36px',
    border: '1px solid #2a2a2a',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logo: {
    fontSize: '40px',
    color: '#d4a574',
    marginBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#e5e5e5',
    marginBottom: '8px',
    fontFamily: 'Georgia, serif',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#666',
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 44px',
    background: '#171717',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    color: '#e5e5e5',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  button: {
    width: '100%',
    padding: '14px',
    background: '#d4a574',
    border: 'none',
    borderRadius: '10px',
    color: '#1a1a1a',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '8px',
  },
  error: {
    padding: '12px 14px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '13px',
    textAlign: 'center',
  },
};

export default LoginForm;
