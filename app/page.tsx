'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Car, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Fuel, 
  RotateCw, 
  UserCheck, 
  TrendingUp, 
  ShieldCheck,
  Zap
} from 'lucide-react';

interface Drive {
  id: string;
  driver: string;
  start_km: number;
  end_km: number;
  work_days: number;
  is_approved: boolean;
  created_at: string;
}

export default function Home() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [currentDriver, setCurrentDriver] = useState<'Erdem Pirci' | 'Erdem Gündüz'>('Erdem Pirci');
  const [startKm, setStartKm] = useState<number>(11000);
  const [endKm, setEndKm] = useState<number>(11000);
  const [workDays, setWorkDays] = useState<number>(5);
  const [fuelPrice, setFuelPrice] = useState<number>(45);
  const [loading, setLoading] = useState<boolean>(false);

  // Sabit Arac İçi Parametreler
  const CONSUMPTION = 7.5; // Tescilli ortalama tüketim (7.5 lt / 100km)
  const DAILY_WORK_KM = 60; // Günlük git-gel iş yolu sabiti

  useEffect(() => {
    fetchDrives();
  }, []);

  async function fetchDrives() {
    setLoading(true);
    const { data, error } = await supabase
      .from('drives')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDrives(data);
      if (data.length > 0) {
        setStartKm(Number(data[0].end_km));
        setEndKm(Number(data[0].end_km));
      }
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (endKm <= startKm) {
      alert('Bitiş KM, başlangıç KM\'sinden büyük olmalıdır!');
      return;
    }

    setLoading(true);
    const { error } = await supabase.from('drives').insert([
      {
        driver: currentDriver,
        start_km: startKm,
        end_km: endKm,
        work_days: workDays,
        is_approved: false,
      },
    ]);

    if (!error) {
      fetchDrives();
    } else {
      alert('Hata: ' + error.message);
    }
    setLoading(false);
  }

  async function handleApprove(id: string) {
    setLoading(true);
    const { error } = await supabase
      .from('drives')
      .update({ is_approved: true, approved_by: currentDriver })
      .eq('id', id);

    if (!error) fetchDrives();
    setLoading(false);
  }

  const calcStats = (driverName: string) => {
    const driverDrives = drives.filter(d => d.driver === driverName);
    let totalPersonalKm = 0;

    driverDrives.forEach(d => {
      const driven = Number(d.end_km) - Number(d.start_km);
      const allowedWork = Number(d.work_days) * DAILY_WORK_KM;
      const personal = driven - allowedWork;
      if (personal > 0) totalPersonalKm += personal;
    });

    const liters = (totalPersonalKm * CONSUMPTION) / 100;
    const cost = liters * fuelPrice;

    return { totalPersonalKm, liters: liters.toFixed(1), cost: cost.toFixed(0) };
  };

  const lastDrive = drives[0];
  const pendingApproval = drives.find(d => !d.is_approved && d.driver !== currentDriver);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-md mx-auto pb-16 font-sans antialiased">
      
      {/* Top Navigation Bar */}
      <header className="flex justify-between items-center bg-slate-900/80 backdrop-blur-md p-3.5 px-4 rounded-2xl border border-slate-800/80 mb-5 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-600/20 p-2 rounded-xl border border-indigo-500/30 text-indigo-400">
            <Car size={20} />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white">KM Kontrol</h1>
            <p className="text-[10px] text-slate-400 font-medium">Ortak Şirket Aracı</p>
          </div>
        </div>

        {/* User Switcher */}
        <div className="relative">
          <select
            value={currentDriver}
            onChange={(e) => setCurrentDriver(e.target.value as 'Erdem Pirci' | 'Erdem Gündüz')}
            className="bg-slate-800 text-indigo-300 font-bold px-3 py-2 text-xs rounded-xl border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none pr-7 cursor-pointer"
          >
            <option value="Erdem Pirci">Erdem Pirci</option>
            <option value="Erdem Gündüz">Erdem Gündüz (Dede)</option>
          </select>
          <div className="absolute right-2.5 top-2.5 pointer-events-none text-indigo-400">
            <UserCheck size={14} />
          </div>
        </div>
      </header>

      {/* Devir-Teslim Onay Kartı (Sadece onay bekleyen varsa görünür) */}
      {pendingApproval && (
        <div className="bg-gradient-to-br from-amber-950/60 to-amber-900/30 border border-amber-500/40 rounded-2xl p-4 mb-5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-2">
            <AlertTriangle size={16} className="animate-pulse" />
            <span>Devir Teslim Onayı Bekleniyor</span>
          </div>
          <p className="text-xs text-amber-200/90 leading-relaxed mb-3">
            <b className="text-white font-bold">{pendingApproval.driver}</b> aracı <b className="text-amber-300 font-mono text-sm">{Number(pendingApproval.end_km).toLocaleString()} KM</b> göstergede bıraktı ({pendingApproval.work_days} iş günü kullanımı).
          </p>
          <button
            onClick={() => handleApprove(pendingApproval.id)}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <CheckCircle2 size={16} /> Göstergeyi & Devri Onayla
          </button>
        </div>
      )}

      {/* Main Stats Widget (Mevcut Gösterge) */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl mb-5 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-1.5">
            <Zap size={14} className="text-indigo-400" /> Güncel Gösterge
          </span>
          <button 
            onClick={fetchDrives} 
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700/50"
          >
            <RotateCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-4xl font-black font-mono tracking-tight text-white drop-shadow-md">
            {lastDrive ? Number(lastDrive.end_km).toLocaleString() : '---'}
          </span>
          <span className="text-xs font-bold text-slate-500">KM</span>
        </div>

        {lastDrive && (
          <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800/80 text-slate-400">
            <span className="flex items-center gap-1">
              Son Teslim: <b className="text-slate-200">{lastDrive.driver}</b>
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              lastDrive.is_approved 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {lastDrive.is_approved ? '✓ Onaylandı' : '⏳ Onay Bekliyor'}
            </span>
          </div>
        )}
      </div>

      {/* Drive Log Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl mb-5 space-y-3.5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
          <Plus size={16} className="text-indigo-400" />
          <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-200">Yeni Sürüş / Devir Girişi</h2>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Başlangıç KM
            </label>
            <input
              type="number"
              value={startKm}
              onChange={(e) => setStartKm(Number(e.target.value))}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-300 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
              Bitiş KM (Gösterge)
            </label>
            <input
              type="number"
              value={endKm}
              onChange={(e) => setEndKm(Number(e.target.value))}
              className="w-full bg-slate-950 border border-indigo-500/50 rounded-xl p-2.5 text-xs font-mono font-bold text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Örn: 11450"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            İş Günü Sayısı (Gün × 60 KM Şirket Hakkı)
          </label>
          <input
            type="number"
            step="0.5"
            value={workDays}
            onChange={(e) => setWorkDays(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-200 focus:border-indigo-500 outline-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-black py-3 rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/20"
        >
          {loading ? 'İşleniyor...' : 'Sürüşü ve Devri Kaydet'}
        </button>
      </form>

      {/* Fuel & Balance Summary */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-3xl shadow-xl space-y-3.5">
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <Fuel size={16} className="text-indigo-400" />
            <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-200">Kişisel Kullanım Hakedişleri</h2>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold">Litre:</span>
            <input
              type="number"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(Number(e.target.value))}
              className="w-10 bg-transparent text-center font-bold text-indigo-300 text-xs outline-none"
            />
            <span className="text-[10px] text-slate-400 font-bold">TL</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Erdem Pirci Card */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-indigo-500/20 relative overflow-hidden">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 mb-1">Erdem Pirci</p>
            <p className="text-xl font-black font-mono text-white mb-1">
              {calcStats('Erdem Pirci').totalPersonalKm} <span className="text-xs font-normal text-slate-400">KM</span>
            </p>
            <div className="text-[11px] font-medium text-slate-400 pt-1.5 border-t border-slate-800/80">
              <span>{calcStats('Erdem Pirci').liters} Lt</span>
              <span className="mx-1 text-slate-600">•</span>
              <b className="text-indigo-300 font-bold">{calcStats('Erdem Pirci').cost} TL</b>
            </div>
          </div>

          {/* Erdem Gündüz Card */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/20 relative overflow-hidden">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 mb-1">Erdem Gündüz</p>
            <p className="text-xl font-black font-mono text-white mb-1">
              {calcStats('Erdem Gündüz').totalPersonalKm} <span className="text-xs font-normal text-slate-400">KM</span>
            </p>
            <div className="text-[11px] font-medium text-slate-400 pt-1.5 border-t border-slate-800/80">
              <span>{calcStats('Erdem Gündüz').liters} Lt</span>
              <span className="mx-1 text-slate-600">•</span>
              <b className="text-emerald-300 font-bold">{calcStats('Erdem Gündüz').cost} TL</b>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 pt-1 font-medium">
          <ShieldCheck size={13} className="text-slate-600" />
          <span>Hesaplama sabit 7.5 Lt/100km tüketim ile yapılır.</span>
        </div>
      </div>

    </main>
  );
}
