import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Download, ExternalLink, Search, Loader2, Package, MapPin, FolderArchive, RefreshCw, ListChecks } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

type PaperType = 'hiring' | 'contracts' | 'missing' | 'renewal';

const PAPER_TYPE_META: Record<PaperType, { label: string; arabic: string; color: string }> = {
  hiring: { label: 'Hiring Papers', arabic: 'أوراق التعيين', color: 'amber' },
  contracts: { label: 'Contracts', arabic: 'العقود', color: 'blue' },
  missing: { label: 'Missing Papers', arabic: 'الأوراق الناقصة', color: 'rose' },
  renewal: { label: 'Renewal', arabic: 'التجديد', color: 'purple' },
};

const matchesType = (fileName: string, t: PaperType) => {
  if (t === 'hiring') return fileName.startsWith('HIR_') || fileName.startsWith('أوراق_تعيين_');
  if (t === 'contracts') return fileName.startsWith('CNT_') || fileName.startsWith('عقد_');
  if (t === 'missing') return fileName.startsWith('MIS_') || fileName.startsWith('الاوراق_الناقصة_') || fileName.startsWith('أوراق_ناقصة_');
  return fileName.startsWith('REN_') || fileName.startsWith('اوراق_التجديد_') || fileName.startsWith('أوراق_تجديد_');
};

interface CourierRow {
  id: string;
  idNumber: string;
  name: string;
  system: string;
  region: string;
  emailSubject: string;
  emailSubjectContracts?: string;
  emailSubjectMissing?: string;
  emailSubjectRenewal?: string;
  files: { name: string; path: string }[];
}

const STORAGE_BUCKET = 'manpower-docs';

const downloadBlob = async (path: string, filename: string) => {
  try {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
    if (error || !data) throw error || new Error('Download failed');
    const blobUrl = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err: any) {
    toast({ title: 'Download failed', description: err?.message || 'Try again', variant: 'destructive' });
  }
};

const openBlob = async (path: string) => {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 10, { download: false });
  if (error || !data?.signedUrl) {
    toast({ title: 'Open failed', description: error?.message || 'Try again', variant: 'destructive' });
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
};

interface ManpowerPapersProps {
  onSaveSubject?: () => void;
}

