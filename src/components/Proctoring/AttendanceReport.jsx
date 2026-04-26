import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';

const KeyboardIcon = ({ fill = "#9152EE" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
    <line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/>
    <line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/>
    <line x1="6" y1="12" x2="6.01" y2="12"/><line x1="10" y1="12" x2="10.01" y2="12"/>
    <line x1="14" y1="12" x2="14.01" y2="12"/><line x1="18" y1="12" x2="18.01" y2="12"/>
    <line x1="7" y1="16" x2="17" y2="16"/>
  </svg>
);

const FaceIcon = ({ fill = "#40E5D1" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
    <line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
  </svg>
);

const AlertIcon = ({ fill = "#F08083" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const ClockIcon = ({ fill = "#60a5fa" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ShieldIcon = ({ fill = "#34d399" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const AttendanceReport = ({ userId }) => {
  const [stats, setStats] = useState({
    totalMinutes: 0,
    totalKeystrokes: 0,
    integrityScore: 100,
    faceMissingSeconds: 0,
    violations: 0,
    loginTime: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchStats = async () => {
    if (!userId) { setLoading(false); return; }
    try {
      // Get session stats from MongoDB
      const sessionsRes = await invoke("cloud_sync_get", {
        collectionName: "sessions",
        filter: { user_id: userId }
      });

      // Get proctoring event count from MongoDB
      const proctoringRes = await invoke("cloud_sync_get", {
        collectionName: "proctoring_events",
        filter: { user_id: userId }
      });

      if (sessionsRes && Array.isArray(sessionsRes)) {
        let totalMinutes = 0;
        let totalKeystrokes = 0;
        let totalIntegrity = 0;
        let integrityCount = 0;
        let totalFaceMissing = 0;
        let firstLogin = null;

        sessionsRes.forEach(s => {
          totalMinutes += (s.total_minutes || 0);
          totalKeystrokes += (s.total_keystrokes || 0);
          if (s.integrity_score) {
            totalIntegrity += s.integrity_score;
            integrityCount++;
          }
          totalFaceMissing += (s.face_missing_duration || 0);
          if (!firstLogin || new Date(s.login_time) < new Date(firstLogin)) {
            firstLogin = s.login_time;
          }
        });

        setStats({
          totalMinutes: Math.round(totalMinutes),
          totalKeystrokes: totalKeystrokes,
          integrityScore: integrityCount > 0 ? Math.round(totalIntegrity / integrityCount) : 100,
          faceMissingSeconds: totalFaceMissing,
          violations: Array.isArray(proctoringRes) ? proctoringRes.length : 0,
          loginTime: firstLogin,
        });
      }
    } catch (e) {
      console.error("Failed to fetch report stats from MongoDB:", e);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [userId]);

  const totalHours = Math.floor(stats.totalMinutes / 60);
  const totalMinsRemainder = Math.round(stats.totalMinutes % 60);
  
  const scoreColor = stats.integrityScore >= 85 ? '#34d399' : stats.integrityScore >= 65 ? '#fbbf24' : '#f87171';
  const scoreBg = stats.integrityScore >= 85 ? 'rgba(52,211,153,0.1)' : stats.integrityScore >= 65 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)';
  const scoreLabel = stats.integrityScore >= 85 ? 'Excellent' : stats.integrityScore >= 65 ? 'Warning' : 'Critical';

  const metrics = [
    { id: 'time', label: 'Session Time', value: `${totalHours}h ${totalMinsRemainder}m`, Icon: ClockIcon, color: '#60a5fa', delay: 0.1 },
    { id: 'keystrokes', label: 'Total Keystrokes', value: stats.totalKeystrokes.toLocaleString(), Icon: KeyboardIcon, color: '#9152EE', delay: 0.15 },
    { id: 'integrity', label: 'Integrity Score', value: `${stats.integrityScore}%`, Icon: ShieldIcon, color: scoreColor, delay: 0.25 },
    { id: 'alerts', label: 'Security Alerts', value: stats.violations.toString(), Icon: AlertIcon, color: stats.violations > 0 ? '#f87171' : '#34d399', delay: 0.3 },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 80, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
    }}>
      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '1.5rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', margin: 0 }}>Attendance & Integrity Report</h2>
          <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0' }}>
            {stats.loginTime ? `Session started: ${new Date(stats.loginTime).toLocaleString()}` : 'No active sessions recorded'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
          <div style={{
            padding: '0.35rem 0.9rem',
            borderRadius: 50,
            border: '1px solid rgba(52,211,153,0.3)',
            background: 'rgba(52,211,153,0.1)',
            color: '#34d399',
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
          }}>● LIVE</div>
          <div style={{ fontSize: '0.65rem', color: '#475569' }}>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </motion.div>

      {/* Score Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        style={{
          background: scoreBg,
          border: `1px solid ${scoreColor}30`,
          borderRadius: 20,
          padding: '1.5rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>
            Overall Integrity Grade
          </div>
          <div style={{ fontSize: '3.5rem', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
            {stats.integrityScore}%
          </div>
        </div>
        <div style={{
          padding: '0.6rem 1.5rem',
          borderRadius: 12,
          background: scoreColor + '20',
          border: `1px solid ${scoreColor}40`,
          color: scoreColor,
          fontWeight: 800,
          fontSize: '1rem',
          letterSpacing: '0.05em',
        }}>
          {scoreLabel}
        </div>
      </motion.div>

      {/* Metric Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {metrics.map((metric) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: metric.delay }}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'background 0.2s, border-color 0.2s',
              cursor: 'default',
            }}
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: metric.color + '15',
                border: `1px solid ${metric.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <metric.Icon fill={metric.color} />
              </div>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>{metric.label}</span>
            </div>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', fontFamily: 'monospace' }}>
              {metric.value}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          background: 'rgba(251,191,36,0.07)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 14,
          color: '#fbbf24',
        }}
      >
        <AlertIcon fill="#fbbf24" />
        <p style={{ fontSize: '0.78rem', margin: 0, lineHeight: 1.6, color: '#d1a332' }}>
          <strong style={{ color: '#fbbf24' }}>Auto-Logout Policy:</strong> If your face is not detected by the camera for more than <strong style={{ color: '#fbbf24' }}>3 minutes</strong>, you will be automatically logged out to maintain session integrity and protect company data.
        </p>
      </motion.div>
    </div>
  );
};

export default AttendanceReport;
