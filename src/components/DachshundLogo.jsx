import React from 'react';
import { styles } from '../styles/styles';

const DachshundLogo = () => (
  <div style={styles.logo}>
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
    }}>
      {/* 尾巴 */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: '41px',
        width: '38px',
        height: '15px',
        background: '#A0522D',
        borderRadius: '50px 0 0 50px',
        transformOrigin: 'right center',
        animation: 'wagTail 1s infinite ease-in-out',
      }} />
      
      {/* 身体 */}
      <div style={{
        position: 'absolute',
        left: '22px',
        top: '37px',
        width: '98px',
        height: '34px',
        background: '#D2691E',
        borderRadius: '30px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}>
        {/* 四条腿 */}
        {[11, 30, 50, 69].map((left, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: '11px',
            height: '22px',
            background: '#A0522D',
            borderRadius: '0 0 6px 6px',
            bottom: '-19px',
            left: `${left}px`,
          }} />
        ))}
      </div>
      
      {/* 头部 */}
      <div style={{
        position: 'absolute',
        right: '15px',
        top: '22px',
        width: '45px',
        height: '37px',
        background: '#D2691E',
        borderRadius: '50% 50% 40% 40%',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}>
        {/* 左耳朵 */}
        <div style={{
          position: 'absolute',
          width: '26px',
          height: '34px',
          background: '#A0522D',
          borderRadius: '0 50% 50% 50%',
          left: '-4px',
          top: '4px',
          transform: 'rotate(-20deg)',
        }} />
        
        {/* 右耳朵 */}
        <div style={{
          position: 'absolute',
          width: '26px',
          height: '34px',
          background: '#A0522D',
          borderRadius: '0 50% 50% 50%',
          right: '-4px',
          top: '4px',
          transform: 'rotate(20deg) scaleX(-1)',
        }} />
        
        {/* 眼睛 */}
        {[9, null].map((left, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: '9px',
            height: '9px',
            background: '#2C1810',
            borderRadius: '50%',
            top: '15px',
            ...(i === 0 ? { left: '9px' } : { right: '9px' }),
            animation: 'blink 3s infinite',
          }} />
        ))}
        
        {/* 鼻子 */}
        <div style={{
          position: 'absolute',
          width: '11px',
          height: '9px',
          background: '#2C1810',
          borderRadius: '50%',
          bottom: '11px',
          left: '50%',
          transform: 'translateX(-50%)',
        }} />
      </div>
    </div>
    
    <style>{`
      @keyframes wagTail {
        0%, 100% { transform: rotate(-10deg); }
        50% { transform: rotate(10deg); }
      }
      @keyframes blink {
        0%, 96%, 100% { height: 9px; }
        98% { height: 2px; }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-30px) rotate(10deg); }
      }
    `}</style>
  </div>
);

export default DachshundLogo;



