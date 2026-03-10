import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx'; 
import Calendar from 'react-calendar'; 
import 'react-calendar/dist/Calendar.css'; 
import { jsPDF } from 'jspdf'; 

export default function ScreenPPKP() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    no_daftar_tibi: '', nama: '', ic_no: '', no_tel: '', alamat: '', 
    tarikh_notifikasi: '', tarikh_diagnosis: '', klinik: 'KK Kulai', kategori: 'Smear Positif'
  });
  const [loading, useStateLoading] = useState(false);
  const [indexCases, setIndexCases] = useState([]);
  const [allContacts, setAllContacts] = useState([]); 
  const [expandedCaseId, setExpandedCaseId] = useState(null); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKlinik, setFilterKlinik] = useState('Semua');
  const [filterOutstanding, setFilterOutstanding] = useState(false);
  const [showFinished, setShowFinished] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null); 
  
  // State untuk Muat Naik Pukal (Bulk Upload)
  const [contactUploadMode, setContactUploadMode] = useState('manual'); // 'manual' | 'excel'
  const [bulkContacts, setBulkContacts] = useState([]);
  
  const [contactForm, setContactForm] = useState({
    nama: '', ic_no: '', no_tel: '', alamat: '', tarikh_saringan_1: '', pegawai_notis: 'Maziah'
  });
  const [loadingContact, setLoadingContact] = useState(false);
  
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: casesData } = await supabase.from('index_cases').select('*').order('created_at', { ascending: false });
    const { data: contactsData } = await supabase.from('contacts').select('*').order('created_at', { ascending: true });
    if (casesData) setIndexCases(casesData);
    if (contactsData) setAllContacts(contactsData);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };
  const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    useStateLoading(true);
    const { error } = await supabase.from('index_cases').insert([formData]);
    if (!error) {
      alert('Kes Indeks berjaya didaftarkan!');
      setFormData({ no_daftar_tibi: '', nama: '', ic_no: '', no_tel: '', alamat: '', tarikh_notifikasi: '', tarikh_diagnosis: '', klinik: 'KK Kulai', kategori: 'Smear Positif' });
      fetchData();
    } else {
      alert('Ralat menyimpan indeks: ' + error.message);
    }
    useStateLoading(false);
  };

  const handleDeleteIndex = async (id, nama) => {
    if (window.confirm(`Adakah anda pasti mahu memadam Kes Indeks: ${nama}?`)) {
      await supabase.from('index_cases').delete().eq('id', id);
      fetchData();
    }
  };

  const handleDeleteContact = async (id, nama) => {
    if (window.confirm(`Adakah anda pasti mahu memadam Kontak: ${nama}?`)) {
      await supabase.from('contacts').delete().eq('id', id);
      fetchData();
    }
  };

  const handleSendSMS = async (kontakId, noTel, namaKontak, tarikhSaringan, klinik, saringanLvl) => {
    try {
      await supabase.from('contacts').update({ sms_status: `Sedang Dihantar (S${saringanLvl})...` }).eq('id', kontakId);
      fetchData();
      
      const mesej = `PKD Kulai: Salam En/Pn ${namaKontak}. Anda mempunyai temujanji Saringan TB di ${klinik} pada ${tarikhSaringan}. Sila hadir mengikut jadual.`;
      const apiKey = 'fea7875864e5a9e124b1080109b5dd8b'; 
      
      let formatTel = noTel.replace(/[^0-9]/g, ''); 
      if (formatTel.startsWith('0')) formatTel = '6' + formatTel; 
      
      const targetUrl = `/api/sms?apiKey=${apiKey}&recipients=${formatTel}&messageContent=${encodeURIComponent(mesej)}`;
      
      const response = await fetch(targetUrl, { method: 'GET' });
      const responseText = await response.text();
      
      if (responseText.toLowerCase().includes('ok') || responseText.toLowerCase().includes('success')) {
        await supabase.from('contacts').update({ sms_status: `Berjaya (S${saringanLvl})` }).eq('id', kontakId);
      } else {
        await supabase.from('contacts').update({ sms_status: 'Gagal' }).eq('id', kontakId);
      }
      fetchData(); 
    } catch (error) {
      await supabase.from('contacts').update({ sms_status: 'Gagal' }).eq('id', kontakId);
      fetchData();
    }
  };

  const getBase64ImageFromUrl = async (imageUrl) => {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result), false);
      reader.onerror = () => reject(this);
      reader.readAsDataURL(blob);
    });
  };

  const generateNotisPDF = async (kontak, kes, pegawai) => {
    const doc = new jsPDF();
    const margin = 20;
    let y = 15; 

    try {
      const jataBase64 = await getBase64ImageFromUrl('/jata.jpg');
      const kkmBase64 = await getBase64ImageFromUrl('/kkm.jpg');
      doc.addImage(jataBase64, 'JPEG', 72, y, 28, 22);
      doc.addImage(kkmBase64, 'JPEG', 110, y, 22, 22);
      y += 35; 
    } catch (err) {
      y += 15; 
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("NOTIS MENJALANI PEMERIKSAAN PENGESAHAN PENYAKIT TIBI", 105, y, { align: "center" });

    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    const formatTarikhDiberi = (tarikhStr) => {
      if (!tarikhStr) return '...................';
      const d = new Date(tarikhStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    // 1. KEMASKINI PERENGGAN 1 & 2 (MENGANDUNGI "UNIT TIBI" DAN MASA "8.30 PAGI")
    const p1 = `Adalah dimaklumkan bahawa penyiasatan pihak kami mendapati Tuan/Puan bernama ${kontak.nama} mempunyai kaitan rapat dengan pesakit Tibi ${kes.nama} yang boleh menyebabkan Tuan/Puan atau individu/mereka yang di bawah jagaan Tuan/Puan turut mendapat jangkitan Tibi.`;
    doc.text(p1, margin, y, { maxWidth: 170, align: "justify" });
    y += (doc.splitTextToSize(p1, 170).length * 6) + 5;

    const p2 = `2. Oleh yang demikian, Tuan/Puan dan/atau individu/mereka yang di bawah jagaan Tuan/Puan diarah untuk menghadirkan diri ke Unit Tibi ${kes.klinik} pada waktu pejabat pada ${formatTarikhDiberi(kontak.tarikh_saringan_1)} pukul 8.30 pagi bagi menjalani pemeriksaan saringan dan pengesahan penyakit Tibi.`;
    doc.text(p2, margin, y, { maxWidth: 170, align: "justify" });
    y += (doc.splitTextToSize(p2, 170).length * 6) + 5;

    const p3 = `3. Kegagalan Tuan/Puan atau individu/mereka yang dibawah jagaan Tuan/Puan hadir menjalani pemeriksaan boleh ditafsir sebagai enggan bekerjasama bagi membendung penyebaran penyakit berjangkit. Ini memungkinkan Tuan/Puan dikenakan tindakan undang-undang di bawah Seksyen 15, Akta Pencegahan dan Pengawalan Penyakit Berjangkit 1988.`;
    doc.text(p3, margin, y, { maxWidth: 170, align: "justify" });
    y += (doc.splitTextToSize(p3, 170).length * 6) + 12;

    doc.text("Sekian, terima kasih.", margin, y);
    y += 12;

    doc.setFont("helvetica", "bold");
    doc.text("BERKHIDMAT UNTUK NEGARA", margin, y);
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.text("Saya yang menurut perintah,", margin, y);
    y += 15; 

    if (pegawai === 'Maziah') {
      try {
        const maziahBase64 = await getBase64ImageFromUrl('/tandatangan-maziah.jpg');
        doc.addImage(maziahBase64, 'JPEG', margin, y - 5, 100, 30);
        y += 30;
      } catch (err) {
        doc.setFont("helvetica", "bold");
        doc.text("MAZIAH BINTI MD NOOR", margin, y);
        y += 6;
        doc.text("PEN. PEG. KESIHATAN PERSEKITARAN", margin, y);
        y += 6;
        doc.text("UNIT TIBI, PEJABAT KESIHATAN KULAI", margin, y);
        y += 10;
        doc.setFont("helvetica", "normal");
      }
      doc.text("No. Telefon: +60 12-747 8949", margin, y);
    } 
    else {
      doc.text(".......................................................................", margin, y);
      y += 7;
      doc.setFont("helvetica", "bold");
      doc.text("MOHD FAUZI BIN ZAINI", margin, y);
      y += 6;
      doc.text("PEN. PEG. KESIHATAN PERSEKITARAN", margin, y);
      y += 6;
      doc.text("UNIT TIBI, PEJABAT KESIHATAN KULAI", margin, y);
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.text("No. Telefon: +60 11-1171 5397", margin, y);
    }

    y += 8;
    const today = new Date().toLocaleDateString('ms-MY');
    doc.text(`Tarikh: ${today}`, margin, y);

    doc.save(`${kontak.nama}.pdf`);
  };

  const openModal = (kes) => { 
    setSelectedCase(kes); 
    setContactUploadMode('manual');
    setBulkContacts([]);
    setShowModal(true); 
  };
  
  const closeModal = () => { 
    setShowModal(false); 
    setSelectedCase(null); 
    setContactForm({ nama: '', ic_no: '', no_tel: '', alamat: '', tarikh_saringan_1: '', pegawai_notis: 'Maziah' }); 
    setBulkContacts([]);
  };

  const handleContactChange = (e) => { setContactForm({ ...contactForm, [e.target.name]: e.target.value }); };

  // ==========================================
  // FUNGSI MUAT NAIK EXCEL PUKAL (BULK UPLOAD)
  // ==========================================
  const downloadExcelTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'Nama Penuh Kontak': 'Ahmad bin Abu',
      'No Kad Pengenalan': '900101011234',
      'No Telefon': '0123456789',
      'Alamat Rumah': 'No 1, Jalan Raya',
      'Daerah/Negeri': 'Kulai, Johor',
      'Tarikh Saringan 1 Diberi': '2026-03-25' // Format YYYY-MM-DD
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Kontak");
    XLSX.writeFile(wb, "Template_Muat_Naik_Kontak.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });
      
      const formattedData = data.map((row, index) => ({
        id: index,
        nama: row['Nama Penuh Kontak'] || '',
        ic_no: row['No Kad Pengenalan'] || '',
        no_tel: String(row['No Telefon'] || ''),
        alamat: row['Alamat Rumah'] || '',
        daerah_negeri: row['Daerah/Negeri'] || '',
        tarikh_saringan_1: row['Tarikh Saringan 1 Diberi'] || '',
        selectedToSave: true,
        sendSMS: true,
        genPDF: true,
      }));
      setBulkContacts(formattedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkCheck = (index, field, value) => {
    const newBulk = [...bulkContacts];
    newBulk[index][field] = value;
    setBulkContacts(newBulk);
  };

  // Submit Manual
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setLoadingContact(true);
    const { data, error } = await supabase.from('contacts').insert([{
        index_case_id: selectedCase.id, nama: contactForm.nama, ic_no: contactForm.ic_no,
        no_tel: contactForm.no_tel, alamat: contactForm.alamat, tarikh_saringan_1: contactForm.tarikh_saringan_1,
        sms_status: 'Belum Dihantar'
    }]).select();
    
    if (!error && data) {
      closeModal();
      handleSendSMS(data[0].id, data[0].no_tel, data[0].nama, data[0].tarikh_saringan_1, selectedCase.klinik, 1);
      await generateNotisPDF(data[0], selectedCase, contactForm.pegawai_notis);
    }
    setLoadingContact(false);
  };

  // Submit Excel
  const handleBulkSubmit = async () => {
    setLoadingContact(true);
    for (const c of bulkContacts) {
      if (!c.selectedToSave) continue;
      
      const fullAlamat = `${c.alamat}, ${c.daerah_negeri}`; // Gabung alamat & daerah/negeri
      
      const { data, error } = await supabase.from('contacts').insert([{
        index_case_id: selectedCase.id,
        nama: c.nama,
        ic_no: c.ic_no,
        no_tel: c.no_tel,
        alamat: fullAlamat,
        tarikh_saringan_1: c.tarikh_saringan_1,
        sms_status: 'Belum Dihantar'
      }]).select();

      if (!error && data) {
        if (c.sendSMS) {
          await handleSendSMS(data[0].id, data[0].no_tel, data[0].nama, data[0].tarikh_saringan_1, selectedCase.klinik, 1);
        }
        if (c.genPDF) {
          await generateNotisPDF(data[0], selectedCase, contactForm.pegawai_notis);
        }
      }
    }
    setLoadingContact(false);
    closeModal();
    fetchData();
    alert('Selesai memproses muat naik kontak pukal!');
  };

  const toggleContacts = (caseId) => { setExpandedCaseId(expandedCaseId === caseId ? null : caseId); };

  const handleExportExcel = () => {
    const exportData = [];
    const formatDateTime = (dateString) => {
      if (!dateString) return '-';
      return new Date(dateString).toLocaleString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    indexCases.forEach(kes => {
      const caseContacts = allContacts.filter(c => c.index_case_id === kes.id);
      if (caseContacts.length === 0) {
        exportData.push({
          'Tarikh Didaftar': formatDateTime(kes.created_at), 'No Daftar Tibi': kes.no_daftar_tibi, 'Klinik': kes.klinik, 'Kategori Indeks': kes.kategori,
          'Nama Indeks': kes.nama, 'No K/P Indeks': kes.ic_no, 'Nama Kontak': 'TIADA KONTAK', 'No Tel': '-',
          'Sar. 1 (Diberi)': '-', 'Hadir Sar. 1': '-', 'Sar. 2 (Diberi)': '-', 'Hadir Sar. 2': '-',
          'Sar. 3 (Diberi)': '-', 'Hadir Sar. 3': '-', 'Sar. 4 (Diberi)': '-', 'Hadir Sar. 4': '-',
        });
      } else {
        caseContacts.forEach(kontak => {
          exportData.push({
            'Tarikh Didaftar': formatDateTime(kes.created_at), 'No Daftar Tibi': kes.no_daftar_tibi, 'Klinik': kes.klinik, 'Kategori Indeks': kes.kategori,
            'Nama Indeks': kes.nama, 'No K/P Indeks': kes.ic_no, 'Nama Kontak': kontak.nama, 'No Tel': kontak.no_tel,
            'Sar. 1 (Diberi)': kontak.tarikh_saringan_1 || '-', 'Hadir Sar. 1': kontak.tarikh_hadir_1 || 'BELUM',
            'Sar. 2 (Diberi)': kontak.tarikh_saringan_2 || '-', 'Hadir Sar. 2': kontak.tarikh_hadir_2 || 'BELUM',
            'Sar. 3 (Diberi)': kontak.tarikh_saringan_3 || '-', 'Hadir Sar. 3': kontak.tarikh_hadir_3 || 'BELUM',
            'Sar. 4 (Diberi)': kontak.tarikh_saringan_4 || '-', 'Hadir Sar. 4': kontak.tarikh_hadir_4 || 'BELUM',
          });
        });
      }
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Kes_dan_Kontak");
    XLSX.writeFile(workbook, "Laporan_TBCM_Kulai.xlsx");
  };

  const formatSafeDate = (d) => {
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = formatSafeDate(new Date());
  
  const selectedDateStr = formatSafeDate(selectedDate);
  const appointmentsOnSelectedDate = allContacts.filter(c => 
    c.tarikh_saringan_1 === selectedDateStr || 
    c.tarikh_saringan_2 === selectedDateStr || 
    c.tarikh_saringan_3 === selectedDateStr || 
    c.tarikh_saringan_4 === selectedDateStr
  );

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const dateStr = formatSafeDate(date);
      const adaTemujanji = allContacts.some(c => 
        c.tarikh_saringan_1 === dateStr || 
        c.tarikh_saringan_2 === dateStr || 
        c.tarikh_saringan_3 === dateStr || 
        c.tarikh_saringan_4 === dateStr
      );
      if (adaTemujanji) {
        return <div style={{ height: '6px', width: '6px', backgroundColor: 'red', borderRadius: '50%', margin: 'auto', marginTop: '2px' }}></div>;
      }
    }
    return null;
  };

  const isContactOutstanding = (c) => {
    for (let i = 1; i <= 4; i++) {
      const sDate = c[`tarikh_saringan_${i}`];
      const hDate = c[`tarikh_hadir_${i}`];
      if (sDate && sDate <= todayStr && !hDate) return true;
    }
    return false;
  };

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

  const filteredCases = indexCases.filter(kes => {
    const contacts = allContacts.filter(c => c.index_case_id === kes.id);
    const matchName = kes.nama.toLowerCase().includes(searchTerm.toLowerCase()) || kes.ic_no.includes(searchTerm);
    const matchKlinik = filterKlinik === 'Semua' || kes.klinik === filterKlinik;
    const matchFinished = showFinished ? kes.is_finished : !kes.is_finished;
    const matchOutstanding = filterOutstanding ? contacts.some(c => isContactOutstanding(c)) : true;
    return matchName && matchKlinik && matchFinished && matchOutstanding;
  });

  const getSummaryStyle = (attended, total) => {
    if (total === 0) return { color: '#64748b', fontWeight: 'normal' };
    if (attended === 0) return { color: '#ef4444', fontWeight: 'bold' };
    if (attended < total) return { color: '#d97706', fontWeight: 'bold' };
    return { color: '#10b981', fontWeight: 'bold' };
  };

  const colors = { dark: '#1e293b', blue: '#007bff', cyan: '#17a2b8', green: '#28a745', yellow: '#ffc107', red: '#dc3545', grey: '#6c757d', purple: '#8b5cf6', pink: '#ec4899' };
  const s = {
    page: { padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh' },
    topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #ddd', paddingBottom: '15px', marginBottom: '20px' },
    h1: { margin: 0, color: colors.dark, fontSize: '24px' },
    p: { margin: '5px 0 0 0', color: colors.grey },
    kpiLayout: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' },
    kpiCard: (color) => ({ backgroundColor: '#fff', padding: '15px 20px', borderRadius: '8px', borderLeft: `5px solid ${color}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }),
    mainLayout: { display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' },
    cardLeft: { flex: '1', minWidth: '300px', maxWidth: '350px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', position: 'sticky', top: '20px' },
    cardRight: { flex: '2', minWidth: '600px', backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflowX: 'auto' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '100%', boxSizing: 'border-box' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
    th: { padding: '12px', backgroundColor: '#343a40', color: '#fff', textAlign: 'left', borderBottom: '2px solid #ddd' },
    td: { padding: '12px', borderBottom: '1px solid #ddd', verticalAlign: 'middle' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modalContent: { backgroundColor: 'white', padding: '30px', borderRadius: '8px', position: 'relative', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
    tabBtn: (active) => ({ flex: 1, padding: '10px', fontWeight: 'bold', cursor: 'pointer', border: 'none', backgroundColor: active ? colors.blue : '#e2e3e5', color: active ? '#fff' : '#333', borderRadius: '4px 4px 0 0' })
  };

  return (
    <div style={s.page}>
      <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }`}</style>
      
      <div style={s.topHeader}>
        <div>
          <h1 style={s.h1}>TBCM Kulai</h1>
          <p style={s.p}>Papan Pemuka Penolong Pegawai Kesihatan Persekitaran (PPKP)</p>
        </div>
        <button onClick={handleLogout} style={{ padding: '10px 20px', backgroundColor: colors.red, color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>Log Keluar</button>
      </div>

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

      <div style={s.mainLayout}>
        {/* BORANG TAMBAH INDEKS */}
        <div style={s.cardLeft}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>+ Daftar Kes Indeks</h3>
          <form onSubmit={handleSubmit}>
            <div style={s.formGroup}><input type="text" name="no_daftar_tibi" placeholder="No. Daftar Tibi" value={formData.no_daftar_tibi} onChange={handleChange} required style={{...s.input, borderColor: colors.blue, borderWidth: '2px'}}/></div>
            <div style={s.formGroup}><input type="text" name="nama" placeholder="Nama Penuh" value={formData.nama} onChange={handleChange} required style={s.input}/></div>
            <div style={s.formGroup}><input type="text" name="ic_no" placeholder="No. Kad Pengenalan" value={formData.ic_no} onChange={handleChange} required style={s.input}/></div>
            <div style={s.formGroup}><input type="text" name="no_tel" placeholder="No. Telefon" value={formData.no_tel} onChange={handleChange} required style={s.input}/></div>
            <div style={s.formGroup}><textarea name="alamat" placeholder="Alamat Rumah" value={formData.alamat} onChange={handleChange} required style={{...s.input, minHeight: '60px'}}/></div>
            <div style={s.formGroup}><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Tarikh Terima Notifikasi</label><input type="date" name="tarikh_notifikasi" value={formData.tarikh_notifikasi} onChange={handleChange} required style={s.input}/></div>
            <div style={s.formGroup}><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Tarikh Diagnosis</label><input type="date" name="tarikh_diagnosis" value={formData.tarikh_diagnosis} onChange={handleChange} required style={s.input}/></div>
            <div style={s.formGroup}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Klinik Bertanggungjawab</label>
              <select name="klinik" value={formData.klinik} onChange={handleChange} required style={s.input}><option value="KK Kulai">KK Kulai</option><option value="KK Kulai Besar">KK Kulai Besar</option></select>
            </div>
            <div style={s.formGroup}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Kategori Penyakit</label>
              <select name="kategori" value={formData.kategori} onChange={handleChange} required style={s.input}><option value="Smear Positif">Smear Positif</option><option value="Smear Negatif">Smear Negatif</option><option value="ExtraPTB">Extra PTB</option></select>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', backgroundColor: colors.blue, color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold', marginTop: '10px' }}>{loading ? 'Menyimpan...' : 'Simpan Kes Indeks'}</button>
          </form>
        </div>

        <div style={s.cardRight}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ margin: 0 }}>Senarai Kes Indeks & Kontak</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowCalendar(true)} style={{ padding: '8px 12px', backgroundColor: colors.cyan, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📅 Kalendar</button>
              <button onClick={handleExportExcel} style={{ padding: '8px 12px', backgroundColor: colors.green, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Excel</button>
              <input type="text" placeholder="Cari Nama/KP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <select value={filterKlinik} onChange={(e) => setFilterKlinik(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}><option value="Semua">Semua Klinik</option><option value="KK Kulai">KK Kulai</option><option value="KK Kulai Besar">KK Kulai Besar</option></select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: colors.red, fontWeight: 'bold' }}><input type="checkbox" checked={filterOutstanding} onChange={() => setFilterOutstanding(!filterOutstanding)} /> Outstanding</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: colors.grey, fontWeight: 'bold' }}><input type="checkbox" checked={showFinished} onChange={() => setShowFinished(!showFinished)} /> Selesai</label>
            </div>
          </div>

          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Kes Indeks & Outstanding</th>
                <th style={s.th}>Summary Kehadiran Kontak</th>
                <th style={{...s.th, textAlign: 'right'}}>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.length === 0 ? <tr><td colSpan="3" style={{textAlign:'center', padding:'20px'}}>Tiada data yang sepadan.</td></tr> :
              filteredCases.map((kes) => {
                const caseContacts = allContacts.filter(c => c.index_case_id === kes.id);
                const hasOutstanding = caseContacts.some(c => isContactOutstanding(c));
                const isExpanded = expandedCaseId === kes.id;

                return (
                  <React.Fragment key={kes.id}>
                    <tr style={{ backgroundColor: kes.is_finished ? '#e9ecef' : 'transparent' }}>
                      <td style={s.td}>
                        {hasOutstanding && <span style={{ width: '10px', height: '10px', backgroundColor: colors.red, borderRadius: '50%', display: 'inline-block', marginRight: '8px', animation: 'pulse 1.5s infinite' }} title="Saringan Tertunggak"></span>}
                        <strong>{kes.nama}</strong> <br /><span style={{fontSize:'12px', color:'#666'}}>No. Tibi: {kes.no_daftar_tibi || '-'} | {kes.kategori} | {kes.klinik}</span>
                      </td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                          {[1, 2, 3, 4].map(n => {
                            const attended = caseContacts.filter(c => c[`tarikh_hadir_${n}`]).length;
                            return <span key={n} style={{ ...getSummaryStyle(attended, caseContacts.length), fontSize: '12px' }}>S{n}: {attended}/{caseContacts.length}</span>
                          })}
                        </div>
                      </td>
                      <td style={{...s.td, textAlign: 'right'}}>
                        <button onClick={() => toggleContacts(kes.id)} style={{ padding: '6px 10px', backgroundColor: '#e2e3e5', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' }}>{isExpanded ? 'Tutup' : `Lihat Kontak`}</button>
                        <button onClick={() => openModal(kes)} style={{ padding: '6px 10px', backgroundColor: colors.blue, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginRight: '5px' }}>+ Kontak</button>
                        <button onClick={() => handleDeleteIndex(kes.id, kes.nama)} style={{ padding: '6px 10px', backgroundColor: colors.red, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr>
                        <td colSpan="3" style={{ padding: '15px', backgroundColor: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                          <div style={{ borderLeft: `3px solid ${colors.blue}`, paddingLeft: '15px' }}>
                            {caseContacts.length === 0 ? ( <p style={{ color: '#666', fontStyle: 'italic', margin: 0 }}>Tiada kontak didaftarkan.</p> ) : (
                              caseContacts.map(c => (
                                <div key={c.id} style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #ddd', position: 'relative' }}>
                                  
                                  <button onClick={() => handleDeleteContact(c.id, c.nama)} style={{ position: 'absolute', top: '10px', right: '15px', color: colors.red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>✕</button>
                                  
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div>
                                      <strong style={{ fontSize: '15px' }}>{c.nama}</strong> <span style={{fontWeight:'normal', fontSize:'12px', color:'#666'}}>({c.no_tel})</span>
                                      <span style={{ marginLeft: '10px', fontSize: '11px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#e2e8f0', color: '#475569' }}>Status SMS: {c.sms_status || 'Belum Dihantar'}</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                      <button onClick={() => generateNotisPDF(c, kes, 'Maziah')} style={{ padding: '6px 10px', backgroundColor: colors.purple, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                        📄 Notis (Maziah)
                                      </button>
                                      <button onClick={() => generateNotisPDF(c, kes, 'Fauzi')} style={{ padding: '6px 10px', backgroundColor: colors.pink, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                        📄 Notis (Fauzi)
                                      </button>
                                    </div>
                                  </div>
                                  
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                                    {[1, 2, 3, 4].map(n => (
                                      <div key={n} style={{ fontSize: '12px', padding: '10px', backgroundColor: '#f4f6f9', borderRadius: '6px', border: '1px solid #eee' }}>
                                        <div style={{ marginBottom: '5px' }}><strong>S{n}:</strong> {c[`tarikh_saringan_${n}`] || '-'}</div>
                                        <div style={{ marginBottom: '8px' }}><strong>Hadir:</strong> <span style={{ color: c[`tarikh_hadir_${n}`] ? colors.green : colors.red, fontWeight: 'bold' }}>{c[`tarikh_hadir_${n}`] || 'Belum'}</span></div>
                                        
                                        {c[`tarikh_saringan_${n}`] && !c[`tarikh_hadir_${n}`] && (
                                          <button onClick={() => handleSendSMS(c.id, c.no_tel, c.nama, c[`tarikh_saringan_${n}`], kes.klinik, n)} 
                                            style={{ width: '100%', padding: '5px', backgroundColor: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>
                                            ✉️ Hantar Notis S{n}
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                </div>
                              ))
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
        </div>
      </div>

      {showCalendar && (
        <div style={s.modalOverlay}>
          {/* Tambah maxHeight, display flex dan column supaya ia tak lebih dari skrin */}
          <div style={{...s.modalContent, maxHeight: '90vh', display: 'flex', flexDirection: 'column', width: '450px'}}>
            
            {/* Butang pangkah statik */}
            <button onClick={() => setShowCalendar(false)} style={{ position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', zIndex: 10 }}>&times;</button>
            
            <h3 style={{ marginTop: 0, textAlign: 'center', flexShrink: 0 }}>Jadual Temujanji Mengikut Klinik</h3>
            
            {/* Kalendar statik */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0', flexShrink: 0 }}>
              <Calendar onChange={setSelectedDate} value={selectedDate} tileContent={tileContent} />
            </div>
            
            {/* RUANGAN SENARAI YANG BOLEH DI-SCROLL */}
            <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', overflowY: 'auto', flexGrow: 1 }}>
              {/* Tajuk Tarikh Kekal di Atas bila scroll (Sticky) */}
              <h4 style={{ margin: '0 0 10px 0', position: 'sticky', top: 0, backgroundColor: '#f9f9f9', zIndex: 2, paddingBottom: '5px', borderBottom: '2px solid #ddd' }}>
                Temujanji: {selectedDate.toLocaleDateString('ms-MY')}
              </h4>
              
              {appointmentsOnSelectedDate.length === 0 ? ( <p>Tiada temujanji.</p> ) : (
                <ul style={{ fontSize: '14px', paddingLeft: '20px', margin: 0 }}>
                  {appointmentsOnSelectedDate.map(kontak => {
                    const ks = indexCases.find(i => i.id === kontak.index_case_id);
                    return (
                      <li key={kontak.id} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #ccc' }}>
                        <strong>{kontak.nama}</strong> ({kontak.no_tel})<br/>
                        <span style={{ color: colors.blue, fontWeight: 'bold', fontSize: '12px' }}>Klinik: {ks?.klinik || '-'}</span> <span style={{ color: '#666', fontSize: '12px' }}> | Indeks: {ks?.nama || '-'}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL TAMBAH KONTAK (MANUAL & EXCEL BULK) */}
      {showModal && (
        <div style={s.modalOverlay}>
          <div style={{...s.modalContent, width: contactUploadMode === 'excel' ? '90%' : '400px', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto'}}>
            <button onClick={closeModal} style={{ position: 'absolute', top: '10px', right: '15px', border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', zIndex: 10 }}>&times;</button>
            
            <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '20px' }}>
              <button style={s.tabBtn(contactUploadMode === 'manual')} onClick={() => setContactUploadMode('manual')}>✍️ Tambah Manual</button>
              <button style={s.tabBtn(contactUploadMode === 'excel')} onClick={() => setContactUploadMode('excel')}>📂 Muat Naik Excel (Pukal)</button>
            </div>

            <p style={{ color: '#666', marginBottom: '15px' }}>Indeks: <strong style={{color: '#333'}}>{selectedCase?.nama}</strong></p>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Surat Notis (Pilihan Pegawai)</label>
              <select name="pegawai_notis" value={contactForm.pegawai_notis} onChange={handleContactChange} style={s.input}>
                <option value="Maziah">Maziah Binti Md Noor (Ada Tandatangan)</option>
                <option value="Fauzi">Mohd Fauzi Bin Zaini (Teks Sahaja)</option>
              </select>
            </div>

            {/* TAB 1: MANUAL */}
            {contactUploadMode === 'manual' && (
              <form onSubmit={handleContactSubmit}>
                <div style={s.formGroup}><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Nama Penuh Kontak</label><input type="text" name="nama" value={contactForm.nama} onChange={handleContactChange} required style={s.input}/></div>
                <div style={s.formGroup}><label style={{ fontSize: '13px', fontWeight: 'bold' }}>No. Kad Pengenalan</label><input type="text" name="ic_no" value={contactForm.ic_no} onChange={handleContactChange} required style={s.input}/></div>
                <div style={s.formGroup}><label style={{ fontSize: '13px', fontWeight: 'bold' }}>No. Telefon</label><input type="text" name="no_tel" value={contactForm.no_tel} onChange={handleContactChange} required style={s.input}/></div>
                <div style={s.formGroup}><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Alamat Rumah</label><textarea name="alamat" value={contactForm.alamat} onChange={handleContactChange} required style={{...s.input, minHeight: '60px'}}/></div>
                <div style={s.formGroup}><label style={{ fontSize: '13px', fontWeight: 'bold' }}>Tarikh Saringan 1 (Diberi)</label><input type="date" name="tarikh_saringan_1" value={contactForm.tarikh_saringan_1} onChange={handleContactChange} required style={s.input}/></div>
                
                <button type="submit" disabled={loadingContact} style={{ width: '100%', padding: '10px', backgroundColor: colors.blue, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>{loadingContact ? 'Memproses...' : 'Simpan, Hantar SMS & Jana Notis (PDF)'}</button>
              </form>
            )}

            {/* TAB 2: EXCEL BULK UPLOAD */}
            {contactUploadMode === 'excel' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px dashed #ccc', marginBottom: '20px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0' }}>Langkah 1: Muat Turun Template</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: colors.grey }}>Sila guna template rasmi untuk elak ralat susunan lajur.</p>
                  </div>
                  <button onClick={downloadExcelTemplate} style={{ padding: '8px 15px', backgroundColor: colors.green, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Muat Turun Template</button>
                </div>

                <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px dashed #ccc', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 0' }}>Langkah 2: Muat Naik Fail Lengkap</h4>
                  <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ width: '100%' }} />
                </div>

                {bulkContacts.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #ddd', paddingBottom: '5px' }}>Langkah 3: Semakan & Pengesahan ({bulkContacts.length} Kontak)</h4>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{...s.table, fontSize: '12px'}}>
                        <thead>
                          <tr>
                            <th style={s.th}>Nama</th>
                            <th style={s.th}>KP & Tel</th>
                            <th style={s.th}>Alamat & Daerah</th>
                            <th style={s.th}>Tarikh S1</th>
                            <th style={{...s.th, textAlign: 'center'}}>Tindakan Auto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkContacts.map((c, idx) => (
                            <tr key={c.id}>
                              <td style={s.td}><strong>{c.nama}</strong></td>
                              <td style={s.td}>{c.ic_no}<br/>{c.no_tel}</td>
                              <td style={s.td}>{c.alamat}<br/>{c.daerah_negeri}</td>
                              <td style={s.td}>{c.tarikh_saringan_1}</td>
                              <td style={{...s.td, textAlign: 'left', minWidth: '150px'}}>
                                <label style={{ display: 'block', marginBottom: '3px' }}><input type="checkbox" checked={c.selectedToSave} onChange={(e) => handleBulkCheck(idx, 'selectedToSave', e.target.checked)} /> 💾 Simpan Rekod</label>
                                <label style={{ display: 'block', marginBottom: '3px' }}><input type="checkbox" checked={c.sendSMS} onChange={(e) => handleBulkCheck(idx, 'sendSMS', e.target.checked)} disabled={!c.selectedToSave}/> ✉️ Hantar SMS S1</label>
                                <label style={{ display: 'block' }}><input type="checkbox" checked={c.genPDF} onChange={(e) => handleBulkCheck(idx, 'genPDF', e.target.checked)} disabled={!c.selectedToSave}/> 📄 Jana Notis (PDF)</label>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={handleBulkSubmit} disabled={loadingContact} style={{ width: '100%', padding: '12px', backgroundColor: colors.blue, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', marginTop: '15px' }}>
                      {loadingContact ? 'Memproses Pukal (Sila Tunggu)...' : `Sahkan & Daftar ${bulkContacts.filter(c => c.selectedToSave).length} Kontak`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}