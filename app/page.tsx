
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Car,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Fuel,
  RotateCw,
  UserRound,
  Gauge,
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock3,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Route,
  History,
  X,
  Check,
  Info,
} from 'lucide-react';

type DriverName = 'Erdem Pirci' | 'Erdem Gündüz';

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

const DRIVERS: DriverName[] = ['Erdem Pirci', 'Erdem Gündüz'];

const DAILY_WORK_KM = 60;
const CONSUMPTION = 7.5;

const formatNumber = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 1,
  }).format(value);

const formatMoney = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

function getPersonalKm(drive: Drive) {
  const driven = Math.max(0, Number(drive.end_km) - Number(drive.start_km));
  const allowance = Math.max(0, Number(drive.work_days)) * DAILY_WORK_KM;
  return Math.max(0, driven - allowance);
}

function getDistance(drive: Drive) {
  return Math.max(0, Number(drive.end_km) - Number(drive.start_km));
}

export default function Home() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [currentDriver, setCurrentDriver] =
    useState<DriverName>('Erdem Pirci');

  const [startKm, setStartKm] = useState('11000');
  const [endKm, setEndKm] = useState('11000');
  const [workDays, setWorkDays] = useState('5');

  const [fuelPrice, setFuelPrice] = useState('45');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'pending' | 'approved'
  >('all');

  const [showSettings, setShowSettings] = useState(false);

  const fetchDrives = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('drives')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const records = (data ?? []) as Drive[];
      setDrives(records);

      // Son kaydın göstergesi, seçili kullanıcıdan bağımsızdır.
      if (records.length > 0) {
        const latest = records[0];
        setStartKm(String(latest.end_km));
        setEndKm(String(latest.end_km));
      }
    } catch (error) {
      console.error('Sürüş kayıtları alınamadı:', error);
      setNotice({
        type: 'error',
        text: 'Kayıtlar alınamadı. İnternet bağlantını kontrol edip tekrar dene.',
      });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDrives();
  }, [fetchDrives]);

  useEffect(() => {
    try {
      const savedPrice = localStorage.getItem('km-kontrol-fuel-price');
      if (savedPrice) setFuelPrice(savedPrice);
    } catch {
      // Tarayıcı depolaması kullanılamıyorsa varsayılan değer korunur.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('km-kontrol-fuel-price', fuelPrice);
    } catch {
      // Fiyat yine de oturum boyunca kullanılabilir.
    }
  }, [fuelPrice]);

  const latestDrive = drives[0];

  const pendingApproval = useMemo(
    () =>
      drives.find(
        (drive) =>
          !drive.is_approved && drive.driver !== currentDriver
      ),
    [drives, currentDriver]
  );

  const driverStats = useMemo(() => {
    return DRIVERS.map((driver) => {
      const records = drives.filter((item) => item.driver === driver);

      const personalKm = records.reduce(
        (sum, item) => sum + getPersonalKm(item),
        0
      );

      const liters = (personalKm * CONSUMPTION) / 100;
      const price = Math.max(0, Number(fuelPrice) || 0);

      return {
        driver,
        recordCount: records.length,
        personalKm,
        liters,
        cost: liters * price,
      };
    });
  }, [drives, fuelPrice]);

  const myStats = driverStats.find(
    (item) => item.driver === currentDriver
  )!;

  const drivenKm = Math.max(
    0,
    (Number(endKm) || 0) - (Number(startKm) || 0)
  );

  const allowedKm = Math.max(0, Number(workDays) || 0) * DAILY_WORK_KM;
  const personalKm = Math.max(0, drivenKm - allowedKm);
  const companyKm = Math.min(drivenKm, allowedKm);
  const estimatedLiters = (personalKm * CONSUMPTION) / 100;
  const estimatedCost =
    estimatedLiters * Math.max(0, Number(fuelPrice) || 0);

  const filteredDrives = useMemo(() => {
    return drives.filter((drive) => {
      if (historyFilter === 'pending') return !drive.is_approved;
      if (historyFilter === 'approved') return drive.is_approved;
      return true;
    });
  }, [drives, historyFilter]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const start = Number(startKm);
    const end = Number(endKm);
    const days = Number(workDays);

    if (
      startKm.trim() === '' ||
      endKm.trim() === '' ||
      workDays.trim() === '' ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      !Number.isFinite(days)
    ) {
      setNotice({
        type: 'error',
        text: 'Lütfen bütün alanlara geçerli değerler gir.',
      });
      return;
    }

    if (start < 0 || end <= start) {
      setNotice({
        type: 'error',
        text: 'Bitiş kilometresi başlangıç kilometresinden büyük olmalıdır.',
      });
      return;
    }

    if (days < 0 || !Number.isInteger(days)) {
      setNotice({
        type: 'error',
        text: 'İş günü sıfır veya daha büyük bir tam sayı olmalıdır.',
      });
      return;
    }

    // Aynı göstergenin iki kez kaydedilmesini ve geçmişe dönük
    // hatalı kilometre girişlerini önle.
    if (latestDrive && start < Number(latestDrive.end_km)) {
      setNotice({
        type: 'error',
        text: `Başlangıç KM, son araç göstergesi olan ${formatNumber(
          Number(latestDrive.end_km)
        )} KM değerinden düşük olamaz.`,
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const { error } = await supabase.from('drives').insert([
        {
          driver: currentDriver,
          start_km: start,
          end_km: end,
          work_days: days,
          is_approved: false,
        },
      ]);

      if (error) throw error;

      setNotice({
        type: 'success',
        text: 'Sürüş kaydedildi. Devir teslim diğer kullanıcının onayını bekliyor.',
      });

      await fetchDrives(false);
    } catch (error) {
      console.error('Sürüş kaydedilemedi:', error);
      setNotice({
        type: 'error',
        text: 'Kayıt yapılamadı. Lütfen tekrar dene.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(drive: Drive) {
    if (drive.driver === currentDriver) {
      setNotice({
        type: 'error',
        text: 'Kendi sürüş kaydını onaylayamazsın. Diğer kullanıcıyla giriş yap.',
      });
      return;
    }

    const confirmed = window.confirm(
      `${drive.driver} tarafından girilen ${formatNumber(
        Number(drive.end_km)
      )} KM gösterge değerini onaylamak istiyor musun?`
    );

    if (!confirmed) return;

    setLoading(true);
    setNotice(null);

    try {
      const { data, error } = await supabase
        .from('drives')
        .update({
          is_approved: true,
          approved_by: currentDriver,
        })
        .eq('id', drive.id)
        .eq('is_approved', false)
        .select('id');

      if (error) throw error;

      if (!data || data.length === 0) {
        setNotice({
          type: 'info',
          text: 'Kayıt daha önce onaylanmış olabilir. Liste yenilendi.',
        });
      } else {
        setNotice({
          type: 'success',
          text: 'Devir teslim onaylandı.',
        });
      }

      await fetchDrives(false);
    } catch (error) {
      console.error('Onay işlemi başarısız:', error);
      setNotice({
        type: 'error',
        text: 'Onay verilemedi. Tekrar deneyebilirsin.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6fb] text-slate-900 antialiased">
      <div className="mx-auto min-h-screen w-full max-w-lg bg-[#f4f6fb] pb-10 sm:my-6 sm:rounded-[30px] sm:border sm:border-slate-200 sm:shadow-xl">
        {/* ÜST ALAN */}
        <header className="relative overflow-hidden rounded-b-[30px] bg-[#142747] px-5 pb-7 pt-5 text-white">
          <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-indigo-400/10 blur-3xl" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <Car size={23} className="text-blue-300" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">
                  KM Kontrol
                </h1>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  Ortak şirket aracı
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Araç takibi
            </div>
          </div>

          <div className="relative mt-7">
            <p className="text-[10px] font-bold uppercase tracking-[2px] text-blue-200/70">
              Hoş geldin
            </p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">
              Sürüş kontrol paneli
            </p>
            <p className="mt-2 max-w-xs text-xs leading-5 text-slate-300">
              Kilometrelerini kaydet, devir teslimini tamamla ve kişisel
              kullanımını takip et.
            </p>
          </div>

          <div className="relative mt-5">
            <label
              htmlFor="driver"
              className="mb-2 block text-[11px] font-bold text-slate-300"
            >
              İşlem yapan kullanıcı
            </label>
            <div className="relative">
              <UserRound
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-300"
              />
              <select
                id="driver"
                value={currentDriver}
                onChange={(event) =>
                  setCurrentDriver(event.target.value as DriverName)
                }
                className="w-full appearance-none rounded-xl border border-white/10 bg-white/10 py-3 pl-10 pr-10 text-sm font-bold text-white outline-none focus:border-blue-300"
              >
                <option className="bg-white text-slate-900" value="Erdem Pirci">
                  Erdem Pirci
                </option>
                <option className="bg-white text-slate-900" value="Erdem Gündüz">
                  Erdem Gündüz
                </option>
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300"
              />
            </div>
          </div>
        </header>

        <div className="space-y-6 px-4 pt-5">
          {/* BİLDİRİM */}
          {notice && (
            <div
              role="status"
              className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs leading-5 ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : notice.type === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              {notice.type === 'success' ? (
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
              ) : notice.type === 'error' ? (
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              ) : (
                <Info size={17} className="mt-0.5 shrink-0" />
              )}
              <p className="flex-1">{notice.text}</p>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Bildirimi kapat"
                className="rounded-lg p-1 opacity-60 hover:opacity-100"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* DEVİR ONAYI */}
          {pendingApproval && (
            <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-amber-100 bg-amber-50 px-4 py-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle size={19} />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-extrabold text-amber-950">
                    Devir teslim onayı
                  </h2>
                  <p className="mt-0.5 text-[11px] text-amber-800">
                    İşlem bekleyen bir sürüş var.
                  </p>
                </div>
                <span className="rounded-full bg-amber-200/70 px-2 py-1 text-[10px] font-bold text-amber-900">
                  Bekliyor
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Teslim eden</p>
                    <p className="mt-1 text-sm font-extrabold">
                      {pendingApproval.driver}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Araç göstergesi</p>
                    <p className="mt-1 font-mono text-xl font-black tracking-tight">
                      {formatNumber(Number(pendingApproval.end_km))}
                      <span className="ml-1 text-xs font-bold text-slate-400">
                        KM
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] text-slate-500">Sürüş mesafesi</p>
                    <p className="mt-1 text-sm font-extrabold">
                      {formatNumber(getDistance(pendingApproval))} KM
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[10px] text-slate-500">İş günü</p>
                    <p className="mt-1 text-sm font-extrabold">
                      {pendingApproval.work_days} gün
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleApprove(pendingApproval)}
                  disabled={loading}
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-amber-950 transition hover:bg-amber-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  {loading ? 'İşleniyor...' : 'Devir teslimi onayla'}
                </button>
                <p className="mt-2 text-center text-[10px] leading-4 text-slate-400">
                  Onay, mevcut kullanıcı adına kaydedilir.
                </p>
              </div>
            </section>
          )}

          {/* GÜNCEL GÖSTERGE */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold tracking-tight">
                  Araç durumu
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Son kaydedilen gösterge bilgisi
                </p>
              </div>

              <button
                type="button"
                onClick={() => void fetchDrives()}
                disabled={loading}
                aria-label="Kayıtları yenile"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCw
                  size={16}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c3761] to-[#142747] p-5 text-white shadow-lg shadow-blue-950/10">
              <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl" />

              <div className="relative flex items-center gap-2 text-[10px] font-bold uppercase tracking-[1.6px] text-blue-200">
                <Gauge size={15} />
                Güncel kilometre
              </div>

              <div className="relative mt-3 flex items-baseline gap-2">
                <span className="break-all font-mono text-4xl font-black tracking-tight sm:text-5xl">
                  {initialLoading
                    ? '...'
                    : latestDrive
                      ? formatNumber(Number(latestDrive.end_km))
                      : '—'}
                </span>
                <span className="text-sm font-bold text-blue-200">KM</span>
              </div>

              <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <div className="min-w-0">
                  <p className="text-[10px] text-blue-200/70">
                    Son kaydı yapan
                  </p>
                  <p className="mt-1 truncate text-xs font-bold text-white">
                    {latestDrive?.driver ?? 'Henüz kayıt yok'}
                  </p>
                </div>

                {latestDrive && (
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-bold ${
                      latestDrive.is_approved
                        ? 'bg-emerald-400/15 text-emerald-300'
                        : 'bg-amber-400/15 text-amber-300'
                    }`}
                  >
                    {latestDrive.is_approved ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <Clock3 size={12} />
                    )}
                    {latestDrive.is_approved
                      ? 'Onaylandı'
                      : 'Onay bekliyor'}
                  </span>
                )}
              </div>

              {latestDrive && (
                <p className="relative mt-2 text-[10px] text-blue-200/70">
                  Son güncelleme: {formatDate(latestDrive.created_at)}
                </p>
              )}
            </div>
          </section>

          {/* YENİ SÜRÜŞ FORMU */}
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-extrabold tracking-tight">
                Yeni sürüş / devir
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Sürüş bilgilerini gir ve kaydını oluştur.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Plus size={19} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Sürüş kaydı</h3>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {currentDriver} adına kaydedilecek
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label
                    htmlFor="startKm"
                    className="mb-2 block text-[11px] font-bold text-slate-600"
                  >
                    Başlangıç KM
                  </label>
                  <input
                    id="startKm"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={startKm}
                    onChange={(event) => setStartKm(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="endKm"
                    className="mb-2 block text-[11px] font-bold text-indigo-700"
                  >
                    Bitiş KM
                  </label>
                  <input
                    id="endKm"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={endKm}
                    onChange={(event) => setEndKm(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 font-mono text-sm font-extrabold text-indigo-950 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="workDays"
                  className="mb-2 block text-[11px] font-bold text-slate-600"
                >
                  İş günü sayısı
                </label>
                <div className="relative">
                  <CalendarDays
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="workDays"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={workDays}
                    onChange={(event) => setWorkDays(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-bold outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </div>
                <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                  Günlük {DAILY_WORK_KM} KM şirket hakkı uygulanır.
                </p>
              </div>

              {/* CANLI HESAPLAMA */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 border-b border-slate-200 px-3.5 py-3">
                  <TrendingUp size={15} className="text-indigo-600" />
                  <span className="text-[11px] font-extrabold text-slate-700">
                    Tahmini sürüş özeti
                  </span>
                  <span className="ml-auto text-[10px] text-slate-400">
                    Canlı hesaplama
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-px bg-slate-200">
                  <div className="bg-slate-50 p-3.5">
                    <p className="text-[10px] text-slate-500">
                      Toplam mesafe
                    </p>
                    <p className="mt-1 text-lg font-black tracking-tight">
                      {formatNumber(drivenKm)}
                      <span className="ml-1 text-[10px] font-bold text-slate-400">
                        KM
                      </span>
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5">
                    <p className="text-[10px] text-slate-500">
                      Şirket kullanım hakkı
                    </p>
                    <p className="mt-1 text-lg font-black tracking-tight text-emerald-700">
                      {formatNumber(companyKm)}
                      <span className="ml-1 text-[10px] font-bold text-slate-400">
                        KM
                      </span>
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5">
                    <p className="text-[10px] text-slate-500">
                      Kişisel kullanım
                    </p>
                    <p className="mt-1 text-lg font-black tracking-tight text-amber-700">
                      {formatNumber(personalKm)}
                      <span className="ml-1 text-[10px] font-bold text-slate-400">
                        KM
                      </span>
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5">
                    <p className="text-[10px] text-slate-500">
                      Tahmini yakıt tutarı
                    </p>
                    <p className="mt-1 break-words text-lg font-black tracking-tight text-indigo-700">
                      {formatMoney(estimatedCost)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 border-t border-slate-200 bg-white px-3.5 py-3">
                  <Fuel size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <p className="text-[10px] leading-4 text-slate-500">
                    {formatNumber(estimatedLiters)} litre tahmini yakıt.
                    Hesaplama {CONSUMPTION} L/100 KM sabit tüketimle yapılır.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || loading || initialLoading}
                className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <RotateCw size={17} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                {saving ? 'Kaydediliyor...' : 'Sürüşü kaydet ve devret'}
                {!saving && <ArrowRight size={16} />}
              </button>

              <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">
                Kaydedilen sürüş, diğer kullanıcının onayına sunulur.
              </p>
            </form>
          </section>

          {/* KİŞİSEL HAKEDİŞLER */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold tracking-tight">
                  Kişisel kullanım hakedişleri
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Sürücü bazında birikimli hesaplama
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings((previous) => !previous)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <Fuel size={14} />
                Yakıt
                <ChevronDown
                  size={13}
                  className={`transition-transform ${showSettings ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {showSettings && (
              <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                <label
                  htmlFor="fuelPrice"
                  className="mb-2 block text-[11px] font-bold text-slate-600"
                >
                  Yakıt litre fiyatı (TL)
                </label>
                <div className="relative">
                  <CircleDollarSign
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="fuelPrice"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={fuelPrice}
                    onChange={(event) => setFuelPrice(event.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white"
                  />
                </div>
                <p className="mt-2 text-[10px] leading-4 text-slate-400">
                  Fiyat yalnızca hesaplamada kullanılır. Supabase sürüş
                  kayıtlarını değiştirmez.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {driverStats.map((stats, index) => (
                <div
                  key={stats.driver}
                  className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${
                    index === 0
                      ? 'border-indigo-100'
                      : 'border-emerald-100'
                  }`}
                >
                  <div
                    className={`absolute right-0 top-0 h-20 w-20 rounded-full blur-2xl ${
                      index === 0 ? 'bg-indigo-100/70' : 'bg-emerald-100/70'
                    }`}
                  />

                  <div className="relative flex items-center gap-2">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        index === 0
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      <UserRound size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold">
                        {stats.driver}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {stats.recordCount} sürüş kaydı
                      </p>
                    </div>
                    {stats.driver === currentDriver && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">
                        Sen
                      </span>
                    )}
                  </div>

                  <div className="relative mt-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Kişisel kilometre
                    </p>
                    <p className="mt-1 font-mono text-3xl font-black tracking-tight text-slate-900">
                      {formatNumber(stats.personalKm)}
                      <span className="ml-1.5 text-xs font-bold text-slate-400">
                        KM
                      </span>
                    </p>
                  </div>

                  <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-[10px] text-slate-400">Yakıt</p>
                      <p className="mt-1 text-sm font-extrabold text-slate-700">
                        {formatNumber(stats.liters)} Lt
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">
                        Yakıt karşılığı
                      </p>
                      <p
                        className={`mt-1 text-sm font-extrabold ${
                          index === 0 ? 'text-indigo-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatMoney(stats.cost)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 px-3.5 py-3 text-[10px] leading-4 text-blue-800">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              <p>
                Hakediş hesaplaması tüm kayıtlar üzerinden yapılır. Her sürüşte
                iş günü × {DAILY_WORK_KM} KM şirket hakkı düşülür. Negatif
                kişisel kilometre sıfır kabul edilir.
              </p>
            </div>
          </section>

          {/* SÜRÜŞ GEÇMİŞİ */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold tracking-tight">
                  Sürüş geçmişi
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Tüm kullanıcıların kayıtları
                </p>
              </div>
              <div className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-extrabold text-slate-600">
                <History size={14} />
                {drives.length}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 p-3">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    historyFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('pending')}
                  className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    historyFilter === 'pending'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Bekleyen
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('approved')}
                  className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    historyFilter === 'approved'
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Onaylanan
                </button>
              </div>

              {initialLoading ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-slate-400">
                  <RotateCw size={23} className="animate-spin" />
                  <p className="mt-3 text-xs">Kayıtlar yükleniyor...</p>
                </div>
              ) : filteredDrives.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Route size={22} />
                  </div>
                  <p className="mt-3 text-sm font-extrabold text-slate-700">
                    Henüz kayıt yok
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Bu filtreye uygun bir sürüş bulunamadı.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredDrives.map((drive) => {
                    const distance = getDistance(drive);
                    const personal = getPersonalKm(drive);
                    const isMine = drive.driver === currentDriver;

                    return (
                      <article key={drive.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              drive.is_approved
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-amber-50 text-amber-600'
                            }`}
                          >
                            {drive.is_approved ? (
                              <CheckCircle2 size={19} />
                            ) : (
                              <Clock3 size={19} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-extrabold">
                                {drive.driver}
                              </p>
                              {isMine && (
                                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">
                                  Sen
                                </span>
                              )}
                            </div>

                            <p className="mt-1.5 text-[10px] text-slate-400">
                              {formatDate(drive.created_at)}
                            </p>

                            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                              <div>
                                <p className="text-[10px] text-slate-400">
                                  Başlangıç
                                </p>
                                <p className="mt-0.5 font-mono text-xs font-bold text-slate-700">
                                  {formatNumber(Number(drive.start_km))} KM
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-slate-400">
                                  Bitiş
                                </p>
                                <p className="mt-0.5 font-mono text-xs font-bold text-slate-700">
                                  {formatNumber(Number(drive.end_km))} KM
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <span className="rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-600">
                                {formatNumber(distance)} KM sürüş
                              </span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-600">
                                {drive.work_days} iş günü
                              </span>
                              <span className="rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-800">
                                {formatNumber(personal)} KM kişisel
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
                                  drive.is_approved
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {drive.is_approved ? (
                                  <Check size={12} />
                                ) : (
                                  <Clock3 size={12} />
                                )}
                                {drive.is_approved
                                  ? 'Onaylandı'
                                  : 'Onay bekliyor'}
                              </span>

                              {drive.approved_by && (
                                <span className="text-[10px] text-slate-400">
                                  Onaylayan: {drive.approved_by}
                                </span>
                              )}
                            </div>

                            {!drive.is_approved && !isMine && (
                              <button
                                type="button"
                                onClick={() => void handleApprove(drive)}
                                disabled={loading}
                                className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <CheckCircle2 size={15} />
                                Bu devri onayla
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* ALT BİLGİ */}
          <footer className="pb-3 pt-1 text-center">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
              <ShieldCheck size={13} />
              KM Kontrol · Ortak araç yönetimi
            </div>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Veriler Supabase üzerinden alınır.
            </p>
          </footer>
        </div>
      </div>
    </main>
  );
}