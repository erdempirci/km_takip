
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Car, Gauge, Plus, History, Wallet, CheckCircle2,
  Clock3, RefreshCw, ArrowRight, Fuel, UserRound,
  AlertTriangle, X, ChevronRight, Route, ShieldCheck
} from 'lucide-react';

type Driver = 'Erdem Pirci' | 'Erdem Gündüz';

interface Drive {
  id: string;
  driver: string;
  start_km: number;
  end_km: number;
  work_days: number;
  is_approved: boolean;
  approved_by?: string | null;
  created_at: string;
}

const DRIVERS: Driver[] = ['Erdem Pirci', 'Erdem Gündüz'];
const DAILY_KM = 60;
const CONSUMPTION = 7.5;

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(n);

const money = (n: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);

const dateFmt = (date: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

const distance = (d: Drive) =>
  Math.max(0, Number(d.end_km) - Number(d.start_km));

const personal = (d: Drive) =>
  Math.max(0, distance(d) - Math.max(0, Number(d.work_days)) * DAILY_KM);

export default function Home() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [driver, setDriver] = useState<Driver>('Erdem Pirci');
  const [start, setStart] = useState('11000');
  const [end, setEnd] = useState('11000');
  const [days, setDays] = useState('1');
  const [price, setPrice] = useState('45');
  const [tab, setTab] = useState<'home' | 'history' | 'earnings'>('home');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'ok' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drives')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const records = (data ?? []) as Drive[];
      setDrives(records);

      if (records.length) {
        setStart(String(records[0].end_km));
        setEnd(String(records[0].end_km));
      }
    } catch (e) {
      console.error(e);
      setNotice({ text: 'Kayıtlar yüklenemedi. Bağlantını kontrol et.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    try {
      const p = localStorage.getItem('km-kontrol-fuel-price');
      if (p) setPrice(p);
    } catch {}
  }, [load]);

  useEffect(() => {
    try {
      localStorage.setItem('km-kontrol-fuel-price', price);
    } catch {}
  }, [price]);

  const latest = drives[0];

  const pending = useMemo(
    () => drives.find(d => !d.is_approved && d.driver !== driver),
    [drives, driver]
  );

  const stats = useMemo(() => DRIVERS.map(name => {
    const records = drives.filter(d => d.driver === name);
    const km = records.reduce((sum, d) => sum + personal(d), 0);
    const liters = km * CONSUMPTION / 100;
    return {
      name,
      records: records.length,
      km,
      liters,
      cost: liters * Math.max(0, Number(price) || 0),
    };
  }), [drives, price]);

  const tripKm = Math.max(0, Number(end || 0) - Number(start || 0));
  const allowance = Math.min(tripKm, Math.max(0, Number(days || 0)) * DAILY_KM);
  const personalKm = Math.max(0, tripKm - allowance);
  const estimate = personalKm * CONSUMPTION / 100 * Math.max(0, Number(price) || 0);

  const message = (text: string, type: 'ok' | 'error') => setNotice({ text, type });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const s = Number(start);
    const en = Number(end);
    const d = Number(days);

    if (!start.trim() || !end.trim() || !days.trim() ||
        !Number.isFinite(s) || !Number.isFinite(en) || !Number.isFinite(d) ||
        s < 0 || en <= s || d < 0 || !Number.isInteger(d)) {
      message('Kilometre ve iş günü bilgilerini kontrol et.', 'error');
      return;
    }

    if (latest && s < Number(latest.end_km)) {
      message(`Başlangıç KM, son gösterge (${fmt(Number(latest.end_km))}) değerinden düşük olamaz.`, 'error');
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const { error } = await supabase.from('drives').insert([{
        driver,
        start_km: s,
        end_km: en,
        work_days: d,
        is_approved: false,
      }]);

      if (error) throw error;

      message('Sürüş kaydedildi. Diğer kullanıcının onayı bekleniyor.', 'ok');
      await load();
    } catch (e) {
      console.error(e);
      message('Kayıt yapılamadı. Tekrar deneyebilirsin.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function approve(drive: Drive) {
    if (drive.driver === driver) {
      message('Kendi kaydını onaylayamazsın.', 'error');
      return;
    }

    if (!window.confirm(`${drive.driver} tarafından girilen ${fmt(Number(drive.end_km))} KM göstergesini onaylıyor musun?`)) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('drives')
        .update({ is_approved: true, approved_by: driver })
        .eq('id', drive.id)
        .eq('is_approved', false)
        .select('id');

      if (error) throw error;

      message(data?.length ? 'Devir teslim onaylandı.' : 'Kayıt daha önce onaylanmış olabilir.', 'ok');
      await load();
    } catch (e) {
      console.error(e);
      message('Onay işlemi başarısız oldu.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const history = drives.filter(d =>
    filter === 'all' ? true :
    filter === 'pending' ? !d.is_approved : d.is_approved
  );

  return (
    <main className="km-app">
      <style jsx global>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #f4f6f8; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #18212f; -webkit-font-smoothing: antialiased; }
        button, input, select { font: inherit; }
        button { cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .km-app { min-height: 100dvh; padding-bottom: 92px; background: #f4f6f8; }
        .km-header { background: #fff; border-bottom: 1px solid #e9edf1; padding: 18px 18px 16px; }
        .km-header-inner, .km-content, .km-nav { width: 100%; max-width: 560px; margin: auto; }
        .km-brand { display: flex; align-items: center; gap: 11px; }
        .km-logo { width: 43px; height: 43px; display: grid; place-items: center; border-radius: 13px; background: #eaf1ff; color: #2458cb; }
        .km-brand-title { font-size: 18px; font-weight: 850; letter-spacing: -.6px; }
        .km-brand-sub { margin-top: 3px; color: #8b95a3; font-size: 11px; }
        .km-user { margin-top: 17px; position: relative; }
        .km-label { display: block; margin-bottom: 7px; color: #758091; font-size: 11px; font-weight: 750; }
        .km-select, .km-input { width: 100%; min-height: 47px; padding: 0 12px; border: 1px solid #dfe5ec; border-radius: 11px; outline: none; background: #fff; color: #202b3b; font-size: 14px; }
        .km-select:focus, .km-input:focus { border-color: #4775db; box-shadow: 0 0 0 3px #4775db17; }
        .km-content { padding: 20px 16px; }
        .km-notice { display: flex; gap: 9px; align-items: flex-start; padding: 12px; border-radius: 12px; margin-bottom: 15px; font-size: 12px; line-height: 1.5; }
        .km-notice.ok { color: #166b48; background: #eaf8f0; border: 1px solid #c9edd9; }
        .km-notice.error { color: #a12e37; background: #fff0f0; border: 1px solid #f3d3d5; }
        .km-section { margin-bottom: 24px; }
        .km-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .km-section-title { margin: 0; font-size: 16px; font-weight: 850; letter-spacing: -.4px; }
        .km-section-sub { margin-top: 4px; font-size: 11px; color: #8893a2; }
        .km-icon-button { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid #e3e7ed; background: white; border-radius: 11px; color: #647184; }
        .km-odometer { padding: 20px; background: #1e3150; color: white; border-radius: 20px; box-shadow: 0 8px 22px #15284712; }
        .km-odometer-label { display: flex; align-items: center; gap: 7px; color: #b9c9e2; font-size: 11px; font-weight: 700; }
        .km-odometer-number { margin-top: 12px; font-size: clamp(36px, 10vw, 48px); line-height: 1.1; letter-spacing: -1.8px; font-weight: 900; overflow-wrap: anywhere; }
        .km-odometer-number small { margin-left: 7px; font-size: 12px; letter-spacing: 0; color: #b9c9e2; }
        .km-odometer-bottom { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 18px; padding-top: 13px; border-top: 1px solid #ffffff1c; font-size: 11px; color: #c7d2e3; }
        .km-pill { display: inline-flex; align-items: center; gap: 5px; border-radius: 99px; padding: 6px 9px; font-size: 10px; font-weight: 750; white-space: nowrap; }
        .km-pill.ok { color: #b7f5d0; background: #16825430; }
        .km-pill.wait { color: #ffdc99; background: #d88c2630; }
        .km-panel { border: 1px solid #e6eaf0; border-radius: 18px; background: white; padding: 16px; box-shadow: 0 3px 12px #15284705; }
        .km-panel-heading { display: flex; align-items: center; gap: 10px; padding-bottom: 14px; margin-bottom: 15px; border-bottom: 1px solid #edf0f4; }
        .km-panel-icon { display: grid; place-items: center; width: 35px; height: 35px; border-radius: 10px; background: #edf2ff; color: #315fc7; }
        .km-panel-title { font-size: 14px; font-weight: 850; }
        .km-panel-caption { margin-top: 3px; color: #8a95a5; font-size: 10px; }
        .km-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .km-input { font-size: 15px; font-weight: 750; font-variant-numeric: tabular-nums; }
        .km-preview { margin-top: 14px; padding: 13px; border-radius: 13px; background: #f5f7fb; border: 1px solid #e9edf3; }
        .km-preview-title { font-size: 11px; font-weight: 800; color: #697587; margin-bottom: 12px; }
        .km-preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 8px; }
        .km-preview-label { color: #8490a0; font-size: 10px; }
        .km-preview-value { margin-top: 4px; font-size: 17px; font-weight: 850; letter-spacing: -.4px; overflow-wrap: anywhere; }
        .km-blue { color: #285ac7; }
        .km-green { color: #188154; }
        .km-amber { color: #b86c18; }
        .km-button { display: flex; justify-content: center; align-items: center; gap: 9px; width: 100%; min-height: 49px; padding: 12px; margin-top: 15px; border: 0; border-radius: 12px; background: #285ed0; color: white; font-size: 13px; font-weight: 850; transition: background .15s, transform .1s; }
        .km-button:active { transform: scale(.99); }
        .km-button:disabled { opacity: .55; cursor: not-allowed; }
        .km-button.secondary { background: #eaf7ef; color: #176e49; }
        .km-help { margin-top: 10px; font-size: 10px; color: #929cac; line-height: 1.5; text-align: center; }
        .km-approval { padding: 15px; border: 1px solid #f0d8a8; border-radius: 16px; background: #fffaf0; margin-bottom: 22px; }
        .km-approval-title { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 850; color: #8a5a10; }
        .km-approval-text { font-size: 12px; line-height: 1.55; color: #755c32; margin-top: 9px; }
        .km-approval-odometer { font-size: 22px; font-weight: 900; color: #3a3020; margin-top: 6px; }
        .km-driver-card { padding: 16px; border-radius: 17px; border: 1px solid #e4e9f0; background: white; margin-bottom: 11px; }
        .km-driver-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .km-driver-name { font-size: 13px; font-weight: 850; }
        .km-muted { color: #8b96a5; font-size: 10px; }
        .km-driver-km { margin-top: 13px; font-size: 30px; font-weight: 900; letter-spacing: -1px; }
        .km-driver-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border-top: 1px solid #edf0f4; margin-top: 13px; padding-top: 12px; }
        .km-driver-footer strong { display: block; margin-top: 4px; font-size: 13px; }
        .km-toolbar { display: flex; gap: 7px; padding: 12px; border-bottom: 1px solid #edf0f4; }
        .km-filter { padding: 8px 11px; border: 0; border-radius: 9px; background: #f1f3f6; color: #657183; font-size: 11px; font-weight: 750; }
        .km-filter.active { background: #203554; color: white; }
        .km-record { padding: 15px; border-bottom: 1px solid #edf0f4; }
        .km-record:last-child { border-bottom: 0; }
        .km-record-top { display: flex; align-items: flex-start; gap: 10px; }
        .km-record-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; background: #eef3ff; color: #315fc7; flex-shrink: 0; }
        .km-record-main { min-width: 0; flex: 1; }
        .km-record-name { font-size: 12px; font-weight: 850; }
        .km-record-date { margin-top: 4px; font-size: 10px; color: #8a95a5; }
        .km-record-distance { font-size: 17px; font-weight: 900; white-space: nowrap; }
        .km-record-details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 13px; padding: 11px; border-radius: 11px; background: #f7f8fa; }
        .km-record-details strong { display: block; margin-top: 4px; font-size: 12px; }
        .km-record-bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 11px; }
        .km-mini-button { border: 1px solid #cbead8; background: #edf9f1; color: #18764e; border-radius: 9px; padding: 9px 11px; font-size: 11px; font-weight: 800; }
        .km-empty { padding: 38px 18px; text-align: center; color: #8792a1; font-size: 12px; line-height: 1.6; }
        .km-bottom-nav { position: fixed; z-index: 20; bottom: 0; left: 0; right: 0; padding: 9px 14px calc(9px + env(safe-area-inset-bottom)); background: #ffffffed; backdrop-filter: blur(18px); border-top: 1px solid #e5e9ef; }
        .km-nav { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .km-nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; min-height: 51px; border: 0; border-radius: 12px; background: transparent; color: #8a95a4; font-size: 10px; font-weight: 750; }
        .km-nav-item.active { color: #285ed0; background: #edf3ff; }
        .km-nav-item svg { width: 19px; height: 19px; }
        @media (min-width: 600px) {
          .km-app { padding-bottom: 105px; }
          .km-header { border: 1px solid #e6eaf0; border-radius: 0 0 20px 20px; }
          .km-bottom-nav { left: 50%; right: auto; width: min(560px, 100%); transform: translateX(-50%); border: 1px solid #e5e9ef; border-bottom: 0; border-radius: 17px 17px 0 0; }
        }
      `}</style>

      <header className="km-header">
        <div className="km-header-inner">
          <div className="km-brand">
            <div className="km-logo"><Car size={23} /></div>
            <div>
              <div className="km-brand-title">KM Kontrol</div>
              <div className="km-brand-sub">Ortak şirket aracı</div>
            </div>
          </div>

          <div className="km-user">
            <label className="km-label" htmlFor="km-driver">Kullanıcı</label>
            <select
              id="km-driver"
              className="km-select"
              value={driver}
              onChange={e => setDriver(e.target.value as Driver)}
            >
              {DRIVERS.map(name => <option key={name}>{name}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="km-content">
        {notice && (
          <div className={`km-notice ${notice.type}`}>
            {notice.type === 'ok' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            <span style={{ flex: 1 }}>{notice.text}</span>
            <button aria-label="Kapat" onClick={() => setNotice(null)} style={{ border: 0, background: 'transparent', color: 'inherit' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {tab === 'home' && (
          <>
            {pending && (
              <section className="km-approval">
                <div className="km-approval-title"><Clock3 size={17} /> Devir teslim bekliyor</div>
                <div className="km-approval-text">
                  <strong>{pending.driver}</strong> aracı şu kilometrede bıraktı:
                </div>
                <div className="km-approval-odometer">{fmt(Number(pending.end_km))} KM</div>
                <div className="km-approval-text">
                  {fmt(distance(pending))} KM sürüş · {pending.work_days} iş günü
                </div>
                <button className="km-button secondary" disabled={saving} onClick={() => void approve(pending)}>
                  <CheckCircle2 size={17} /> Devir teslimi onayla
                </button>
              </section>
            )}

            <section className="km-section">
              <div className="km-section-heading">
                <div>
                  <h2 className="km-section-title">Araç göstergesi</h2>
                  <div className="km-section-sub">En son kaydedilen kilometre</div>
                </div>
                <button className="km-icon-button" onClick={() => void load()} aria-label="Yenile">
                  <RefreshCw size={16} className={loading ? 'km-spin' : ''} />
                </button>
              </div>

              <div className="km-odometer">
                <div className="km-odometer-label"><Gauge size={15} /> GÜNCEL KİLOMETRE</div>
                <div className="km-odometer-number">
                  {loading && !latest ? '...' : latest ? fmt(Number(latest.end_km)) : '—'}
                  <small>KM</small>
                </div>
                <div className="km-odometer-bottom">
                  <div>
                    <div style={{ opacity: .7, fontSize: 10 }}>Son kaydı yapan</div>
                    <div style={{ marginTop: 4, color: '#fff', fontWeight: 750 }}>
                      {latest?.driver ?? 'Henüz kayıt yok'}
                    </div>
                  </div>
                  {latest && (
                    <span className={`km-pill ${latest.is_approved ? 'ok' : 'wait'}`}>
                      {latest.is_approved ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
                      {latest.is_approved ? 'Onaylandı' : 'Onay bekliyor'}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="km-section">
              <div className="km-section-heading">
                <div>
                  <h2 className="km-section-title">Yeni sürüş</h2>
                  <div className="km-section-sub">Kilometreyi gir, kaydı tamamla.</div>
                </div>
              </div>

              <form className="km-panel" onSubmit={submit}>
                <div className="km-panel-heading">
                  <div className="km-panel-icon"><Plus size={19} /></div>
                  <div>
                    <div className="km-panel-title">Sürüş / devir kaydı</div>
                    <div className="km-panel-caption">{driver} adına kaydedilecek</div>
                  </div>
                </div>

                <div className="km-form-grid">
                  <div>
                    <label className="km-label" htmlFor="km-start">Başlangıç KM</label>
                    <input className="km-input" id="km-start" type="number" min="0" step="1" inputMode="numeric" value={start} onChange={e => setStart(e.target.value)} required />
                  </div>
                  <div>
                    <label className="km-label" htmlFor="km-end">Bitiş KM</label>
                    <input className="km-input" id="km-end" type="number" min="0" step="1" inputMode="numeric" value={end} onChange={e => setEnd(e.target.value)} required />
                  </div>
                </div>

                <div style={{ marginTop: 15 }}>
                  <label className="km-label" htmlFor="km-days">İş günü sayısı</label>
                  <input className="km-input" id="km-days" type="number" min="0" step="1" inputMode="numeric" value={days} onChange={e => setDays(e.target.value)} required />
                  <div className="km-section-sub" style={{ marginTop: 6 }}>Günlük {DAILY_KM} KM şirket kullanım hakkı.</div>
                </div>

                <div className="km-preview">
                  <div className="km-preview-title">Sürüş özeti</div>
                  <div className="km-preview-grid">
                    <div>
                      <div className="km-preview-label">Toplam mesafe</div>
                      <div className="km-preview-value">{fmt(tripKm)} KM</div>
                    </div>
                    <div>
                      <div className="km-preview-label">Şirket hakkı</div>
                      <div className="km-preview-value km-green">{fmt(allowance)} KM</div>
                    </div>
                    <div>
                      <div className="km-preview-label">Kişisel kilometre</div>
                      <div className="km-preview-value km-amber">{fmt(personalKm)} KM</div>
                    </div>
                    <div>
                      <div className="km-preview-label">Tahmini yakıt tutarı</div>
                      <div className="km-preview-value km-blue">{money(estimate)}</div>
                    </div>
                  </div>
                </div>

                <button className="km-button" type="submit" disabled={saving || loading}>
                  {saving ? <RefreshCw size={17} /> : <CheckCircle2 size={18} />}
                  {saving ? 'Kaydediliyor...' : 'Sürüşü kaydet'}
                  {!saving && <ArrowRight size={16} />}
                </button>
                <div className="km-help">Kayıt diğer kullanıcının devir onayına sunulur.</div>
              </form>
            </section>
          </>
        )}

        {tab === 'history' && (
          <section className="km-section">
            <div className="km-section-heading">
              <div>
                <h2 className="km-section-title">Sürüş geçmişi</h2>
                <div className="km-section-sub">{drives.length} kayıt · Tüm kullanıcılar</div>
              </div>
              <button className="km-icon-button" onClick={() => void load()} aria-label="Yenile">
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="km-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="km-toolbar">
                {([
                  ['all', 'Tümü'],
                  ['pending', 'Bekleyen'],
                  ['approved', 'Onaylanan'],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setFilter(key)} className={`km-filter ${filter === key ? 'active' : ''}`}>
                    {label}
                  </button>
                ))}
              </div>

              {loading ? <div className="km-empty">Kayıtlar yükleniyor...</div> :
                history.length === 0 ? <div className="km-empty"><History size={26} style={{ margin: '0 auto 10px' }} /><br />Bu filtrede sürüş bulunamadı.</div> :
                history.map(d => (
                  <article className="km-record" key={d.id}>
                    <div className="km-record-top">
                      <div className="km-record-icon"><Car size={18} /></div>
                      <div className="km-record-main">
                        <div className="km-record-name">{d.driver}</div>
                        <div className="km-record-date">{dateFmt(d.created_at)}</div>
                      </div>
                      <div className="km-record-distance">{fmt(distance(d))}<span style={{ fontSize: 10, color: '#8792a1', marginLeft: 3 }}>KM</span></div>
                    </div>
                    <div className="km-record-details">
                      <div><span className="km-muted">Başlangıç</span><strong>{fmt(Number(d.start_km))} KM</strong></div>
                      <div><span className="km-muted">Bitiş</span><strong>{fmt(Number(d.end_km))} KM</strong></div>
                      <div><span className="km-muted">İş günü</span><strong>{d.work_days} gün</strong></div>
                      <div><span className="km-muted">Kişisel KM</span><strong>{fmt(personal(d))} KM</strong></div>
                    </div>
                    <div className="km-record-bottom">
                      <span className={`km-pill ${d.is_approved ? 'ok' : 'wait'}`}>
                        {d.is_approved ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
                        {d.is_approved ? 'Onaylandı' : 'Onay bekliyor'}
                      </span>
                      {!d.is_approved && d.driver !== driver && (
                        <button className="km-mini-button" disabled={saving} onClick={() => void approve(d)}>
                          <CheckCircle2 size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                          Onayla
                        </button>
                      )}
                    </div>
                    {d.approved_by && <div className="km-muted" style={{ marginTop: 9 }}>Onaylayan: {d.approved_by}</div>}
                  </article>
                ))
              }
            </div>
          </section>
        )}

        {tab === 'earnings' && (
          <section className="km-section">
            <div className="km-section-heading">
              <div>
                <h2 className="km-section-title">Hakediş ve yakıt</h2>
                <div className="km-section-sub">Sürücü bazında birikimli hesap</div>
              </div>
            </div>

            <div className="km-panel" style={{ marginBottom: 14 }}>
              <label className="km-label" htmlFor="km-price">Yakıt litre fiyatı (TL)</label>
              <input className="km-input" id="km-price" type="number" min="0" step="0.01" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
              <div className="km-section-sub" style={{ marginTop: 7 }}>Bu fiyat yalnızca tahmini hesaplamayı etkiler.</div>
            </div>

            {stats.map(s => (
              <article className="km-driver-card" key={s.name}>
                <div className="km-driver-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div className="km-panel-icon"><UserRound size={17} /></div>
                    <div>
                      <div className="km-driver-name">{s.name}</div>
                      <div className="km-muted" style={{ marginTop: 3 }}>{s.records} sürüş kaydı</div>
                    </div>
                  </div>
                  {driver === s.name && <span className="km-pill" style={{ background: '#edf2ff', color: '#315fc7' }}>Sen</span>}
                </div>
                <div className="km-driver-km">{fmt(s.km)} <span style={{ fontSize: 12, color: '#8792a1' }}>KM</span></div>
                <div className="km-muted">Toplam kişisel kullanım</div>
                <div className="km-driver-footer">
                  <div><span className="km-muted">Tahmini yakıt</span><strong>{fmt(s.liters)} Lt</strong></div>
                  <div><span className="km-muted">Yakıt karşılığı</span><strong className="km-blue">{money(s.cost)}</strong></div>
                </div>
              </article>
            ))}

            <div className="km-panel" style={{ fontSize: 11, color: '#748091', lineHeight: 1.7 }}>
              <ShieldCheck size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              Her kayıtta iş günü × {DAILY_KM} KM şirket hakkı düşülür. Negatif kişisel kullanım sıfır kabul edilir. Yakıt tahmini {CONSUMPTION} L/100 KM tüketimle hesaplanır.
            </div>
          </section>
        )}

        <footer style={{ textAlign: 'center', padding: '4px 0 10px', color: '#9aa3b0', fontSize: 10 }}>
          KM Kontrol · Ortak araç yönetimi
        </footer>
      </div>

      <nav className="km-bottom-nav" aria-label="Ana menü">
        <div className="km-nav">
          <button className={`km-nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
            <Gauge />
            <span>Araç & Sürüş</span>
          </button>
          <button className={`km-nav-item ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
            <History />
            <span>Geçmiş</span>
          </button>
          <button className={`km-nav-item ${tab === 'earnings' ? 'active' : ''}`} onClick={() => setTab('earnings')}>
            <Wallet />
            <span>Hakediş</span>
          </button>
        </div>
      </nav>
    </main>
  );
}
