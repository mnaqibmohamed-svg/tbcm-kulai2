# TBCM Kulai - AI Coding Guidelines

## Architecture Overview
- **Role-based React SPA**: Login routes users to `/admin`, `/ppkp`, or `/pr1` based on `profiles.role` (Admin/PPKP/PR1)
- **Supabase Backend**: Auth via `supabase.auth`, data from `index_cases`, `contacts`, `profiles` tables
- **Key Screens**: `ScreenAdmin` (dashboard/charts/user mgmt), `ScreenPPKP` (case/contact mgmt, SMS/PDF), `ScreenPR1` (similar to PPKP but limited)

## Authentication & Routing
- Use `supabase.auth.signInWithPassword()` then fetch `profiles` for role/clinic
- Route protection: Check role on mount, redirect to `/` if unauthorized
- Logout: `await supabase.auth.signOut(); navigate('/');`

## Data Patterns
- Fetch with `supabase.from('table').select('*').order('created_at', { ascending: false })`
- Insert: `supabase.from('table').insert([data])`
- Update: `supabase.from('table').update({ field: value }).eq('id', id)`
- Delete: `supabase.from('table').delete().eq('id', id)`
- Always `fetchData()` after mutations to refresh state

## UI Conventions
- **Malay Text**: All user-facing strings in Malay (e.g., "Adakah anda pasti?" for confirmations)
- **State Management**: Local `useState` for forms/filters, `useEffect` for initial fetch
- **Forms**: Controlled inputs with `onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}`
- **Modals**: `showModal` state with conditional render
- **Filters**: `filterKlinik` dropdown, `filterOutstanding` checkbox for active cases

## External Integrations
- **SMS**: Fetch to `/api/sms` (proxied to sms123.net), format phone `6` + number, update `sms_status`
- **PDF**: jsPDF with justified text, base64 images from `/logo.jpg`, signatures per officer (Maziah/Fauzi)
- **Excel**: XLSX with formatted dates `new Date().toLocaleDateString('ms-MY')`, nested contact data
- **Charts**: Recharts `PieChart` for clinic stats in admin dashboard

## File Structure
- `src/pages/`: One component per role screen
- `src/supabaseClient.js`: Singleton client with env vars `VITE_SUPABASE_URL/ANON_KEY`
- `public/`: Static assets (logos, signatures) for PDF embedding

## Development Workflow
- `npm run dev`: Vite dev server
- `npm run build`: Production build
- `npm run lint`: ESLint with React hooks rules
- Deploy to Vercel with `vercel.json` rewrites for SMS API

## Code Style
- **Imports**: Group React, then router, supabase, libraries, components
- **Async/Await**: Always use for Supabase calls, wrap in try/catch
- **Alerts**: `alert('Berjaya!')` for success, `window.confirm()` for deletes
- **Dates**: Store as ISO strings, format with `new Date().toLocaleDateString('ms-MY')`</content>
<parameter name="filePath">/Users/admin/tbcm-kulai2/.github/copilot-instructions.md