export default function ManpowerPapers({ onSaveSubject }: ManpowerPapersProps = {}) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CourierRow[]>([]);
  const [search, setSearch] = useState('');
  const [zipping, setZipping] = useState(false);

  const [sessionUnlocked, setSessionUnlocked] = useState(false);
  const [unlockedCouriers, setUnlockedCouriers] = useState<Record<string, boolean>>({});
  const [tempSubjects, setTempSubjects] = useState<Record<string, string>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});


  const [selectiveOpen, setSelectiveOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PaperType>('hiring');
  const [selectedIds, setSelectedIds] = useState<Record<PaperType, Set<string>>>({
    hiring: new Set(),
    contracts: new Set(),
    missing: new Set(),
    renewal: new Set(),
  });
  const [dialogSearch, setDialogSearch] = useState('');

  const load = async () => {
    setLoading(true);
    // 1) load couriers with all email subject columns
    const { data: couriers, error: cErr } = await supabase
      .from('manpower')
      .select('id, id_number, courier_name, system, region, email_subject, email_subject_contracts, email_subject_missing, email_subject_renewal')
      .order('region', { ascending: true });
    if (cErr) {
      toast({ title: 'Load failed', description: cErr.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // 2) for each courier, list files (parallel)
    const results = await Promise.all(
      (couriers || []).map(async (c: any) => {
        const { data: list } = await supabase.storage.from(STORAGE_BUCKET).list(c.id, { limit: 100 });
        const files = (list || [])
          .filter((f: any) => f.name && f.name !== '.emptyFolderPlaceholder')
          .map((f: any) => ({ name: String(f.name), path: `${c.id}/${f.name}` }));
        return {
          id: c.id,
          idNumber: c.id_number || '',
          name: c.courier_name,
          system: c.system,
          region: c.region,
          emailSubject: c.email_subject || '',
          emailSubjectContracts: c.email_subject_contracts || '',
          emailSubjectMissing: c.email_subject_missing || '',
          emailSubjectRenewal: c.email_subject_renewal || '',
          files,
        } as CourierRow;
      })
    );

    setRows(results.filter(r => r.files.length > 0));
    setLoading(false);
  };

  const ensureUnlocked = (): boolean => {
    if (sessionUnlocked) return true;
    const pw = prompt('Please enter the password to edit the email subject:');
    if (pw === '1017') {
      setSessionUnlocked(true);
      return true;
    }
    if (pw !== null) {
      toast({ title: 'Incorrect password', description: 'You cannot edit the email subject.', variant: 'destructive' });
    }
    return false;
  };

  const handleEditClick = (_courierId: string, _category: string) => {
    ensureUnlocked();
  };


  const handleSaveRowSubject = async (courierId: string, category: 'hiring' | 'contracts' | 'missing' | 'renewal') => {
    const key = `${courierId}_${category}`;
    const row = rows.find(r => r.id === courierId);
    if (!row) return;

    let dbField = 'email_subject';
    let propName: keyof CourierRow = 'emailSubject';
    if (category === 'contracts') {
      dbField = 'email_subject_contracts';
      propName = 'emailSubjectContracts';
    } else if (category === 'missing') {
      dbField = 'email_subject_missing';
      propName = 'emailSubjectMissing';
    } else if (category === 'renewal') {
      dbField = 'email_subject_renewal';
      propName = 'emailSubjectRenewal';
    }

    const newVal = tempSubjects[key] !== undefined 
      ? tempSubjects[key] 
      : (row[propName] as string || '');

    setSavingRows(prev => ({ ...prev, [key]: true }));
    try {
      const { error } = await supabase
        .from('manpower')
        .update({ [dbField]: newVal } as any)
        .eq('id', courierId);

        if (error) {
          toast({ title: 'Failed to save email subject', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Email subject saved successfully' });
          setRows(prev => prev.map(r => r.id === courierId ? { ...r, [propName]: newVal } : r));
          setUnlockedCouriers(prev => ({ ...prev, [key]: false }));
          if (onSaveSubject) {
            onSaveSubject();
          }
        }
    } catch (err: any) {
      toast({ title: 'An error occurred', description: err.message, variant: 'destructive' });
    } finally {
      setSavingRows(prev => ({ ...prev, [key]: false }));
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.system.toLowerCase().includes(q) ||
      r.region.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalFiles = rows.reduce((s, r) => s + r.files.length, 0);

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : undefined;

  const downloadFilteredZip = async (subset: CourierRow[], zipName: string, type: 'all' | 'hiring' | 'contracts' | 'missing' | 'renewal' = 'all') => {
    if (subset.length === 0) return;
    setZipping(true);
    type Task = { path: string; zipName: string };
    const tasks: Task[] = [];
    try {
      const fileFilter = (fileName: string) => {
        if (type === 'hiring') return fileName.startsWith('HIR_') || fileName.startsWith('أوراق_تعيين_');
        if (type === 'contracts') return fileName.startsWith('CNT_') || fileName.startsWith('عقد_');
        if (type === 'missing') return fileName.startsWith('MIS_') || fileName.startsWith('الاوراق_الناقصة_') || fileName.startsWith('أوراق_ناقصة_');
        if (type === 'renewal') return fileName.startsWith('REN_') || fileName.startsWith('اوراق_التجديد_') || fileName.startsWith('أوراق_تجديد_');
        return true;
      };

      // Build the full list of files to download with their target zip names (warehouse/courier/file)
      const sanitize = (s: string) => String(s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'Unknown';
      const usedZipNames = new Set<string>();
      const uniqueZipName = (name: string) => {
        if (!usedZipNames.has(name)) {
          usedZipNames.add(name);
          return name;
        }
        const dot = name.lastIndexOf('.');
        const base = dot > -1 ? name.slice(0, dot) : name;
        const ext = dot > -1 ? name.slice(dot) : '';
        let n = 2;
        let candidate = `${base}_${n}${ext}`;
        while (usedZipNames.has(candidate)) {
          n += 1;
          candidate = `${base}_${n}${ext}`;
        }
        usedZipNames.add(candidate);
        return candidate;
      };
      for (const r of subset) {
        const filteredFiles = r.files.filter(f => fileFilter(f.name));
        if (filteredFiles.length === 0) continue;
        const safeRegion = sanitize(r.region || 'No region');
        const safeName = sanitize(r.name);
        const courierFolder = `${safeRegion}/${safeName}`;
        filteredFiles.forEach((f, idx) => {
          const ext = f.name.split('.').pop() || 'pdf';
          const fileLabel = filteredFiles.length > 1 ? `${safeName}_${idx + 1}.${ext}` : `${safeName}.${ext}`;
          tasks.push({ path: f.path, zipName: uniqueZipName(`${courierFolder}/${fileLabel}`) });
        });
      }


      if (tasks.length === 0) {
        toast({ title: 'No files found', description: 'No files match this type.' });
        setZipping(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('download-papers-zip', {
        body: { files: tasks, zipName },
      });
      if (error) throw error;

      const zipBlob = data instanceof Blob
        ? data
        : new Blob([data as BlobPart], { type: 'application/zip' });
      if (zipBlob.size === 0) throw new Error('Could not prepare the download file');

      triggerBlobDownload(zipBlob, `${zipName}.zip`);
      toast({ title: 'File ready', description: `Prepared ${tasks.length} files for ${subset.length} couriers.` });
    } catch (err: unknown) {
      toast({ title: 'Failed to build zip file', description: getErrorMessage(err) || 'Please try again', variant: 'destructive' });
    } finally {

      setZipping(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-white px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FolderArchive className="w-5 h-5 text-emerald-600" /> Uploaded Papers Archive
        </h2>
        <span className="text-xs text-slate-500">
          {rows.length} couriers · {totalFiles} files
        </span>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, ID, region..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 w-64 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            const hasType = (r: CourierRow, t: 'hiring'|'contracts'|'missing'|'renewal') => {
              if (t === 'hiring') return r.files.some(f => f.name.startsWith('HIR_') || f.name.startsWith('أوراق_تعيين_'));
              if (t === 'contracts') return r.files.some(f => f.name.startsWith('CNT_') || f.name.startsWith('عقد_'));
              if (t === 'missing') return r.files.some(f => f.name.startsWith('MIS_') || f.name.startsWith('الاوراق_الناقصة_') || f.name.startsWith('أوراق_ناقصة_'));
              return r.files.some(f => f.name.startsWith('REN_') || f.name.startsWith('اوراق_التجديد_') || f.name.startsWith('أوراق_تجديد_'));
            };
            const countType = (r: CourierRow, t: 'hiring'|'contracts'|'missing'|'renewal') => {
              if (t === 'hiring') return r.files.filter(f => f.name.startsWith('HIR_') || f.name.startsWith('أوراق_تعيين_')).length;
              if (t === 'contracts') return r.files.filter(f => f.name.startsWith('CNT_') || f.name.startsWith('عقد_')).length;
              if (t === 'missing') return r.files.filter(f => f.name.startsWith('MIS_') || f.name.startsWith('الاوراق_الناقصة_') || f.name.startsWith('أوراق_ناقصة_')).length;
              return r.files.filter(f => f.name.startsWith('REN_') || f.name.startsWith('اوراق_التجديد_') || f.name.startsWith('أوراق_تجديد_')).length;
            };
            const data = rows.map(r => ({
              'Courier Name': r.name,
              'National ID': r.idNumber,
              'System': r.system,
              'Region': r.region,
              'Total Files': r.files.length,
              'Hiring Papers': hasType(r, 'hiring') ? 'Yes' : 'No',
              'Hiring Files Count': countType(r, 'hiring'),
              'Hiring Email Subject': r.emailSubject || '',
              'Contracts': hasType(r, 'contracts') ? 'Yes' : 'No',
              'Contracts Files Count': countType(r, 'contracts'),
              'Contracts Email Subject': r.emailSubjectContracts || '',
              'Missing Papers': hasType(r, 'missing') ? 'Yes' : 'No',
              'Missing Files Count': countType(r, 'missing'),
              'Missing Email Subject': r.emailSubjectMissing || '',
              'Renewal Papers': hasType(r, 'renewal') ? 'Yes' : 'No',
              'Renewal Files Count': countType(r, 'renewal'),
              'Renewal Email Subject': r.emailSubjectRenewal || '',
              'All Files': r.files.map(f => f.name).join(' | '),
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [
              { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 10 },
              { wch: 10 }, { wch: 12 }, { wch: 40 },
              { wch: 10 }, { wch: 12 }, { wch: 40 },
              { wch: 10 }, { wch: 12 }, { wch: 40 },
              { wch: 10 }, { wch: 12 }, { wch: 40 },
              { wch: 60 },
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Papers Summary');
            XLSX.writeFile(wb, `Papers_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
          }}
          disabled={rows.length === 0}
          className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-bold"
        >
          <FileText className="w-3.5 h-3.5" />
          Summary Report
        </Button>
        <Button
          size="sm"
          onClick={() => downloadFilteredZip(filtered, `Hiring_Papers_${new Date().toISOString().slice(0,10)}`, 'hiring')}
          disabled={zipping || filtered.length === 0}
          className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 font-bold"
        >
          {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
          Hiring Papers ({filtered.length})
        </Button>
        <Button
          size="sm"
          onClick={() => downloadFilteredZip(filtered, `Contracts_${new Date().toISOString().slice(0,10)}`, 'contracts')}
          disabled={zipping || filtered.length === 0}
          className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-bold"
        >
          {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
          Contracts ({filtered.length})
        </Button>
        <Button
          size="sm"
          onClick={() => downloadFilteredZip(filtered, `Missing_Papers_${new Date().toISOString().slice(0,10)}`, 'missing')}
          disabled={zipping || filtered.length === 0}
          className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5 font-bold"
        >
          {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
          Missing Papers ({filtered.length})
        </Button>
        <Button
          size="sm"
          onClick={() => downloadFilteredZip(filtered, `Renewal_Papers_${new Date().toISOString().slice(0,10)}`, 'renewal')}
          disabled={zipping || filtered.length === 0}
          className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1.5 font-bold"
        >
          {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
          Renewal Papers ({filtered.length})
        </Button>
        <Button
          size="sm"
          onClick={() => downloadFilteredZip(filtered, `Manpower_Papers_All_${new Date().toISOString().slice(0,10)}`, 'all')}
          disabled={zipping || filtered.length === 0}
          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-bold"
        >
          {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
          All Files ({filtered.length})
        </Button>
        <Button
          size="sm"
          onClick={() => { setSelectiveOpen(true); setDialogSearch(''); }}
          disabled={rows.length === 0}
          className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold"
        >
          <ListChecks className="w-3.5 h-3.5" />
          Selective Download
        </Button>
        <Button size="sm" variant="outline" onClick={load} className="h-8 text-xs font-bold border-slate-200">
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FolderArchive className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No uploaded papers yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold text-left">Courier</th>
                  <th className="px-4 py-2 font-semibold text-left">Region</th>
                  <th className="text-center px-4 py-2 font-semibold">Files Count</th>
                  <th className="px-4 py-2 font-semibold text-right w-[320px]">Email Subject</th>
                  <th className="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.system}</div>
                    </td>
                    <td className="px-4 py-2.5 text-left">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        <MapPin className="w-3 h-3 text-slate-400" /> {r.region}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        {r.files.length} PDF Files
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right w-[320px]">
                      <div className="flex flex-col gap-2">
                        {/* Hiring Subject */}
                        {r.files.some(f => f.name.startsWith('HIR_') || f.name.startsWith('أوراق_تعيين_')) && (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] text-emerald-600 font-bold">Hiring Papers (Subject):</span>
                            {(() => {
                              const cat = 'hiring';
                              const key = `${r.id}_${cat}`;
                              const isUnlocked = sessionUnlocked;
                              const val = tempSubjects[key] !== undefined ? tempSubjects[key] : r.emailSubject;
                              const isSaving = savingRows[key];

                              return (
                                <div className="flex items-center gap-1.5 justify-end">
                                  {isUnlocked ? (
                                    <>
                                      <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => setTempSubjects(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="Email Subject..."
                                        className="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveRowSubject(r.id, cat)}
                                        disabled={isSaving}
                                        className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5"
                                      >
                                        {isSaving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Save'}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded max-w-[180px] truncate" title={r.emailSubject}>
                                        {r.emailSubject}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditClick(r.id, cat)}
                                        className="h-6 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold px-1.5"
                                      >
                                        Edit
                                      </Button>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Contracts Subject */}
                        {r.files.some(f => f.name.startsWith('CNT_') || f.name.startsWith('عقد_')) && (
                          <div className="flex flex-col items-end gap-1 border-t border-slate-100 pt-1.5">
                            <span className="text-[10px] text-blue-600 font-bold">Contract (Subject):</span>
                            {(() => {
                              const cat = 'contracts';
                              const key = `${r.id}_${cat}`;
                              const isUnlocked = sessionUnlocked;
                              const val = tempSubjects[key] !== undefined ? tempSubjects[key] : (r.emailSubjectContracts || '');
                              const isSaving = savingRows[key];

                              return (
                                <div className="flex items-center gap-1.5 justify-end">
                                  {isUnlocked ? (
                                    <>
                                      <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => setTempSubjects(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="Email Subject..."
                                        className="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveRowSubject(r.id, cat)}
                                        disabled={isSaving}
                                        className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5"
                                      >
                                        {isSaving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Save'}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded max-w-[180px] truncate" title={r.emailSubjectContracts}>
                                        {r.emailSubjectContracts}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditClick(r.id, cat)}
                                        className="h-6 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold px-1.5"
                                      >
                                        Edit
                                      </Button>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Missing Papers Subject */}
                        {r.files.some(f => f.name.startsWith('MIS_') || f.name.startsWith('الاوراق_الناقصة_') || f.name.startsWith('أوراق_ناقصة_')) && (
                          <div className="flex flex-col items-end gap-1 border-t border-slate-100 pt-1.5">
                            <span className="text-[10px] text-rose-600 font-bold">Missing Papers (Subject):</span>
                            {(() => {
                              const cat = 'missing';
                              const key = `${r.id}_${cat}`;
                              const isUnlocked = sessionUnlocked;
                              const val = tempSubjects[key] !== undefined ? tempSubjects[key] : (r.emailSubjectMissing || '');
                              const isSaving = savingRows[key];

                              return (
                                <div className="flex items-center gap-1.5 justify-end">
                                  {isUnlocked ? (
                                    <>
                                      <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => setTempSubjects(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="Email Subject..."
                                        className="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveRowSubject(r.id, cat)}
                                        disabled={isSaving}
                                        className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5"
                                      >
                                        {isSaving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Save'}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded max-w-[180px] truncate" title={r.emailSubjectMissing}>
                                        {r.emailSubjectMissing}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditClick(r.id, cat)}
                                        className="h-6 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold px-1.5"
                                      >
                                        Edit
                                      </Button>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Renewal Papers Subject */}
                        {r.files.some(f => f.name.startsWith('REN_') || f.name.startsWith('اوراق_التجديد_') || f.name.startsWith('أوراق_تجديد_')) && (
                          <div className="flex flex-col items-end gap-1 border-t border-slate-100 pt-1.5">
                            <span className="text-[10px] text-purple-600 font-bold">Renewal (Subject):</span>
                            {(() => {
                              const cat = 'renewal';
                              const key = `${r.id}_${cat}`;
                              const isUnlocked = sessionUnlocked;
                              const val = tempSubjects[key] !== undefined ? tempSubjects[key] : (r.emailSubjectRenewal || '');
                              const isSaving = savingRows[key];

                              return (
                                <div className="flex items-center gap-1.5 justify-end">
                                  {isUnlocked ? (
                                    <>
                                      <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => setTempSubjects(prev => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="Email Subject..."
                                        className="text-xs border border-slate-300 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveRowSubject(r.id, cat)}
                                        disabled={isSaving}
                                        className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5"
                                      >
                                        {isSaving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Save'}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs text-slate-800 font-semibold bg-slate-100 px-2 py-0.5 rounded max-w-[180px] truncate" title={r.emailSubjectRenewal}>
                                        {r.emailSubjectRenewal}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditClick(r.id, cat)}
                                        className="h-6 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-bold px-1.5"
                                      >
                                        Edit
                                      </Button>
                                    </>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-3 items-end">
                        {/* Group: Contracts */}
                        {r.files.some(f => f.name.startsWith('CNT_') || f.name.startsWith('عقد_')) && (
                          <div className="flex flex-wrap gap-2 items-center w-full justify-end">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mr-2">Contracts:</span>
                            {r.files.filter(f => f.name.startsWith('CNT_') || f.name.startsWith('عقد_')).map(f => {
                              const displayName = f.name.replace(/^(CNT_|عقد_)(\d+_)/, '');
                              return (
                                <div key={f.name} className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-sm">
                                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-[11px] text-slate-700 truncate max-w-[120px]" title={f.name}>{displayName}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openBlob(f.path)} title="Open">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => downloadBlob(f.path, f.name)} title="Download">
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Group: Hiring Papers */}
                        {r.files.some(f => f.name.startsWith('HIR_') || f.name.startsWith('أوراق_تعيين_')) && (
                          <div className="flex flex-wrap gap-2 items-center w-full justify-end">
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 mr-2">Hiring Papers:</span>
                            {r.files.filter(f => f.name.startsWith('HIR_') || f.name.startsWith('أوراق_تعيين_')).map(f => {
                              const displayName = f.name.replace(/^(HIR_|أوراق_تعيين_)(\d+_)/, '');
                              return (
                                <div key={f.name} className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-sm">
                                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                                  <span className="text-[11px] text-slate-700 truncate max-w-[120px]" title={f.name}>{displayName}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openBlob(f.path)} title="Open">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => downloadBlob(f.path, f.name)} title="Download">
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Group: Missing Papers */}
                        {r.files.some(f => f.name.startsWith('MIS_') || f.name.startsWith('الاوراق_الناقصة_') || f.name.startsWith('أوراق_ناقصة_')) && (
                          <div className="flex flex-wrap gap-2 items-center w-full justify-end">
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 mr-2">Missing Papers:</span>
                            {r.files.filter(f => f.name.startsWith('MIS_') || f.name.startsWith('الاوراق_الناقصة_') || f.name.startsWith('أوراق_ناقصة_')).map(f => {
                              const displayName = f.name.replace(/^(MIS_|الاوراق_الناقصة_|أوراق_ناقصة_)(\d+_)?/, '');
                              return (
                                <div key={f.name} className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-sm">
                                  <FileText className="w-3.5 h-3.5 text-rose-500" />
                                  <span className="text-[11px] text-slate-700 truncate max-w-[120px]" title={f.name}>{displayName}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openBlob(f.path)} title="Open">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => downloadBlob(f.path, f.name)} title="Download">
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Group: Renewal Papers */}
                        {r.files.some(f => f.name.startsWith('REN_') || f.name.startsWith('اوراق_التجديد_') || f.name.startsWith('أوراق_تجديد_')) && (
                          <div className="flex flex-wrap gap-2 items-center w-full justify-end">
                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 mr-2">Renewal Papers:</span>
                            {r.files.filter(f => f.name.startsWith('REN_') || f.name.startsWith('اوراق_التجديد_') || f.name.startsWith('أوراق_تجديد_')).map(f => {
                              const displayName = f.name.replace(/^(REN_|اوراق_التجديد_|أوراق_تجديد_)(\d+_)?/, '');
                              return (
                                <div key={f.name} className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-sm">
                                  <FileText className="w-3.5 h-3.5 text-purple-500" />
                                  <span className="text-[11px] text-slate-700 truncate max-w-[120px]" title={f.name}>{displayName}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openBlob(f.path)} title="Open">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => downloadBlob(f.path, f.name)} title="Download">
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Group: Others */}
                        {r.files.some(f => !f.name.startsWith('CNT_') && !f.name.startsWith('عقد_') && !f.name.startsWith('HIR_') && !f.name.startsWith('أوراق_تعيين_') && !f.name.startsWith('MIS_') && !f.name.startsWith('الاوراق_الناقصة_') && !f.name.startsWith('أوراق_ناقصة_') && !f.name.startsWith('REN_') && !f.name.startsWith('اوراق_التجديد_') && !f.name.startsWith('أوراق_تجديد_')) && (
                          <div className="flex flex-wrap gap-2 items-center w-full justify-end">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 mr-2">Others:</span>
                            {r.files.filter(f => !f.name.startsWith('CNT_') && !f.name.startsWith('عقد_') && !f.name.startsWith('HIR_') && !f.name.startsWith('أوراق_تعيين_') && !f.name.startsWith('MIS_') && !f.name.startsWith('الاوراق_الناقصة_') && !f.name.startsWith('أوراق_ناقصة_') && !f.name.startsWith('REN_') && !f.name.startsWith('اوراق_التجديد_') && !f.name.startsWith('أوراق_تجديد_')).map(f => (
                              <div key={f.name} className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-2 py-1 shadow-sm">
                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-[11px] text-slate-700 truncate max-w-[120px]" title={f.name}>{f.name}</span>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openBlob(f.path)} title="Open">
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => downloadBlob(f.path, f.name)} title="Download">
                                  <Download className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 w-full flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFilteredZip([r], `${r.name}_${r.system}`, 'all')}
                            disabled={zipping}
                            className="h-7 text-xs gap-1 font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            <Package className="w-3 h-3" /> Download All ZIP
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={selectiveOpen} onOpenChange={setSelectiveOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-indigo-600" />
              Selective Download — choose couriers to download their files
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PaperType)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-4 w-full">
              {(Object.keys(PAPER_TYPE_META) as PaperType[]).map(t => {
                const count = rows.filter(r => r.files.some(f => matchesType(f.name, t))).length;
                return (
                  <TabsTrigger key={t} value={t} className="text-xs font-bold">
                    {PAPER_TYPE_META[t].label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="px-1 pt-3 pb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, warehouse, or region..."
                  value={dialogSearch}
                  onChange={e => setDialogSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 w-full text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {(Object.keys(PAPER_TYPE_META) as PaperType[]).map(t => {
              const q = dialogSearch.trim().toLowerCase();
              const couriersForType = rows
                .filter(r => r.files.some(f => matchesType(f.name, t)))
                .filter(r => !q || r.name.toLowerCase().includes(q) || r.system.toLowerCase().includes(q) || r.region.toLowerCase().includes(q));

              const grouped = couriersForType.reduce((acc, r) => {
                const key = r.region || 'No region';
                (acc[key] = acc[key] || []).push(r);
                return acc;
              }, {} as Record<string, CourierRow[]>);

              const subjectKey: keyof CourierRow =
                t === 'hiring' ? 'emailSubject'
                : t === 'contracts' ? 'emailSubjectContracts'
                : t === 'missing' ? 'emailSubjectMissing'
                : 'emailSubjectRenewal';
              const getSubject = (r: CourierRow) => ((r[subjectKey] as string) || '').trim();

              const sel = selectedIds[t];
              const allVisibleIds = couriersForType.map(r => r.id);
              const noSubjectIds = couriersForType.filter(r => !getSubject(r)).map(r => r.id);
              const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => sel.has(id));
              const allNoSubjectSelected = noSubjectIds.length > 0 && noSubjectIds.every(id => sel.has(id));

              const toggleAll = () => {
                setSelectedIds(prev => {
                  const next = new Set(prev[t]);
                  if (allSelected) allVisibleIds.forEach(id => next.delete(id));
                  else allVisibleIds.forEach(id => next.add(id));
                  return { ...prev, [t]: next };
                });
              };

              const toggleNoSubject = () => {
                setSelectedIds(prev => {
                  const next = new Set(prev[t]);
                  if (allNoSubjectSelected) noSubjectIds.forEach(id => next.delete(id));
                  else noSubjectIds.forEach(id => next.add(id));
                  return { ...prev, [t]: next };
                });
              };

              const toggleOne = (id: string) => {
                setSelectedIds(prev => {
                  const next = new Set(prev[t]);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return { ...prev, [t]: next };
                });
              };

              return (
                <TabsContent key={t} value={t} className="flex-1 overflow-auto mt-0 border border-slate-200 rounded-md">
                  <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                        Select All ({allVisibleIds.length})
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-amber-700 cursor-pointer">
                        <Checkbox checked={allNoSubjectSelected} onCheckedChange={toggleNoSubject} />
                        Select those without Subject ({noSubjectIds.length})
                      </label>
                    </div>
                    <span className="text-xs text-slate-500">{sel.size} selected</span>
                  </div>
                  {couriersForType.length === 0 ? (
                    <div className="text-center py-12 text-sm text-slate-400">No couriers found</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {Object.entries(grouped).map(([region, list]) => (
                        <div key={region}>
                          <div className="bg-slate-100/60 px-3 py-1.5 text-xs font-bold text-slate-600 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" /> {region}
                            <span className="text-slate-400 font-normal">({list.length})</span>
                          </div>
                          {list.map(r => {
                            const count = r.files.filter(f => matchesType(f.name, t)).length;
                            const subject = getSubject(r);
                            return (
                              <label key={r.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer">
                                <Checkbox checked={sel.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 truncate">{r.name}</div>
                                  <div className="text-[11px] text-slate-500 truncate">{r.system} · {r.idNumber}</div>
                                  {subject ? (
                                    <div className="text-[11px] text-indigo-700 font-semibold truncate mt-0.5" title={subject}>
                                      ✉ {subject}
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-amber-600 font-bold mt-0.5">⚠ No Subject</div>
                                  )}
                                </div>
                                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  {count} files
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          <DialogFooter className="flex-row justify-between items-center sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(prev => ({ ...prev, [activeTab]: new Set() }))}
              className="text-xs"
            >
              Clear Selection
            </Button>
            <Button
              size="sm"
              disabled={zipping || selectedIds[activeTab].size === 0}
              onClick={async () => {
                const ids = selectedIds[activeTab];
                const subset = rows.filter(r => ids.has(r.id));
                const zipName = `${PAPER_TYPE_META[activeTab].label.replace(/\s+/g, '_')}_Selected_${new Date().toISOString().slice(0,10)}`;
                await downloadFilteredZip(subset, zipName, activeTab);
              }}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-bold"
            >
              {zipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download Selected ({selectedIds[activeTab].size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
