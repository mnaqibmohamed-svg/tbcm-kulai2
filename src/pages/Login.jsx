import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient'; // Pastikan path ini betul
import './Login.css';

const LoginScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(''); // Kosongkan ralat sebelum mencuba lagi

    try {
      // 1. Proses Log Masuk dengan Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      // 2. Jika berjaya, semak peranan (role) pengguna dari jadual 'profiles'
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, clinic')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      // 3. Halakan pengguna mengikut peranan mereka
      if (profile.role === 'PPKP') {
        navigate('/ppkp');
      } else if (profile.role === 'PR1') {
        navigate('/pr1');
      } else if (profile.role === 'Admin') {
        navigate('/admin');
      } else {
        // Jika akaun baru didaftar tapi admin belum set role
        setErrorMsg('Akaun anda belum diberikan akses (Role). Sila hubungi Admin.');
        await supabase.auth.signOut(); // Log keluar automatik
      }
      
    } catch (error) {
      // Paparkan mesej ralat jika e-mel/kata laluan salah
      if (error.message === 'Invalid login credentials') {
        setErrorMsg('E-mel atau kata laluan tidak sah.');
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-container">
      <div className="login-card">
        <div className="login-logo-panel">
          <img src="/logo-pkd.jpg" alt="Logo PKD Kulai" className="pkd-logo" /> 
        </div>

        <div className="login-form-panel">
          <div className="login-header">
            <h1 className="system-title">TBCM KULAI</h1>
            <p className="system-subtitle">Sistem Kawalan Tibi Daerah Kulai</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            
            {/* Paparan mesej ralat jika log masuk gagal */}
            {errorMsg && (
              <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px', textAlign: 'center', border: '1px solid #f87171' }}>
                {errorMsg}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">E-mel Staf</label>
              <div className="input-group">
                <span className="input-icon">✉️</span>
                <input 
                  type="email" 
                  id="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="contoh: pr1@kulai.com" 
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Kata Laluan</label>
              <div className="input-group">
                <span className="input-icon">🔒</span>
                <input 
                  type="password" 
                  id="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Masukkan kata laluan" 
                  required 
                />
              </div>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'MEMPROSES...' : 'LOG MASUK'}
            </button>
          </form>
        </div>
      </div>
      
      <div className="login-footer">
        <p>Pejabat Kesihatan Daerah Kulai. Hak Cipta Terpelihara © 2026.</p>
        <p className="community-slogan">"KEPRIHATINAN KESIHATAN KESEJAHTERAAN KOMUNITI"</p>
      </div>
    </div>
  );
};

export default LoginScreen;