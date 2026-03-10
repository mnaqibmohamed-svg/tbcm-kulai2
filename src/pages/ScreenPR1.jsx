import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Calendar from 'react-calendar'; 
import 'react-calendar/dist/Calendar.css'; 

export default function ScreenPR1() {
  const navigate = useNavigate();
  
  const [indexCases, setIndexCases] = useState([]);
  const [allContacts, setAllContacts] = useState([]);
  const [customAppts, setCustomAppts] = useState([]);
  const [holidays, setHolidays] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKlinik, setFilterKlinik] = useState('Semua');
  const [filterOutstanding, setFilterOutstanding] = useState(false);
  const [filterPending, setFilterPending] = useState(false);
  const [expandedCaseId, setExpandedCaseId] = useState(null); 
  const [currentUser, setCurrentUser] = useState(null);

  // Modal Editing Contact
  const [showModal, setShowModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null); 
  const [contactForm, setContactForm] = useState({});
  const [loadingContact, setLoadingContact] = useState(false);

  // Calendar States
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Custom Appointment Modal
  const [showApptModal, setShowApptModal] = useState(false);
  const [apptForm, setApptForm] = useState({ id: null, nama: '', tbk: '', tujuan: [], klinik: '' });

  useEffect(() => { checkAccessAndFetch(); }, []);

  const checkAccessAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/'); return; }
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (profile) setCurrentUser(profile);
    if (profile && profile.clinic) setFilterKlinik(profile.clinic);
    
    fetchData();
  };

  const fetchData = async () => {
    const [casesRes, contactsRes, apptRes, holRes] = await Promise.all([
      supabase.from('index_cases').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('*').order('created_at', { ascending: true }),
      supabase.from('custom_appointments').select('*'),
      supabase.from('holidays').select('*')
    ]);

    if (casesRes.data) setIndexCases(casesRes.data);
    if (contactsRes.data) setAllContacts(contactsRes.data);
    if (apptRes.data) setCustomAppts(apptRes.data);
    if (holRes.data) setHolidays(holRes.data);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

  const calculateAutoStatus = (form) => {
    const isAbnormal = [form.cxr_1, form.cxr_2, form.cxr_3, form.cxr_4].includes('Abnormal');
    if (isAbnormal) return 'Aktif TB';

    const posTerms = ['Positif', 'Positive'];
    const isTBI = [form.igra_1, form.igra_2, form.igra_3, form.igra_4, form.mantoux_1, form.mantoux_2, form.mantoux_3, form.mantoux_4]
                  .some(val => posTerms.includes(val));
    if (isTBI) return 'TBI';

    if (form.tarikh_hadir_4) return 'Tiada TB';

    return 'Dalam Saringan';
  };

  const openEditModal = (contact) => { 
    setSelectedContact(contact); 
    setContactForm(contact);
    setShowModal(true); 
  };
  
  const closeEditModal = () => { 
    setShowModal(false); 
    setSelectedContact(null); 
    setContactForm({}); 
  };

  const handleContactChange = (field, value) => { 
    setContactForm(prev => {
      const updated = { ...prev, [field]: value };
      updated.status_tb = calculateAutoStatus(updated); 
      return updated;
    }); 
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setLoadingContact(true);
    
    const finalStatus = calculateAutoStatus(contactForm);
    
    const { error } = await supabase.from('contacts').update({
        ...contactForm,
        status_tb: finalStatus
    }).eq('id', selectedContact.id);
    
    if (!error) {
      alert('Data klinikal dikemaskini!');
      closeEditModal();
      fetchData();
    } else {
      alert('Ralat: ' + error.message);
    }
    setLoadingContact(false);
  };

  const formatSafeDate = (d) => {
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = formatSafeDate(new Date());

  const isContactOutstanding = (c) => {
    for (let i = 1; i <= 4; i++) {
      const sDate = c[`tarikh_saringan_${i}_baru`] || c[`tarikh_saringan_${i}`];
      const hDate = c[`tarikh_hadir_${i}`];
      if (sDate && sDate <= todayStr && !hDate) return true;
    }
    return false;
  };

  const isContactPending = (c) => {
    for (let i = 1; i <= 4; i++) {
      if (c[`tarikh_hadir_${i}`]) {
        if (c[`igra_${i}`] === 'Pending' || c[`mantoux_${i}`] === 'Pending' || c[`cxr_${i}`] === 'Pending') return true;
      }
    }
    return false;
  };

  const filteredCases = indexCases.filter(kes => {
    const contacts = allContacts.filter(c => c.index_case_id === kes.id);
    const matchName = kes.nama.toLowerCase().includes(searchTerm.toLowerCase()) || kes.ic_no.includes(searchTerm);
    const matchKlinik = filterKlinik === 'Semua' || kes.klinik === filterKlinik;
    const matchOutstanding = filterOutstanding ? contacts.some(c => isContactOutstanding(c)) : true;
    const matchPending = filterPending ? contacts.some(c => isContactPending(c)) : true;
    
    return matchName && matchKlinik && matchOutstanding && matchPending;
  });

  // --- LOGIK KPI ---
  const kpiIndeks = indexCases.length;
  const indeksSP = indexCases.filter(k => k.kategori === 'Smear Positif').length;
  const indeksSN = indexCases.filter(k => k.kategori === 'Smear Negatif').length;
  const indeksEPTB = indexCases.filter(k => k.kategori === 'ExtraPTB').length;

  const kpiKontak = allContacts.length;
  const kontakSP = allContacts.filter(c => indexCases.some(k => k.id === c.index_case_id && k.kategori === 'Smear Positif')).length;
  const kontakSN = allContacts.filter(c => indexCases.some(k => k.id === c.index_case_id && k.kategori === 'Smear Negatif')).length;
  const kontakEPTB = allContacts.filter(c => indexCases.some(k => k.id === c.index_case_id && k.kategori === 'ExtraPTB')).length;

  const calcPercent = (n) => {
    if (kpiKontak === 0) return '0%';
    const attended = allContacts.filter(c => c[`tarikh_hadir_${n}`]).length;
    return `${((attended / kpiKontak) * 100).toFixed(1)}%`;
  };

  // --- LOGIK PENGUMUMAN TEMUJANJI HARI INI ---
  const todayAppointments = allContacts.filter(c => 
    (c.tarikh_saringan_1_baru || c.tarikh_saringan_1) === todayStr || 
    (c.tarikh_saringan_2_baru || c.tarikh_saringan_2) === todayStr || 
    (c.tarikh_saringan_3_baru || c.tarikh_saringan_3) === todayStr || 
    (c.tarikh_saringan_4_baru || c.tarikh_saringan_4) === todayStr
  );
  const todayCustomAppts = customAppts.filter(a => a.tarikh === todayStr && (filterKlinik === 'Semua' || a.klinik === filterKlinik));
  const totalToday = todayAppointments.length + todayCustomAppts.length;

  // --- LOGIK KALENDAR ---
  const selectedDateStr = formatSafeDate(selectedDate);
  const isHoliday = holidays.find(h => h.tarikh === selectedDateStr);

  const appointmentsOnSelectedDate = allContacts.filter(c => 
    (c.tarikh_saringan_1_baru || c.tarikh_saringan_1) === selectedDateStr || 
    (c.tarikh_saringan_2_baru || c.tarikh_saringan_2) === selectedDateStr || 
    (c.tarikh_saringan_3_baru || c.tarikh_saringan_3) === selectedDateStr || 
    (c.tarikh_saringan_4_baru || c.tarikh_saringan_4) === selectedDateStr
  );

  const customApptsOnSelected = customAppts.filter(a => a.tarikh === selectedDateStr && (filterKlinik === 'Semua' || a.klinik === filterKlinik));

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = formatSafeDate(date);
      const hol = holidays.some(h => h.tarikh === dateStr);
      const adaKontak = allContacts.some(c => 
        (c.tarikh_saringan_1_baru || c.tarikh_saringan_1) === dateStr || 
        (c.tarikh_saringan_2_baru || c.tarikh_saringan_2) === dateStr || 
        (c.tarikh_saringan_3_baru || c.tarikh_saringan_3) === dateStr || 
        (c.tarikh_saringan_4_baru || c.tarikh_saringan_4) === dateStr
      );
      const adaCustom = customAppts.some(a => a.tarikh === dateStr);

      return (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '2px' }}>
          {hol && <div style={{ height: '6px', width: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }}></div>}
          {!hol && adaKontak && <div style={{ height: '6px', width: '6px', backgroundColor: '#f97316', borderRadius: '50%' }}></div>}
          {!hol && adaCustom && <div style={{ height: '6px', width: '6px', backgroundColor: '#3b82f6', borderRadius: '50%' }}></div>}
        </div>
      );
    }
    return null;
  };

  const tileClassName = ({ date, view }) => {
    if (view === 'month' && holidays.some(h => h.tarikh === formatSafeDate(date))) {
      return 'holiday-tile';
    }
    return null;
  };

  const toggleHoliday = async () => {
    if (isHoliday) {
      await supabase.from('holidays').delete().eq('id', isHoliday.id);
    } else {
      const desc = prompt("Sila masukkan keterangan cuti umum (cth: Hari Raya):");
      if (desc) {
        await supabase.from('holidays').insert([{ tarikh: selectedDateStr, keterangan: desc }]);
      }
    }
    fetchData();
  };

  const openApptModal = (appt = null) => {
    if (appt) {
      setApptForm({ id: appt.id, nama: appt.nama, tbk: appt.tbk, tujuan: appt.tujuan.split(', '), klinik: appt.klinik });
    } else {
      setApptForm({ id: null, nama: '', tbk: '', tujuan: [], klinik: filterKlinik === 'Semua' ? 'KK Kulai' : filterKlinik });
    }
    setShowApptModal(true);
  };

  const handleTujuanToggle = (val) => {
    setApptForm(prev => {
      const newTujuan = prev.tujuan.includes(val) ? prev.tujuan.filter(t => t !== val) : [...prev.tujuan, val];
      return { ...prev, tujuan: newTujuan };
    });
  };

  const saveCustomAppt = async (e) => {
    e.preventDefault();
    const payload = { 
      tarikh: selectedDateStr, 
      nama: apptForm.nama, 
      tbk: apptForm.tbk, 
      tujuan: apptForm.tujuan.join(', '), 
      klinik: apptForm.klinik 
    };

    if (apptForm.id) await supabase.from('custom_appointments').update(payload).eq('id', apptForm.id);
    else await supabase.from('custom_appointments').insert([payload]);
    
    setShowApptModal(false);
    fetchData();
  };

  const deleteCustomAppt = async (id) => {
    if (window.confirm("Padam temujanji ini?")) {
      await supabase.from('custom_appointments').delete().eq('id', id);
      fetchData();
    }
  };

  const getSummaryStyle = (attended, total) => {
    if (total === 0) return { color: '#64748b', fontWeight: 'normal' };
    if (attended === 0) return { color: '#ef4444', fontWeight: 'bold' };
    if (attended < total) return { color: '#d97706', fontWeight: 'bold' };
    return { color: '#10b981', fontWeight: 'bold' };
  };

  const colors = { dark: '#1e293b', blue: '#007bff', cyan: '#17a2b8', green: '#28a745', yellow: '#ffc107', red: '#dc3545', grey: '#6c757d', purple: '#8b5cf6', orange: '#f97316' };
  const s = {
    page: { padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh' },
    topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #ddd', paddingBottom: '15px', marginBottom: '20px' },
    h1: { margin: 0, color: colors.dark, fontSize: '24px' },
    p: { margin: '5px 0 0 0', color: colors.grey },
    kpiLayout: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' },
    kpiCard: (color) => ({ backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', borderLeft: `5px solid ${color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
    th: { padding: '12px', backgroundColor: '#343a40', color: '#fff', textAlign: 'left', borderBottom: '2px solid #ddd' },
    td: { padding: '12px', borderBottom: '1px solid #ddd', verticalAlign: 'middle' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modalContent: { backgroundColor: 'white', padding: '30px', borderRadius: '8px', position: 'relative', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' },
    select: { padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' },
    announcement: { backgroundColor: totalToday > 0 ? '#fef3c7' : '#e0f2fe', border: `1px solid ${totalToday > 0 ? '#f59e0b' : '#38bdf8'}`, padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
  };

  return (
    <div style={s.page}>
      <style>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
        .holiday-tile { background-color: #fee2e2 !important; border-radius: 4px; color: #ef4444 !important; font-weight: bold; }
      `}</style>

      <div style={s.topHeader}>
        <div>
          <h1 style={s.h1}>TBCM Kulai (Modul Klinikal)</h1>
          <p style={s.p}>Pengurusan Pesakit - PR1 / Pegawai Perubatan</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: colors.red, color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>Log Keluar</button>
      </div>

      {/* PENGUMUMAN TEMUJANJI HARI INI */}
      <div style={s.announcement}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', color: totalToday > 0 ? '#b45309' : '#0369a1' }}>📅 Makluman Temujanji Hari Ini</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#444' }}>
            Anda mempunyai <strong>{totalToday} temujanji</strong> pada hari ini ({new Date().toLocaleDateString('ms-MY')}).
            {totalToday > 0 && ` Sila klik butang Kalendar PR1 untuk melihat senarai.`}
          </p>
        </div>
        {totalToday > 0 && <button onClick={() => { setSelectedDate(new Date()); setShowCalendar(true); }} style={{ padding: '8px 15px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Lihat Senarai Temujanji</button>}
      </div>

      {/* KAD KPI (INDEKS, KONTAK, SARINGAN) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
        <div style={s.kpiCard(colors.blue)}>
          <h3 style={{ margin: '0 0 8px 0', color: colors.dark }}>Jumlah Kes Indeks: {kpiIndeks}</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: colors.grey, borderTop: '1px solid #eee', paddingTop: '8px' }}>
            <span>Smear Positif: <strong>{indeksSP}</strong></span>
            <span>Smear Negatif: <strong>{indeksSN}</strong></span>
            <span>Extra PTB: <strong>{indeksEPTB}</strong></span>
          </div>
        </div>
        <div style={s.kpiCard(colors.cyan)}>
          <h3 style={{ margin: '0 0 8px 0', color: colors.dark }}>Jumlah Kontak: {kpiKontak}</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: colors.grey, borderTop: '1px solid #eee', paddingTop: '8px' }}>
            <span>Drpd SP: <strong>{kontakSP}</strong></span>
            <span>Drpd SN: <strong>{kontakSN}</strong></span>
            <span>Drpd EPTB: <strong>{kontakEPTB}</strong></span>
          </div>
        </div>
      </div>

      <div style={{...s.kpiLayout, gridTemplateColumns: 'repeat(4, 1fr)'}}>
        <div style={s.kpiCard(colors.green)}><h2 style={{margin:0, color: colors.dark}}>{calcPercent(1)}</h2><p style={{margin:0, fontSize:'12px', color:colors.grey, fontWeight:'bold'}}>Hadir Saringan 1</p></div>
        <div style={s.kpiCard(colors.green)}><h2 style={{margin:0, color: colors.dark}}>{calcPercent(2)}</h2><p style={{margin:0, fontSize:'12px', color:colors.grey, fontWeight:'bold'}}>Hadir Saringan 2</p></div>
        <div style={s.kpiCard(colors.green)}><h2 style={{margin:0, color: colors.dark}}>{calcPercent(3)}</h2><p style={{margin:0, fontSize:'12px', color:colors.grey, fontWeight:'bold'}}>Hadir Saringan 3</p></div>
        <div style={s.kpiCard(colors.green)}><h2 style={{margin:0, color: colors.dark}}>{calcPercent(4)}</h2><p style={{margin:0, fontSize:'12px', color:colors.grey, fontWeight:'bold'}}>Hadir Saringan 4</p></div>
      </div>

      {/* JADUAL UTAMA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>Senarai Kes & Kemaskini Klinikal</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowCalendar(true)} style={{ padding: '8px 12px', backgroundColor: colors.cyan, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📅 Kalendar Induk PR1</button>
          
          <input type="text" placeholder="Cari Nama/KP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
          <select value={filterKlinik} onChange={(e) => setFilterKlinik(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="Semua">Semua Klinik</option><option value="KK Kulai">KK Kulai</option><option value="KK Kulai Besar">KK Kulai Besar</option>
          </select>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: colors.red, fontWeight: 'bold' }}>
            <input type="checkbox" checked={filterOutstanding} onChange={() => setFilterOutstanding(!filterOutstanding)} /> Outstanding
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: colors.orange, fontWeight: 'bold' }}>
            <input type="checkbox" checked={filterPending} onChange={() => setFilterPending(!filterPending)} /> Result Pending
          </label>
        </div>
      </div>

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Kes Indeks & Outstanding</th>
            <th style={s.th}>Statistik Saringan Kontak</th>
            <th style={{...s.th, textAlign: 'right'}}>Tindakan</th>
          </tr>
        </thead>
        <tbody>
          {filteredCases.map(kes => {
            const caseContacts = allContacts.filter(c => c.index_case_id === kes.id);
            const hasOutstanding = caseContacts.some(c => isContactOutstanding(c));
            const isExpanded = expandedCaseId === kes.id;

            return (
              <React.Fragment key={kes.id}>
                <tr style={{ backgroundColor: kes.is_finished ? '#e9ecef' : 'transparent' }}>
                  <td style={s.td}>
                    {hasOutstanding && <span style={{ width: '10px', height: '10px', backgroundColor: colors.red, borderRadius: '50%', display: 'inline-block', marginRight: '8px', animation: 'pulse 1.5s infinite' }} title="Saringan Tertunggak"></span>}
                    <strong>{kes.nama}</strong> <br/>
                    <span style={{fontSize:'12px', color:'#666'}}>No Tibi: <strong>{kes.no_daftar_tibi || '-'}</strong> | {kes.klinik}</span>
                  </td>
                  
                  {/* SUMMARY S1-S4 KEMBALI DI SINI */}
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      {[1, 2, 3, 4].map(n => {
                        const attended = caseContacts.filter(c => c[`tarikh_hadir_${n}`]).length;
                        return <span key={n} style={{ ...getSummaryStyle(attended, caseContacts.length), fontSize: '12px' }}>S{n}: {attended}/{caseContacts.length}</span>
                      })}
                    </div>
                  </td>
                  
                  <td style={{...s.td, textAlign: 'right'}}>
                    <button onClick={() => setExpandedCaseId(isExpanded ? null : kes.id)} style={{ padding: '6px 12px', backgroundColor: colors.blue, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      {isExpanded ? 'Tutup Senarai' : 'Klinikal Kontak'}
                    </button>
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan="3" style={{ padding: '15px', backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                      <div style={{ borderLeft: `3px solid ${colors.blue}`, paddingLeft: '15px' }}>
                        {caseContacts.length === 0 ? ( <p style={{ color: '#666', fontStyle: 'italic', margin: 0 }}>Tiada kontak didaftarkan lagi.</p> ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', backgroundColor: '#fff' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#e2e8f0' }}>
                                  <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'left' }}>Nama Kontak & Status</th>
                                  <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'center' }}>Saringan 1</th>
                                  <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'center' }}>Saringan 2</th>
                                  <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'center' }}>Saringan 3</th>
                                  <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'center' }}>Saringan 4</th>
                                  <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'center' }}>Kemaskini</th>
                                </tr>
                              </thead>
                              <tbody>
                                {caseContacts.map(c => (
                                  <tr key={c.id}>
                                    <td style={{ padding: '10px', border: '1px solid #ccc' }}>
                                      <strong>{c.nama}</strong><br/>
                                      <span style={{ fontSize:'11px', color: '#666'}}>KP: {c.ic_no}</span><br/>
                                      <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: c.status_tb === 'Tiada TB' ? '#dcfce7' : c.status_tb === 'Aktif TB' ? '#fee2e2' : '#fef3c7', color: '#333' }}>
                                        {c.status_tb || 'Dalam Saringan'}
                                      </span>
                                    </td>
                                    
                                    {[1, 2, 3, 4].map(n => (
                                      <td key={n} style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'center', backgroundColor: c[`tarikh_saringan_${n}`] ? '#fff' : '#f8f9fa' }}>
                                        {c[`tarikh_saringan_${n}`] ? (
                                          <>
                                            <div style={{ fontSize: '11px', color: '#666' }}>
                                              {c[`tarikh_saringan_${n}_baru`] ? (
                                                <span>Tarikh Baru: <br/><strong style={{color:colors.red}}>{c[`tarikh_saringan_${n}_baru`]}</strong></span>
                                              ) : (
                                                <span>Diberi: <br/><strong>{c[`tarikh_saringan_${n}`]}</strong></span>
                                              )}
                                            </div>
                                            <div style={{ marginTop: '5px' }}>
                                              {c[`tarikh_hadir_${n}`] ? (
                                                <span style={{ color: colors.green, fontWeight: 'bold', fontSize: '12px' }}>Hadir: {c[`tarikh_hadir_${n}`]}</span>
                                              ) : (
                                                <span style={{ color: colors.red, fontSize: '12px' }}>Belum Hadir</span>
                                              )}
                                            </div>
                                          </>
                                        ) : ( <span style={{ color: '#ccc' }}>-</span> )}
                                      </td>
                                    ))}
                                    
                                    <td style={{ padding: '10px', border: '1px solid #ccc', textAlign: 'center' }}>
                                      <button onClick={() => openEditModal(c)} style={{ padding: '6px 10px', backgroundColor: colors.green, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                                        ✏️ Isi Keputusan
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* KALENDAR PR1 MODAL (DENGAN NO DAFTAR TIBI) */}
      {showCalendar && (
        <div style={s.modalOverlay}>
          <div style={{...s.modalContent, width: '700px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
            <button onClick={() => setShowCalendar(false)} style={{ position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', zIndex: 10 }}>&times;</button>
            <h3 style={{ marginTop: 0, textAlign: 'center', flexShrink: 0 }}>Kalendar PR1 & Temujanji Custom</h3>
            
            <div style={{ display: 'flex', gap: '20px', flexGrow: 1, overflow: 'hidden' }}>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ margin: '0 auto', flexShrink: 0 }}>
                  <Calendar onChange={setSelectedDate} value={selectedDate} tileContent={tileContent} tileClassName={tileClassName}/>
                </div>
                
                <div style={{ marginTop: '15px', textAlign: 'center' }}>
                  <button onClick={toggleHoliday} style={{ padding: '8px 15px', backgroundColor: isHoliday ? '#fff' : '#ef4444', color: isHoliday ? '#ef4444' : '#fff', border: `2px solid #ef4444`, borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
                    {isHoliday ? '❌ Batal Cuti Umum' : '🛑 Tandakan Cuti Umum'}
                  </button>
                  {isHoliday && <p style={{ fontSize: '13px', color: '#ef4444', fontWeight: 'bold', margin: '5px 0 0 0' }}>{isHoliday.keterangan}</p>}
                </div>
              </div>

              <div style={{ flex: 1, backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', overflowY: 'auto' }}>
                <div style={{ position: 'sticky', top: 0, backgroundColor: '#f9f9f9', zIndex: 2, paddingBottom: '10px', borderBottom: '2px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>{selectedDate.toLocaleDateString('ms-MY')}</h4>
                  <button onClick={() => openApptModal()} style={{ padding: '4px 8px', backgroundColor: colors.blue, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+ Tambah</button>
                </div>

                {isHoliday ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>CUTI UMUM: {isHoliday.keterangan}</div>
                ) : (
                  <>
                    <h5 style={{ color: colors.orange, borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>Kontak Auto (PPKP)</h5>
                    {appointmentsOnSelectedDate.length === 0 ? <p style={{fontSize:'12px', color:'#888'}}>Tiada rekod kontak.</p> : (
                      <ul style={{ fontSize: '12px', paddingLeft: '15px', margin: '0 0 15px 0' }}>
                        {appointmentsOnSelectedDate.map(c => {
                          const ks = indexCases.find(i => i.id === c.index_case_id);
                          return (
                            <li key={c.id} style={{ marginBottom: '5px' }}>
                              <strong>{c.nama}</strong> ({c.status_tb || 'Dalam Saringan'})<br/>
                              {/* NO DAFTAR TIBI DITAMBAH DI SINI */}
                              <span style={{ color: '#666', fontSize: '11px' }}>No. Tibi: <strong>{ks?.no_daftar_tibi || '-'}</strong> | Indeks: {ks?.nama || '-'}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <h5 style={{ color: colors.blue, borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>Temujanji Custom (PR1)</h5>
                    {customApptsOnSelected.length === 0 ? <p style={{fontSize:'12px', color:'#888'}}>Tiada rekod custom.</p> : (
                      <ul style={{ fontSize: '12px', paddingLeft: '0', listStyle: 'none', margin: 0 }}>
                        {customApptsOnSelected.map(a => (
                          <li key={a.id} style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', position: 'relative' }}>
                            <button onClick={() => openApptModal(a)} style={{ position: 'absolute', top: '5px', right: '5px', background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                            <strong>{a.nama}</strong><br/>
                            TBK: {a.tbk} | Tujuan: <span style={{color: colors.blue, fontWeight: 'bold'}}>{a.tujuan}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL ADD/EDIT CUSTOM APPOINTMENT */}
      {showApptModal && (
        <div style={{...s.modalOverlay, zIndex: 1100}}>
          <div style={{...s.modalContent, width: '350px'}}>
            <h3 style={{ marginTop: 0 }}>{apptForm.id ? 'Edit' : 'Tambah'} Temujanji</h3>
            <form onSubmit={saveCustomAppt}>
              <div style={s.formGroup}><label style={{fontSize:'12px', fontWeight:'bold'}}>Klinik</label>
                <select value={apptForm.klinik} onChange={(e) => setApptForm({...apptForm, klinik: e.target.value})} style={s.select}>
                  <option value="KK Kulai">KK Kulai</option><option value="KK Kulai Besar">KK Kulai Besar</option>
                </select>
              </div>
              <div style={s.formGroup}><input type="text" placeholder="Nama Pesakit" value={apptForm.nama} onChange={(e) => setApptForm({...apptForm, nama: e.target.value})} required style={s.input}/></div>
              <div style={s.formGroup}><input type="text" placeholder="No TBK" value={apptForm.tbk} onChange={(e) => setApptForm({...apptForm, tbk: e.target.value})} required style={s.input}/></div>
              
              <div style={{ margin: '10px 0' }}>
                <label style={{fontSize:'12px', fontWeight:'bold', display:'block', marginBottom:'5px'}}>Tujuan (Boleh pilih lebih dari satu)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {['CXR', 'Appt', 'Kontak', 'Darah', 'Sputum'].map(opt => (
                    <label key={opt} style={{fontSize:'13px', cursor:'pointer'}}>
                      <input type="checkbox" checked={apptForm.tujuan.includes(opt)} onChange={() => handleTujuanToggle(opt)} /> {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="submit" style={{ flex: 1, padding: '8px', backgroundColor: colors.blue, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Simpan</button>
                {apptForm.id && <button type="button" onClick={() => deleteCustomAppt(apptForm.id)} style={{ padding: '8px', backgroundColor: colors.red, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🗑️ Padam</button>}
                <button type="button" onClick={() => setShowApptModal(false)} style={{ padding: '8px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KEMASKINI UJIAN KLINIKAL (PR1) */}
      {showModal && selectedContact && (
        <div style={s.modalOverlay}>
          <div style={{...s.modalContent, width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto'}}>
            <button onClick={closeEditModal} style={{ position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', zIndex: 10 }}>&times;</button>
            <h2 style={{ marginTop: 0, borderBottom: '2px solid #ddd', paddingBottom: '10px' }}>Rekod Klinikal Kontak: <span style={{color: colors.blue}}>{selectedContact.nama}</span></h2>
            
            <form onSubmit={handleContactSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                
                {[1, 2, 3, 4].map(n => (
                  <div key={n} style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #ccc' }}>
                    <h4 style={{ margin: '0 0 10px 0', backgroundColor: colors.dark, color: 'white', padding: '5px 10px', borderRadius: '4px' }}>Saringan {n}</h4>
                    
                    <div style={s.formGroup}>
                      <label style={{fontSize:'12px', fontWeight:'bold'}}>Tarikh Diberi (Asal)</label>
                      <input type="date" value={contactForm[`tarikh_saringan_${n}`] || ''} onChange={(e) => handleContactChange(`tarikh_saringan_${n}`, e.target.value)} style={s.input}/>
                    </div>
                    
                    <div style={s.formGroup}>
                      <label style={{fontSize:'12px', fontWeight:'bold', color: colors.red}}>Tarikh Saringan Baru (Ganti)</label>
                      <input type="date" value={contactForm[`tarikh_saringan_${n}_baru`] || ''} onChange={(e) => handleContactChange(`tarikh_saringan_${n}_baru`, e.target.value)} style={{...s.input, borderColor: colors.red}}/>
                    </div>
                    
                    <div style={{ borderTop: '1px dashed #ccc', margin: '10px 0' }}></div>
                    
                    <div style={s.formGroup}>
                      <label style={{fontSize:'12px', fontWeight:'bold', color: colors.green}}>Tarikh Hadir (Klinik)</label>
                      <input type="date" value={contactForm[`tarikh_hadir_${n}`] || ''} onChange={(e) => handleContactChange(`tarikh_hadir_${n}`, e.target.value)} style={{...s.input, backgroundColor: '#dcfce7'}}/>
                    </div>

                    <div style={s.formGroup}>
                      <label style={{fontSize:'12px', fontWeight:'bold'}}>Ujian IGRA</label>
                      <select value={contactForm[`igra_${n}`] || ''} onChange={(e) => handleContactChange(`igra_${n}`, e.target.value)} style={s.select}>
                        <option value="">Tiada Data</option><option value="Tidak Dibuat">Tidak Dibuat</option><option value="Pending">Pending / Menunggu</option><option value="Negatif">Negatif</option><option value="Positif">Positif</option>
                      </select>
                    </div>

                    <div style={s.formGroup}>
                      <label style={{fontSize:'12px', fontWeight:'bold'}}>Ujian Mantoux</label>
                      <select value={contactForm[`mantoux_${n}`] || ''} onChange={(e) => handleContactChange(`mantoux_${n}`, e.target.value)} style={s.select}>
                        <option value="">Tiada Data</option><option value="Tidak Dibuat">Tidak Dibuat</option><option value="Pending">Pending / Menunggu</option><option value="Negatif">Negatif</option><option value="Positif">Positif</option>
                      </select>
                    </div>

                    <div style={s.formGroup}>
                      <label style={{fontSize:'12px', fontWeight:'bold'}}>Ujian CXR</label>
                      <select value={contactForm[`cxr_${n}`] || ''} onChange={(e) => handleContactChange(`cxr_${n}`, e.target.value)} style={s.select}>
                        <option value="">Tiada Data</option><option value="Tidak Dibuat">Tidak Dibuat</option><option value="Pending">Pending / Menunggu</option><option value="Normal">Normal</option><option value="Abnormal">Abnormal</option>
                      </select>
                    </div>

                  </div>
                ))}

              </div>

              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>Status Automatik Sistem:</h4>
                  <span style={{ fontSize: '18px', fontWeight: 'bold', color: contactForm.status_tb === 'Aktif TB' ? colors.red : contactForm.status_tb === 'Tiada TB' ? colors.green : colors.blue }}>
                    {calculateAutoStatus(contactForm)}
                  </span>
                </div>
                <button type="submit" disabled={loadingContact} style={{ padding: '12px 25px', backgroundColor: colors.green, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
                  {loadingContact ? 'Menyimpan...' : '💾 Simpan & Sahkan Keputusan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}