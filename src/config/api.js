/**
 * 动态获取 API 基础地址
 * - 本地开发时使用 localhost:8080
 * - 生产环境自动使用当前域名（前后端同域部署）
 */
const getApiBaseUrl = () => {
  const { hostname, protocol } = window.location;
  
  // 本地开发环境
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8080';
  }
  
  // 生产环境：使用当前域名（假设前后端同域部署，后端在 /api 路径或同端口）
  // 如果后端部署在不同端口，可以改为: return `${protocol}//${hostname}:8080`;
  return `${protocol}//${hostname}`;
};

export const API_BASE_URL = getApiBaseUrl();

// 调试用：在控制台打印当前 API 地址
console.log('API_BASE_URL:', API_BASE_URL);

