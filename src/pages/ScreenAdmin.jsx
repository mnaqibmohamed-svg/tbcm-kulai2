import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'; 

export default function ScreenAdmin() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [indexCases, setIndexCases] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [filterKlinik, setFilterKlinik] = useState('Semua');

  useEffect(() => { checkAdminAccess(); }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/'); return; }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    
    if (profile && profile.role === 'Admin') {
      setCurrentUser(profile);
      fetchAllData();
    } else {
      alert('Akses Ditolak: Anda bukan Admin.');
      navigate('/');
    }
  };

  const fetchAllData = async () => {
    const { data: casesData } = await supabase.from('index_cases').select('*').order('created_at', { ascending: false });
    const { data: contactsData } = await supabase.from('contacts').select('*').order('created_at', { ascending: true });
    const { data: profilesData } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });

    if (casesData) setIndexCases(casesData);
    if (contactsData) setAllContacts(contactsData);
    if (profilesData) setProfiles(profilesData);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

  const updateProfile = async (id, field, value) => {
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', id);
    if (error) alert('Gagal kemaskini: ' + error.message);
    else fetchAllData();
  };

  // ==========================================
  // --- EXPORT EXCEL TERPERINCI
  // ==========================================
  const handleExportExcel = () => {
    const exportData = [];
    
    // Format Masa Lengkap (Tarikh & Masa Daftar)
    const formatDateTime = (dateString) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    };
    
    // Format Tarikh Sahaja
    const formatDateOnly = (dateString) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    let dataToExport = filterKlinik === 'Semua' ? indexCases : indexCases.filter(kes => kes.klinik === filterKlinik);

    dataToExport.forEach(kes => {
      const caseContacts = allContacts.filter(c => c.index_case_id === kes.id);
      
      const baseCaseData = {
        'Tarikh & Masa Daftar': formatDateTime(kes.created_at),
        'No Daftar Tibi': kes.no_daftar_tibi || '-',
        'Klinik': kes.klinik,
        'Kategori Indeks': kes.kategori,
        'Nama Indeks': kes.nama,
        'No K/P Indeks': kes.ic_no,
        'No Tel Indeks': kes.no_tel || '-',
        'Alamat Indeks': kes.alamat || '-',
        'Tarikh Notifikasi': formatDateOnly(kes.tarikh_notifikasi),
        'Tarikh Diagnosis': formatDateOnly(kes.tarikh_diagnosis),
        'Status Kes': kes.is_finished ? 'Selesai' : 'Pemantauan',
      };

      if (caseContacts.length === 0) {
        exportData.push({
          ...baseCaseData,
          'Nama Kontak': 'TIADA KONTAK', 'No K/P Kontak': '-', 'No Tel Kontak': '-', 'Alamat Kontak': '-', 'Status TB Kontak': '-',
          'Tarikh S1 (Asal)': '-', 'Tarikh S1 (Baru)': '-', 'Tarikh Hadir S1': '-', 'IGRA S1': '-', 'Mantoux S1': '-', 'CXR S1': '-',
          'Tarikh S2 (Asal)': '-', 'Tarikh S2 (Baru)': '-', 'Tarikh Hadir S2': '-', 'IGRA S2': '-', 'Mantoux S2': '-', 'CXR S2': '-',
          'Tarikh S3 (Asal)': '-', 'Tarikh S3 (Baru)': '-', 'Tarikh Hadir S3': '-', 'IGRA S3': '-', 'Mantoux S3': '-', 'CXR S3': '-',
          'Tarikh S4 (Asal)': '-', 'Tarikh S4 (Baru)': '-', 'Tarikh Hadir S4': '-', 'IGRA S4': '-', 'Mantoux S4': '-', 'CXR S4': '-'
        });
      } else {
        caseContacts.forEach(kontak => {
          exportData.push({
            ...baseCaseData,
            'Nama Kontak': kontak.nama,
            'No K/P Kontak': kontak.ic_no || '-',
            'No Tel Kontak': kontak.no_tel || '-',
            'Alamat Kontak': kontak.alamat || '-',
            'Status TB Kontak': kontak.status_tb || 'Dalam Saringan',
            
            'Tarikh S1 (Asal)': formatDateOnly(kontak.tarikh_saringan_1), 'Tarikh S1 (Baru)': formatDateOnly(kontak.tarikh_saringan_1_baru), 'Tarikh Hadir S1': formatDateOnly(kontak.tarikh_hadir_1), 'IGRA S1': kontak.igra_1 || '-', 'Mantoux S1': kontak.mantoux_1 || '-', 'CXR S1': kontak.cxr_1 || '-',
            'Tarikh S2 (Asal)': formatDateOnly(kontak.tarikh_saringan_2), 'Tarikh S2 (Baru)': formatDateOnly(kontak.tarikh_saringan_2_baru), 'Tarikh Hadir S2': formatDateOnly(kontak.tarikh_hadir_2), 'IGRA S2': kontak.igra_2 || '-', 'Mantoux S2': kontak.mantoux_2 || '-', 'CXR S2': kontak.cxr_2 || '-',
            'Tarikh S3 (Asal)': formatDateOnly(kontak.tarikh_saringan_3), 'Tarikh S3 (Baru)': formatDateOnly(kontak.tarikh_saringan_3_baru), 'Tarikh Hadir S3': formatDateOnly(kontak.tarikh_hadir_3), 'IGRA S3': kontak.igra_3 || '-', 'Mantoux S3': kontak.mantoux_3 || '-', 'CXR S3': kontak.cxr_3 || '-',
            'Tarikh S4 (Asal)': formatDateOnly(kontak.tarikh_saringan_4), 'Tarikh S4 (Baru)': formatDateOnly(kontak.tarikh_saringan_4_baru), 'Tarikh Hadir S4': formatDateOnly(kontak.tarikh_hadir_4), 'IGRA S4': kontak.igra_4 || '-', 'Mantoux S4': kontak.mantoux_4 || '-', 'CXR S4': kontak.cxr_4 || '-'
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan_TBCM");
    XLSX.writeFile(workbook, `Laporan_Lengkap_TBCM_${filterKlinik.replace(/\s+/g, '_')}.xlsx`);
  };

  // ==========================================
  // --- LOGIK KPI (PENGIRAAN TERPERINCI) ---
  // ==========================================
  const filteredCases = filterKlinik === 'Semua' ? indexCases : indexCases.filter(k => k.klinik === filterKlinik);
  const filteredContacts = allContacts.filter(c => filteredCases.some(kes => kes.id === c.index_case_id));

  const kpiIndeks = filteredCases.length;
  const indeksSP = filteredCases.filter(k => k.kategori === 'Smear Positif').length;
  const indeksSN = filteredCases.filter(k => k.kategori === 'Smear Negatif').length;
  const indeksEPTB = filteredCases.filter(k => k.kategori === 'ExtraPTB').length;
  const kpiSelesai = filteredCases.filter(k => k.is_finished).length;
  const kpiPemantauan = filteredCases.filter(k => !k.is_finished).length;

  const kpiKontak = filteredContacts.length;
  const getKontakByIndeksCategory = (cat) => filteredContacts.filter(c => filteredCases.find(k => k.id === c.index_case_id)?.kategori === cat).length;
  
  const kontakSP = getKontakByIndeksCategory('Smear Positif');
  const kontakSN = getKontakByIndeksCategory('Smear Negatif');
  const kontakEPTB = getKontakByIndeksCategory('ExtraPTB');

  const calcRatio = (indeks, kontak) => indeks > 0 ? `1 : ${(kontak / indeks).toFixed(1)}` : '0 : 0';
  const ratioAll = calcRatio(kpiIndeks, kpiKontak);
  const ratioSP = calcRatio(indeksSP, kontakSP);

  // KEMASKINI: calcPercent kini pulangkan { count, percent }
  const calcPercent = (saringanNum) => {
    const attendedCount = filteredContacts.filter(c => c[`tarikh_hadir_${saringanNum}`]).length;
    const percentage = kpiKontak === 0 ? '0%' : `${((attendedCount / kpiKontak) * 100).toFixed(1)}%`;
    return { count: attendedCount, percent: percentage };
  };

  // KPI < 14 HARI
  const calc14DaysKPI = (n) => {
    const within14DaysCount = filteredContacts.filter(c => {
      const scheduled = c[`tarikh_saringan_${n}`];
      const attended = c[`tarikh_hadir_${n}`];
      if (!scheduled || !attended) return false;
      
      const diffTime = new Date(attended) - new Date(scheduled);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays <= 14; 
    }).length;

    const percentage = kpiKontak === 0 ? '0%' : `${((within14DaysCount / kpiKontak) * 100).toFixed(1)}%`;
    return { count: within14DaysCount, percent: percentage };
  };

  // Data Pie Chart
  const countTBI = filteredContacts.filter(c => c.status_tb === 'TBI').length;
  const countAktif = filteredContacts.filter(c => c.status_tb === 'Aktif TB').length;
  const countTiada = filteredContacts.filter(c => c.status_tb === 'Tiada TB').length;
  const countSaringan = filteredContacts.filter(c => c.status_tb === 'Dalam Saringan' || !c.status_tb).length;

  const pieData = [
    { name: 'TBI', value: countTBI, color: '#f97316' },
    { name: 'Aktif TB', value: countAktif, color: '#ef4444' },
    { name: 'Tiada TB', value: countTiada, color: '#10b981' },
    { name: 'Dalam Saringan', value: countSaringan, color: '#94a3b8' }
  ];

  const colors = { dark: '#1e293b', blue: '#007bff', cyan: '#17a2b8', green: '#28a745', yellow: '#ffc107', red: '#dc3545', grey: '#6c757d' };
  const s = {
    page: { padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh' },
    topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #ddd', paddingBottom: '15px', marginBottom: '20px' },
    tabContainer: { display: 'flex', gap: '10px', marginBottom: '20px' },
    tabBtn: (isActive) => ({ padding: '10px 20px', fontSize: '15px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: isActive ? colors.blue : '#e2e3e5', color: isActive ? '#fff' : '#333' }),
    kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '20px', alignItems: 'stretch' },
    kpiCard: (color) => ({ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: `1px solid ${color}`, borderTop: `5px solid ${color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }),
    kpiValue: { fontSize: '32px', margin: '0 0 10px 0', color: colors.dark },
    kpiTitle: { fontSize: '14px', fontWeight: 'bold', margin: '0 0 15px 0', color: colors.dark, borderBottom: '1px solid #eee', paddingBottom: '5px' },
    kpiSubText: { fontSize: '12px', color: '#555', margin: '3px 0', display: 'flex', justifyContent: 'space-between' },
    cardFull: { backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
    th: { padding: '12px', backgroundColor: '#343a40', color: '#fff', textAlign: 'left', borderBottom: '2px solid #ddd' },
    td: { padding: '12px', borderBottom: '1px solid #ddd' },
    selectInput: { padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }
  };

  return (
    <div style={s.page}>
      <div style={s.topHeader}>
        <div>
          <h1 style={{ margin: 0, color: colors.dark }}>TBCM Kulai (Pusat Kawalan Admin)</h1>
          <p style={{ margin: '5px 0 0 0', color: colors.grey }}>Pengurusan Laporan Global & Akses Pengguna</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: colors.red, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Log Keluar</button>
      </div>

      <div style={s.tabContainer}>
        <button style={s.tabBtn(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>📊 Papan Pemuka Induk</button>
        <button style={s.tabBtn(activeTab === 'users')} onClick={() => setActiveTab('users')}>👥 Pengurusan Akaun Staf</button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>Statistik Daerah & Klinik</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select value={filterKlinik} onChange={(e) => setFilterKlinik(e.target.value)} style={{ padding: '8px 15px', borderRadius: '4px', border: '1px solid #ccc', fontWeight: 'bold' }}>
                <option value="Semua">Tunjuk Semua Klinik</option>
                <option value="KK Kulai">Hanya KK Kulai</option>
                <option value="KK Kulai Besar">Hanya KK Kulai Besar</option>
              </select>
              <button onClick={handleExportExcel} style={{ padding: '8px 15px', backgroundColor: colors.green, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Muat Turun Laporan (Excel)</button>
            </div>
          </div>

          <div style={s.kpiRow}>
            <div style={s.kpiCard(colors.blue)}>
              <h4 style={s.kpiTitle}>Jumlah Kes Indeks</h4>
              <h2 style={s.kpiValue}>{kpiIndeks}</h2>
              <div style={{ marginTop: 'auto' }}>
                <div style={s.kpiSubText}><span>Smear Positif:</span> <strong>{indeksSP}</strong></div>
                <div style={s.kpiSubText}><span>Smear Negatif:</span> <strong>{indeksSN}</strong></div>
                <div style={s.kpiSubText}><span>Extra PTB:</span> <strong>{indeksEPTB}</strong></div>
              </div>
            </div>

            <div style={s.kpiCard('#8b5cf6')}>
              <h4 style={s.kpiTitle}>Status Penutupan Kes</h4>
              <h2 style={{...s.kpiValue, color: '#8b5cf6'}}>{kpiSelesai}<span style={{fontSize:'16px', color:'#888'}}> / {kpiIndeks}</span></h2>
              <div style={{ marginTop: 'auto' }}>
                <div style={s.kpiSubText}><span>✅ Selesai:</span> <strong style={{color:'#16a34a'}}>{kpiSelesai} kes</strong></div>
                <div style={s.kpiSubText}><span>🔵 Pemantauan:</span> <strong style={{color:'#ca8a04'}}>{kpiPemantauan} kes</strong></div>
                <div style={s.kpiSubText}><span>Kadar Selesai:</span> <strong>{kpiIndeks > 0 ? ((kpiSelesai/kpiIndeks)*100).toFixed(1) : 0}%</strong></div>
              </div>
            </div>

            <div style={s.kpiCard(colors.cyan)}>
              <h4 style={s.kpiTitle}>Jumlah Kontak</h4>
              <h2 style={s.kpiValue}>{kpiKontak}</h2>
              <div style={{ marginTop: 'auto' }}>
                <div style={s.kpiSubText}><span>Drpd Indeks SP:</span> <strong>{kontakSP}</strong></div>
                <div style={s.kpiSubText}><span>Drpd Indeks SN:</span> <strong>{kontakSN}</strong></div>
                <div style={s.kpiSubText}><span>Drpd Indeks EPTB:</span> <strong>{kontakEPTB}</strong></div>
              </div>
            </div>

            <div style={s.kpiCard(colors.dark)}>
              <h4 style={s.kpiTitle}>Nisbah Indeks : Kontak</h4>
              <h2 style={s.kpiValue}>{ratioAll}</h2>
              <div style={{ marginTop: 'auto' }}>
                <div style={s.kpiSubText}><span>Nisbah Keseluruhan:</span> <strong>{ratioAll}</strong></div>
                <div style={s.kpiSubText}><span>Nisbah (Smear Positif):</span> <strong>{ratioSP}</strong></div>
              </div>
            </div>

            {/* KEMASKINI: PAPARAN BILANGAN DAN PERATUS (KPI HIJAU) */}
            <div style={s.kpiCard(colors.green)}>
              <h4 style={s.kpiTitle}>Peratus Hadir Keseluruhan</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: 'auto' }}>
                <div style={s.kpiSubText}><span>Saringan 1:</span> <strong>{calcPercent(1).count} kes ({calcPercent(1).percent})</strong></div>
                <div style={s.kpiSubText}><span>Saringan 2:</span> <strong>{calcPercent(2).count} kes ({calcPercent(2).percent})</strong></div>
                <div style={s.kpiSubText}><span>Saringan 3:</span> <strong>{calcPercent(3).count} kes ({calcPercent(3).percent})</strong></div>
                <div style={s.kpiSubText}><span>Saringan 4:</span> <strong>{calcPercent(4).count} kes ({calcPercent(4).percent})</strong></div>
              </div>
            </div>

            <div style={s.kpiCard(colors.yellow)}>
              <h4 style={s.kpiTitle}>Kepatuhan Hadir (&le; 14 Hari)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: 'auto' }}>
                <div style={s.kpiSubText}><span>Saringan 1:</span> <strong>{calc14DaysKPI(1).count} kes ({calc14DaysKPI(1).percent})</strong></div>
                <div style={s.kpiSubText}><span>Saringan 2:</span> <strong>{calc14DaysKPI(2).count} kes ({calc14DaysKPI(2).percent})</strong></div>
                <div style={s.kpiSubText}><span>Saringan 3:</span> <strong>{calc14DaysKPI(3).count} kes ({calc14DaysKPI(3).percent})</strong></div>
                <div style={s.kpiSubText}><span>Saringan 4:</span> <strong>{calc14DaysKPI(4).count} kes ({calc14DaysKPI(4).percent})</strong></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 15px 0', textAlign: 'center' }}>Taburan Status Penyakit Kontak</h3>
              {kpiKontak === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', marginTop: '50px' }}>Tiada data kontak untuk dipaparkan.</p>
              ) : (
                <div style={{ width: '100%', height: '250px' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} pesakit`, 'Jumlah']} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div style={{ flex: 2, backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflowY: 'auto', maxHeight: '350px' }}>
              <h3 style={{ marginTop: 0 }}>Ringkasan Status Kes Indeks</h3>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{...s.th, position: 'sticky', top: 0}}>Nama Pesakit Indeks</th>
                    <th style={{...s.th, position: 'sticky', top: 0}}>Klinik</th>
                    <th style={{...s.th, position: 'sticky', top: 0}}>Kategori</th>
                    <th style={{...s.th, position: 'sticky', top: 0}}>Jumlah Kontak</th>
                    <th style={{...s.th, position: 'sticky', top: 0, textAlign: 'center'}}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map(kes => {
                    const numContacts = allContacts.filter(c => c.index_case_id === kes.id).length;
                    return (
                      <tr key={kes.id}>
                        <td style={s.td}><strong>{kes.nama}</strong><br/><small style={{color: '#666'}}>KP: {kes.ic_no}</small></td>
                        <td style={s.td}>{kes.klinik}</td>
                        <td style={s.td}>{kes.kategori}</td>
                        <td style={s.td}>{numContacts} orang</td>
                        <td style={{...s.td, textAlign: 'center'}}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: kes.is_finished ? '#dcfce7' : '#fef3c7', color: kes.is_finished ? '#16a34a' : '#ca8a04' }}>
                            {kes.is_finished ? 'Selesai' : 'Pemantauan'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredCases.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Tiada data direkodkan.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <div style={s.cardFull}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>Senarai Pengguna Sistem</h2>
            <p style={{ margin: 0, fontSize: '13px', color: colors.grey }}>*Akaun baharu perlu didaftar melalui fitur Authentication Supabase.</p>
          </div>
          
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>E-mel Staf (ID)</th>
                <th style={s.th}>Peranan (Role)</th>
                <th style={s.th}>Klinik Ditugaskan</th>
                <th style={s.th}>Tarikh Didaftar</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(prof => (
                <tr key={prof.id}>
                  <td style={s.td}><strong>{prof.email || 'Akaun Tiada E-mel'}</strong><br/><small style={{color:'#888'}}>{prof.id}</small></td>
                  <td style={s.td}>
                    <select value={prof.role || ''} onChange={(e) => updateProfile(prof.id, 'role', e.target.value)} style={s.selectInput}>
                      <option value="">Pilih Peranan</option>
                      <option value="Admin">Admin (Penyelia)</option>
                      <option value="PPKP">PPKP (Pendaftaran)</option>
                      <option value="PR1">PR1 (Klinikal)</option>
                    </select>
                  </td>
                  <td style={s.td}>
                    <select value={prof.clinic || ''} onChange={(e) => updateProfile(prof.id, 'clinic', e.target.value)} style={s.selectInput} disabled={prof.role === 'Admin'}>
                      <option value="">Tiada Klinik</option>
                      <option value="KK Kulai">KK Kulai</option>
                      <option value="KK Kulai Besar">KK Kulai Besar</option>
                    </select>
                  </td>
                  <td style={s.td}>{new Date(prof.created_at).toLocaleDateString('ms-MY')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}