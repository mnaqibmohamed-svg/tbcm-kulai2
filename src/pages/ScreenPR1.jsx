import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function ScreenPR1() {
  const navigate = useNavigate();

  const [userProfile, setUserProfile] = useState(null); 
  const [indexCases, setIndexCases] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutstanding, setFilterOutstanding] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const [filterMonth, setFilterMonth] = useState('Semua');
  const [sortName, setSortName] = useState('default');

  const [showModal, setShowModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => { checkUserAndFetch(); }, []);

  const checkUserAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/'); return; }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) {
      setUserProfile(profile);
      fetchData(profile.clinic); 
    }
  };

  const fetchData = async (userClinic) => {
    if (!userClinic) return;
    // Data telah ditapis secara auto untuk memaparkan HANYA kes dari klinik PR1 ini
    const { data: casesData } = await supabase.from('index_cases').select('*').eq('klinik', userClinic).order('created_at', { ascending: false });
    const { data: contactsData } = await supabase.from('contacts').select('*').order('created_at', { ascending: true });
    if (casesData) setIndexCases(casesData);
    if (contactsData) setAllContacts(contactsData);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };
  
  const formatSafeDate = (d) => {
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr = formatSafeDate(new Date());

  // Semak jika saringan tertentu outstanding (Tarikh dah lepas tapi belum hadir)
  const checkOut = (c, n) => {
    const sDate = c[`tarikh_saringan_${n}`];
    const hDate = c[`tarikh_hadir_${n}`];
    return (sDate && sDate <= todayStr && !hDate);
  };
  
  const isContactOutstanding = (c) => [1, 2, 3, 4].some(n => checkOut(c, n));

  const openEditModal = (kontak) => {
    setSelectedContact(kontak);
    setForm({
      tarikh_hadir_1: kontak.tarikh_hadir_1 || '', tarikh_hadir_2: kontak.tarikh_hadir_2 || '',
      tarikh_hadir_3: kontak.tarikh_hadir_3 || '', tarikh_hadir_4: kontak.tarikh_hadir_4 || '',
      tarikh_saringan_2: kontak.tarikh_saringan_2 || '', tarikh_saringan_3: kontak.tarikh_saringan_3 || '', tarikh_saringan_4: kontak.tarikh_saringan_4 || '',
      igra_1: kontak.igra_1 || 'Pending', mantoux_1: kontak.mantoux_1 || 'Pending', cxr_1: kontak.cxr_1 || 'Pending',
      igra_2: kontak.igra_2 || 'Pending', mantoux_2: kontak.mantoux_2 || 'Pending', cxr_2: kontak.cxr_2 || 'Pending',
      igra_3: kontak.igra_3 || 'Pending', mantoux_3: kontak.mantoux_3 || 'Pending', cxr_3: kontak.cxr_3 || 'Pending',
      igra_4: kontak.igra_4 || 'Pending', mantoux_4: kontak.mantoux_4 || 'Pending', cxr_4: kontak.cxr_4 || 'Pending',
      status_tb: kontak.status_tb || 'Dalam Saringan'
    });
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newForm = { ...form, [name]: value };

    if (name === 'tarikh_hadir_1' && value !== '') {
      const getNext = (dStr, m) => {
        if (!dStr) return '';
        let d = new Date(dStr); d.setMonth(d.getMonth() + m);
        if (d.getDay() === 6) d.setDate(d.getDate() + 2);
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      };
      newForm.tarikh_saringan_2 = getNext(selectedContact.tarikh_saringan_1, 3);
      newForm.tarikh_saringan_3 = getNext(newForm.tarikh_saringan_2, 6);
      newForm.tarikh_saringan_4 = getNext(newForm.tarikh_saringan_3, 12);
    }

    const checkStatus = () => {
      for (let i = 1; i <= 4; i++) {
        if (newForm[`igra_${i}`] === 'Positif' || newForm[`mantoux_${i}`] === 'Positif' || newForm[`cxr_${i}`] === 'Abnormal') return 'TBI';
      }
      return 'Dalam Saringan';
    };
    newForm.status_tb = checkStatus();
    setForm(newForm);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const cleanedForm = { ...form };
    Object.keys(cleanedForm).forEach(key => { if (cleanedForm[key] === '') cleanedForm[key] = null; });
    const { error } = await supabase.from('contacts').update(cleanedForm).eq('id', selectedContact.id);
    if (error) alert('Gagal Simpan: ' + error.message);
    else { setShowModal(false); fetchData(userProfile.clinic); }
    setLoading(false);
  };

  const toggleFinish = async (id, status) => {
    await supabase.from('index_cases').update({ is_finished: !status }).eq('id', id);
    fetchData(userProfile.clinic);
  };

  // --- LOGIK KPI TERPERINCI (KHUSUS KLINIK) ---
  const clinicContacts = allContacts.filter(c => indexCases.some(kes => kes.id === c.index_case_id));
  
  // KPI Indeks
  const kpiIndeks = indexCases.length;
  const indeksSP = indexCases.filter(k => k.kategori === 'Smear Positif').length;
  const indeksSN = indexCases.filter(k => k.kategori === 'Smear Negatif').length;
  const indeksEPTB = indexCases.filter(k => k.kategori === 'ExtraPTB').length;

  // KPI Kontak
  const kpiKontak = clinicContacts.length;
  const kontakSP = clinicContacts.filter(c => indexCases.some(k => k.id === c.index_case_id && k.kategori === 'Smear Positif')).length;
  const kontakSN = clinicContacts.filter(c => indexCases.some(k => k.id === c.index_case_id && k.kategori === 'Smear Negatif')).length;
  const kontakEPTB = clinicContacts.filter(c => indexCases.some(k => k.id === c.index_case_id && k.kategori === 'ExtraPTB')).length;

  // Peratus Kehadiran
  const calcPct = (n) => kpiKontak === 0 ? '0%' : `${((clinicContacts.filter(c => c[`tarikh_hadir_${n}`]).length / kpiKontak) * 100).toFixed(1)}%`;

  // Outstanding S1-S4
  const outS1 = clinicContacts.filter(c => checkOut(c, 1)).length;
  const outS2 = clinicContacts.filter(c => checkOut(c, 2)).length;
  const outS3 = clinicContacts.filter(c => checkOut(c, 3)).length;
  const outS4 = clinicContacts.filter(c => checkOut(c, 4)).length;

  const screeningsTodayCount = clinicContacts.filter(c => [1,2,3,4].some(i => c[`tarikh_saringan_${i}`] === todayStr)).length;

  // --- LOGIK KALENDAR & JADUAL ---
  const selectedDateStr = formatSafeDate(selectedDate);
  const appointmentsOnSelectedDate = clinicContacts.filter(c => [1,2,3,4].some(i => c[`tarikh_saringan_${i}`] === selectedDateStr));

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dStr = formatSafeDate(date);
      if (clinicContacts.some(c => [1,2,3,4].some(i => c[`tarikh_saringan_${i}`] === dStr))) 
        return <div style={{ height: '6px', width: '6px', backgroundColor: '#dc3545', borderRadius: '50%', margin: 'auto', marginTop: '2px' }}></div>;
    }
    return null;
  };

  // --- LOGIK FILTER & SORT TABLE ---
  const uniqueMonths = [...new Set(indexCases.map(k => k.tarikh_diagnosis ? k.tarikh_diagnosis.substring(0, 7) : 'Tiada Tarikh'))].sort((a,b) => b.localeCompare(a));
  let filteredCases = indexCases.filter(kes => {
    const contacts = allContacts.filter(c => c.index_case_id === kes.id);
    const matchSearch = kes.nama.toLowerCase().includes(searchTerm.toLowerCase()) || kes.ic_no.includes(searchTerm);
    const matchFinished = showFinished ? kes.is_finished : !kes.is_finished;
    const matchOutstanding = filterOutstanding ? contacts.some(c => isContactOutstanding(c)) : true;
    let matchMonth = true;
    if (filterMonth !== 'Semua') {
      matchMonth = filterMonth === 'Tiada Tarikh' ? !kes.tarikh_diagnosis : kes.tarikh_diagnosis?.startsWith(filterMonth);
    }
    return matchSearch && matchFinished && matchOutstanding && matchMonth;
  });

  if (sortName === 'asc') filteredCases.sort((a, b) => a.nama.localeCompare(b.nama));
  else if (sortName === 'desc') filteredCases.sort((a, b) => b.nama.localeCompare(a.nama));

  const getSummaryStyle = (attended, total) => {
    if (total === 0) return { color: '#6c757d', fontWeight: 'normal' };
    if (attended === 0) return { color: '#dc3545', fontWeight: 'bold' }; 
    if (attended < total) return { color: '#ffc107', fontWeight: 'bold' }; 
    return { color: '#28a745', fontWeight: 'bold' }; 
  };

  const getStatusBadgeStyle = (status) => {
    const base = { padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' };
    if (status === 'TBI') return { ...base, backgroundColor: '#ffedd5', color: '#ea580c' }; 
    if (status === 'Aktif TB') return { ...base, backgroundColor: '#f8d7da', color: '#dc3545' }; 
    if (status === 'Tiada TB') return { ...base, backgroundColor: '#d4edda', color: '#28a745' }; 
    return { ...base, backgroundColor: '#e2e3e5', color: '#333' }; 
  };

  const colors = { dark: '#1e293b', blue: '#007bff', cyan: '#17a2b8', green: '#28a745', yellow: '#ffc107', red: '#dc3545', grey: '#6c757d' };
  const s = {
    page: { padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh' },
    topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #ddd', paddingBottom: '15px', marginBottom: '15px' },
    alertBanner: { backgroundColor: screeningsTodayCount > 0 ? '#e2e3e5' : '#fff', border: `1px solid ${screeningsTodayCount > 0 ? '#ccc' : '#ddd'}`, padding: '15px 20px', borderRadius: '8px', marginBottom: '20px', color: '#333', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    kpiLayout: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' },
    kpiCard: (color) => ({ backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', borderTop: `5px solid ${color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }),
    kpiTitle: { margin: '0 0 10px 0', color: colors.dark, fontSize: '15px', borderBottom: '1px solid #eee', paddingBottom: '5px' },
    kpiVal: { margin: 0, fontSize: '28px', color: colors.dark, fontWeight: 'bold' },
    kpiRow: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: colors.grey, marginTop: '4px' },
    
    mainLayout: { display: 'flex', gap: '20px', alignItems: 'flex-start' },
    cardLeft: { flex: '1', minWidth: '320px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    cardRight: { flex: '2', minWidth: '600px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflowX: 'auto' },
    
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
    th: { padding: '12px', backgroundColor: '#343a40', color: '#fff', textAlign: 'left', borderBottom: '2px solid #ddd' },
    td: { padding: '12px', borderBottom: '1px solid #ddd', verticalAlign: 'middle' },
    input: { padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modalContent: { backgroundColor: 'white', padding: '30px', borderRadius: '8px', position: 'relative', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
  };

  return (
    <div style={s.page}>
      <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } } .react-calendar { width: 100% !important; border: none !important; font-family: inherit !important; }`}</style>
      
      <div style={s.topHeader}>
        <div>
          <h1 style={{ margin: 0, color: colors.dark, fontSize: '24px' }}>TBCM Kulai (PR1)</h1>
          <p style={{ margin: '5px 0 0 0', color: colors.grey }}>🏥 Klinik Bertugas: <strong>{userProfile?.clinic || 'Memuatkan...'}</strong></p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: colors.red, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Log Keluar</button>
      </div>

      <div style={s.alertBanner}>
        <span style={{ fontSize: '20px' }}>📅</span>
        <span>Hari ini ({new Date().toLocaleDateString('ms-MY')}): Anda mempunyai <span style={{ backgroundColor: screeningsTodayCount > 0 ? colors.blue : colors.grey, color: '#fff', padding: '2px 8px', borderRadius: '12px' }}>{screeningsTodayCount}</span> temujanji saringan.</span>
      </div>

      {/* 3. KPI TERPERINCI MENGIKUT KLINIK PR1 (1 BARIS, 4 KOTAK) */}
      <div style={s.kpiLayout}>
        {/* KPI 1: INDEKS */}
        <div style={s.kpiCard(colors.blue)}>
          <h4 style={s.kpiTitle}>Jumlah Kes Indeks</h4>
          <h2 style={s.kpiVal}>{kpiIndeks}</h2>
          <div style={{ marginTop: '10px' }}>
            <div style={s.kpiRow}><span>Smear Positif:</span> <strong>{indeksSP}</strong></div>
            <div style={s.kpiRow}><span>Smear Negatif:</span> <strong>{indeksSN}</strong></div>
            <div style={s.kpiRow}><span>Extra PTB:</span> <strong>{indeksEPTB}</strong></div>
          </div>
        </div>

        {/* KPI 2: KONTAK */}
        <div style={s.kpiCard(colors.cyan)}>
          <h4 style={s.kpiTitle}>Jumlah Kontak</h4>
          <h2 style={s.kpiVal}>{kpiKontak}</h2>
          <div style={{ marginTop: '10px' }}>
            <div style={s.kpiRow}><span>Dari Indeks SP:</span> <strong>{kontakSP}</strong></div>
            <div style={s.kpiRow}><span>Dari Indeks SN:</span> <strong>{kontakSN}</strong></div>
            <div style={s.kpiRow}><span>Dari Indeks EPTB:</span> <strong>{kontakEPTB}</strong></div>
          </div>
        </div>

        {/* KPI 3: PERATUS KEHADIRAN */}
        <div style={s.kpiCard(colors.green)}>
          <h4 style={s.kpiTitle}>Peratus Hadir Saringan</h4>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={s.kpiRow}><span>Saringan Pertama (S1):</span> <strong>{calcPct(1)}</strong></div>
            <div style={s.kpiRow}><span>Saringan Kedua (S2):</span> <strong>{calcPct(2)}</strong></div>
            <div style={s.kpiRow}><span>Saringan Ketiga (S3):</span> <strong>{calcPct(3)}</strong></div>
            <div style={s.kpiRow}><span>Saringan Keempat (S4):</span> <strong>{calcPct(4)}</strong></div>
          </div>
        </div>

        {/* KPI 4: OUTSTANDING */}
        <div style={s.kpiCard(colors.red)}>
          <h4 style={s.kpiTitle}>Jumlah Outstanding</h4>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={s.kpiRow}><span>Saringan Pertama (S1):</span> <strong style={{color: outS1 > 0 ? colors.red : colors.grey}}>{outS1}</strong></div>
            <div style={s.kpiRow}><span>Saringan Kedua (S2):</span> <strong style={{color: outS2 > 0 ? colors.red : colors.grey}}>{outS2}</strong></div>
            <div style={s.kpiRow}><span>Saringan Ketiga (S3):</span> <strong style={{color: outS3 > 0 ? colors.red : colors.grey}}>{outS3}</strong></div>
            <div style={s.kpiRow}><span>Saringan Keempat (S4):</span> <strong style={{color: outS4 > 0 ? colors.red : colors.grey}}>{outS4}</strong></div>
          </div>
        </div>
      </div>

      {/* BAHAGIAN BAWAH: KIRI (KALENDAR) | KANAN (JADUAL) */}
      <div style={s.mainLayout}>
        
        {/* 1. KIRI: KALENDAR (1/3 LEBAR) */}
        <div style={s.cardLeft}>
          <h3 style={{ margin: '0 0 15px 0', color: colors.dark, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>📅 Kalendar Saringan</h3>
          <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
            <Calendar onChange={setSelectedDate} value={selectedDate} tileContent={tileContent} />
          </div>
          
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: appointmentsOnSelectedDate.length > 0 ? '#e0e7ff' : '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h4 style={{ margin: '0 0 10px 0', color: colors.dark }}>Temujanji: {selectedDate.toLocaleDateString('ms-MY')}</h4>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: colors.blue, marginBottom: '10px' }}>
              Jumlah pesakit dijadualkan: {appointmentsOnSelectedDate.length}
            </div>
            
            {appointmentsOnSelectedDate.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Tiada saringan untuk tarikh ini.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#333' }}>
                {appointmentsOnSelectedDate.map(a => {
                  const ks = indexCases.find(k => k.id === a.index_case_id);
                  return (
                    <li key={a.id} style={{ marginBottom: '8px' }}>
                      <strong>{a.nama}</strong> ({a.no_tel})<br/>
                      <span style={{ color: '#666' }}>Indeks: {ks?.nama}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 2. KANAN: SENARAI KES (2/3 LEBAR) */}
        <div style={s.cardRight}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Cari Indeks/KP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={s.input} />
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={s.input}>
                <option value="Semua">Semua Bulan</option>
                {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={sortName} onChange={(e) => setSortName(e.target.value)} style={s.input}>
                <option value="default">Susunan Default</option>
                <option value="asc">Nama: A - Z</option>
                <option value="desc">Nama: Z - A</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: colors.red, fontWeight: 'bold' }}>
                <input type="checkbox" checked={filterOutstanding} onChange={() => setFilterOutstanding(!filterOutstanding)} /> Outstanding Sahaja
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: colors.grey, fontWeight: 'bold' }}>
                <input type="checkbox" checked={showFinished} onChange={() => setShowFinished(!showFinished)} /> Kes Selesai
              </label>
            </div>
          </div>

          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Kes Indeks & Outstanding</th>
                <th style={s.th}>Ringkasan Saringan (S1-S4)</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? <tr><td colSpan="3" style={{textAlign:'center', padding:'30px', color:colors.grey}}>Tiada data yang sepadan.</td></tr> : 
              filteredCases.map((kes) => {
                const contacts = allContacts.filter(c => c.index_case_id === kes.id);
                const hasOutstanding = contacts.some(c => isContactOutstanding(c));
                const isExpanded = expandedCaseId === kes.id;

                return (
                  <React.Fragment key={kes.id}>
                    <tr style={{ backgroundColor: kes.is_finished ? '#e9ecef' : 'transparent' }}>
                      <td style={s.td}>
                        {hasOutstanding && <span style={{ width: '10px', height: '10px', backgroundColor: colors.red, borderRadius: '50%', display: 'inline-block', marginRight: '8px', animation: 'pulse 1.5s infinite' }} title="Saringan Tertunggak"></span>}
                        <strong>{kes.nama}</strong>
                        <br /><span style={{ fontSize: '12px', color: colors.grey }}>Diag: {kes.tarikh_diagnosis || '-'}</span>
                      </td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          {[1, 2, 3, 4].map(n => {
                            const attended = contacts.filter(c => c[`tarikh_hadir_${n}`]).length;
                            return <span key={n} style={{ ...getSummaryStyle(attended, contacts.length), fontSize: '13px' }}>S{n}: {attended}/{contacts.length}</span>
                          })}
                        </div>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <button onClick={() => setExpandedCaseId(isExpanded ? null : kes.id)} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', marginRight: '8px', fontWeight: 'bold' }}>{isExpanded ? 'Tutup' : 'Semak'}</button>
                        <button onClick={() => toggleFinish(kes.id, kes.is_finished)} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', border: 'none', backgroundColor: kes.is_finished ? colors.grey : colors.green, color: '#fff', fontWeight: 'bold' }}>
                          {kes.is_finished ? 'Buka Semula' : 'Tanda Selesai'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan="3" style={{ padding: '15px', backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                          <div style={{ borderLeft: `3px solid ${colors.blue}`, paddingLeft: '15px' }}>
                            {contacts.map(c => (
                              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px', borderRadius: '4px', marginBottom: '10px', border: '1px solid #ddd' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{c.nama} {isContactOutstanding(c) && <span style={{ color: colors.red, fontSize: '11px' }}>[OUTSTANDING]</span>}</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                    {[1, 2, 3, 4].map(n => (
                                      <div key={n} style={{ fontSize: '12px', padding: '5px', backgroundColor: '#f4f6f9', borderRadius: '4px', border: '1px solid #eee' }}>
                                        <strong>S{n}:</strong> {c[`tarikh_saringan_${n}`] || '-'}<br/>
                                        <strong>Hadir:</strong> <span style={{ color: c[`tarikh_hadir_${n}`] ? colors.green : colors.red }}>{c[`tarikh_hadir_${n}`] || 'Belum'}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right', marginLeft: '20px' }}>
                                  <div style={{ marginBottom: '10px' }}><span style={getStatusBadgeStyle(c.status_tb)}>{c.status_tb}</span></div>
                                  <button onClick={() => openEditModal(c)} style={{ padding: '6px 12px', backgroundColor: colors.blue, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✏️ Kemaskini</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL KEMASKINI RAWATAN */}
      {showModal && (
        <div style={s.modalOverlay}>
          <div style={{...s.modalContent, width: '850px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Kemaskini: {selectedContact?.nama}</h3>
            <form onSubmit={handleUpdateSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {[1, 2, 3, 4].map((num) => (
                  <div key={num} style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: colors.dark }}>SARINGAN {num}</h4>
                    <div style={{ fontSize: '13px', marginBottom: '8px', color: colors.grey }}>📅 <strong>Tarikh Diberi:</strong> {selectedContact?.[`tarikh_saringan_${num}`] || '-'}</div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Tarikh Sebenar Hadir:</label>
                    <input type="date" name={`tarikh_hadir_${num}`} value={form[`tarikh_hadir_${num}`] || ''} onChange={handleChange} style={{ width: '100%', marginBottom: '10px', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <select name={`igra_${num}`} value={form[`igra_${num}`]} onChange={handleChange} style={{flex:1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize:'12px'}}><option value="Pending">Pending</option><option value="Negatif">Negatif</option><option value="Positif">Positif</option><option value="Tidak Dibuat">Tidak Dibuat</option></select>
                      <select name={`mantoux_${num}`} value={form[`mantoux_${num}`]} onChange={handleChange} style={{flex:1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize:'12px'}}><option value="Pending">Pending</option><option value="Negatif">Negatif</option><option value="Positif">Positif</option><option value="Tidak Dibuat">Tidak Dibuat</option></select>
                      <select name={`cxr_${num}`} value={form[`cxr_${num}`]} onChange={handleChange} style={{flex:1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc', fontSize:'12px'}}><option value="Pending">Pending</option><option value="Normal">Normal</option><option value="Abnormal">Abnormal</option><option value="Tidak Dibuat">Tidak Dibuat</option></select>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '20px', padding: '15px', textAlign: 'center', backgroundColor: form.status_tb === 'TBI' ? '#f8d7da' : '#e2e3e5', border: '1px solid #ddd', borderRadius: '4px' }}>
                <strong style={{ color: form.status_tb === 'TBI' ? colors.red : colors.dark }}>STATUS PENYAKIT AUTO: {form.status_tb}</strong>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', backgroundColor: colors.blue, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{loading ? 'Menyimpan...' : 'Simpan Rekod'}</button>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '10px', backgroundColor: colors.grey, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}