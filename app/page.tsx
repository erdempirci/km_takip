'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Car, CheckCircle2, AlertCircle, PlusCircle, Fuel, RefreshCw } from 'lucide-react';

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
  const [currentDriver, setCurrentDriver] = useState<'Onur' | 'Erdem'>('Onur');
  const [startKm, setStartKm] = useState<number>(11000);
  const [endKm, setEndKm] = useState<number>(11000);
  const [workDays, setWorkDays] = useState<number>(5);
  const [fuelPrice, setFuelPrice] = useState<number>(45);
  const [loading, setLoading] = useState<boolean>(false);

  const CONSUMPTION = 7.5; // 11.000 KM fabrika/araç ortalaması (7.5 lt/100km)
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
      alert('Sürüş kaydı başarıyla eklendi!');
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
    <main className="min-h-screen bg-slate-100 p-4 max-w-md mx-auto pb-12 font-sans">
      <header className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border mb-4">
        <div className="flex items-center gap-2">
          <Car className="text-blue-600" size={22} />
          <h1 className="font-bold text-slate-800 text-base">KM Takip</h1>
        </div>
        <select
          value={currentDriver}
          onChange={(e) => setCurrentDriver(e.target.value as 'Onur' | 'Erdem')}
          className="bg-blue-50 border border-blue-200 font-bold px-3 py-2 rounded-xl text-xs text-blue-900 outline-none"
        >
          <option value="Onur">Ben (Onur)</option>
          <option value="Erdem">Erdem (Dede)</option>
        </select>
      </header>

      {pendingApproval && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertCircle size={18} />
            <span>Devir Teslim Onayı Bekleniyor</span>
          </div>
          <p className="text-xs text-amber-800">
            <b>{pendingApproval.driver}</b> aracı <b>{Number(pendingApproval.end_km).toLocaleString()} KM</b> göstergede bıraktı ({pendingApproval.work_days} gün iş kullanımı).
          </p>
          <button
            onClick={() => handleApprove(pendingApproval.id)}
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <CheckCircle2 size={16} /> Gösterge Doğru, Onayla
          </button>
        </div>
      )}

      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md mb-4 relative overflow-hidden">
        <div className="flex justify-between items-center mb-1">
          <p className="text-xs text-slate-400 font-medium">Sistemdeki Son Gösterge</p>
          <button onClick={fetchDrives} className="text-slate-400 hover:text-white transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="text-3xl font-extrabold tracking-tight mb-2">
          {lastDrive ? `${Number(lastDrive.end_km).toLocaleString()} KM` : 'Henüz Kayıt Yok'}
        </div>
        {lastDrive && (
          <div className="flex justify-between items-center text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span>Son Bırakan: <b>{lastDrive.driver}</b></span>
            <span>{lastDrive.is_approved ? '✅ Onaylandı' : '⏳ Onay Bekliyor'}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-2xl shadow-sm border mb-4 space-y-3">
        <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
          <PlusCircle size={16} className="text-blue-600" /> Sürüş / Devir Girişi
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">BAŞLANGIÇ KM</label>
            <input
              type="number"
              value={startKm}
              onChange={(e) => setStartKm(Number(e.target.value))}
              className="w-full bg-slate-50 border rounded-xl p-2.5 text-xs font-bold text-slate-700"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1">BİTİŞ KM (GÖSTERGE)</label>
            <input
              type="number"
              value={endKm}
              onChange={(e) => setEndKm(Number(e.target.value))}
              className="w-full bg-slate-50 border border-blue-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Örn: 11450"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 mb-1">
            İŞ GÜNÜ SAYISI (Gün × 60 KM Şirket Hakkı)
          </label>
          <input
            type="number"
            step="0.5"
            value={workDays}
            onChange={(e) => setWorkDays(Number(e.target.value))}
            className="w-full bg-slate-50 border rounded-xl p-2.5 text-xs font-bold text-slate-800"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-sm"
        >
          {loading ? 'Kaydediliyor...' : 'Devir Teslim Kaydet'}
        </button>
      </form>

      <div className="bg-white p-4 rounded-2xl shadow-sm border space-y-3">
        <div className="flex justify-between items-center pb-2 border-b">
          <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Fuel size={16} className="text-purple-600" /> Kişisel Yakıt Bakiyeleri
          </h2>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[10px] text-slate-400 font-bold">LİTRE:</span>
            <input
              type="number"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(Number(e.target.value))}
              className="w-12 bg-slate-100 rounded px-1 text-center font-bold text-slate-700 text-xs"
            />
            <span className="text-[10px] text-slate-400 font-bold">TL</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
            <p className="text-[10px] font-bold text-purple-600">ONUR (KİŞİSEL)</p>
            <p className="text-base font-black text-purple-900">{calcStats('Onur').totalPersonalKm} KM</p>
            <p className="text-[11px] font-medium text-purple-700 mt-0.5">
              {calcStats('Onur').liters} Lt / <b>{calcStats('Onur').cost} TL</b>
            </p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
            <p className="text-[10px] font-bold text-emerald-600">ERDEM (KİŞİSEL)</p>
            <p className="text-base font-black text-emerald-900">{calcStats('Erdem').totalPersonalKm} KM</p>
            <p className="text-[11px] font-medium text-emerald-700 mt-0.5">
              {calcStats('Erdem').liters} Lt / <b>{calcStats('Erdem').cost} TL</b>
            </p>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 text-center italic pt-1">
          * Hesaplama 7,5 lt/100km sabitiyle yapılmaktadır.
        </p>
      </div>
    </main>
  );
}
