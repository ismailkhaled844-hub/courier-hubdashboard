import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Building2, Users, UserCheck, UserX, UserMinus, CheckCircle2, Search, Filter, Download, 
  FileSpreadsheet, Upload, Plus, Pencil, Trash2, MapPin, Phone, Mail, 
  ShieldAlert, Loader2, FileText, ExternalLink, Briefcase, Package, X, FolderArchive,
  XCircle, ArrowUpRight
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { exportToExcel } from '@/lib/export-excel';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ManpowerPapers from './ManpowerPapers';

interface ManpowerRecord {
  id: string;
  courierName: string;
  system: string;
  status: 'Active' | 'Leaver';
  leaverType: '' | 'Terminated' | 'Churned';
  leaverReason: string;
  leavingDate: string;
  employmentType: 'Fixed' | 'Outsource';
  region: string;
  mobile: string;
  mobilePersonal: string;
  gmail: string;
  mobileLine: 'Yes' | 'No';
  accountBank: string;
  idNumber: string;
  medicalCard: 'Yes' | 'No';
  insuranceNo: string;
  ka3b3aml: 'Yes' | 'No';
  contracts: 'Pending' | 'Signed';
  emailSubject: string;
  emailSubjectContracts?: string;
  emailSubjectMissing?: string;
  emailSubjectRenewal?: string;
  documents: {
    birth: boolean;
    criminal: boolean;
    graduation: boolean;
    military: boolean;
    insurancePrint: boolean;
    photos: boolean;
    form1: boolean;
  };
}

const REGIONS = [
  "Assiut FC", "Bani sweif", "El-Mahala", "Elmenya", "Khorshed Alex", 
  "Mansoura FC", "Qwesna", "Sharqya", "Sohag", "Tanta"
];

const STORAGE_BUCKET = 'manpower-docs';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const emptyDocuments = () => ({
  birth: false,
  criminal: false,
  graduation: false,
  military: false,
  insurancePrint: false,
  photos: false,
  form1: false,
});

const toYesNo = (value: unknown): 'Yes' | 'No' => String(value || '').trim().toLowerCase() === 'yes' ? 'Yes' : 'No';
const toDocBool = (value: unknown) => ['yes', 'y', 'true', '1', 'done', 'ok'].includes(String(value || '').trim().toLowerCase());
const cleanFileName = (name: string) => {
  // Split extension
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).replace(/[^a-zA-Z0-9.]/g, '') : '';
  // Keep only ASCII alphanumerics, dash, underscore, dot. Replace everything else (including Arabic) with _
  const safeBase = base
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (safeBase || 'file') + (ext || '.pdf');
};
const storagePath = (path: string) => path; // keys are already ASCII-safe

const uploadFileWithProgress = async (path: string, file: File, onProgress: (progress: number) => void) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_KEY;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath(path)}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.responseText || 'Upload failed'));
    };
    xhr.onerror = () => reject(new Error('Upload connection failed'));
    xhr.send(file);
  });
};

const StatusBadge = ({ status }: { status: ManpowerRecord['status'] }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border shadow-sm ${
    status === 'Active' 
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
      : 'bg-rose-50 text-rose-700 border-rose-200'
  }`}>
    {status === 'Active' ? <UserCheck className="w-3 h-3 mr-1" /> : <UserX className="w-3 h-3 mr-1" />}
    {status}
  </span>
);

const TypeBadge = ({ type }: { type: ManpowerRecord['employmentType'] }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
    type === 'Fixed' 
      ? 'bg-blue-50 text-blue-700 border-blue-200' 
      : 'bg-purple-50 text-purple-700 border-purple-200'
  }`}>
    {type}
  </span>
);

const DocIcon = ({ hasDoc }: { hasDoc: boolean }) => (
  <div className={`w-5 h-5 rounded-full flex items-center justify-center mx-auto transition-all ${
    hasDoc ? 'bg-emerald-100 text-emerald-600 shadow-inner' : 'bg-slate-50 text-slate-300'
  }`}>
    {hasDoc ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
  </div>
);

const ColumnFilter = ({ 
  label, 
  options, 
  selected, 
  onSelect 
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  onSelect: (vals: string[]) => void 
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`p-1 rounded hover:bg-slate-200 transition-colors ${selected.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
          <Filter className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-2 border-b bg-slate-50">
          <p className="text-xs font-bold text-slate-700">Filter {label}</p>
        </div>
        <div className="max-h-60 overflow-auto p-2 space-y-1">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded cursor-pointer group">
              <Checkbox 
                checked={selected.includes(opt)} 
                onCheckedChange={(checked) => {
                  if (checked) onSelect([...selected, opt]);
                  else onSelect(selected.filter(s => s !== opt));
                }}
              />
              <span className="text-xs text-slate-600 group-hover:text-slate-900">{opt || '(Empty)'}</span>
            </label>
          ))}
        </div>
        <div className="p-2 border-t flex justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => onSelect([])}>Clear</Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => onSelect(options)}>Select All</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default function RegionsManpowerSheet() {
  const [data, setData] = useState<ManpowerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRegion, setActiveRegion] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Regions State
  const [regions, setRegions] = useState<string[]>([]);
  const [isManagingRegions, setIsManagingRegions] = useState(false);
  const [regionPassword, setRegionPassword] = useState("");
  const [newRegionName, setNewRegionName] = useState("");
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  // Form State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ManpowerRecord>({
    id: '', courierName: '', system: '', status: 'Active', leaverType: '', leaverReason: '', leavingDate: '-', employmentType: 'Fixed',
    region: 'Assiut FC', mobile: '', mobilePersonal: '', gmail: '', mobileLine: 'No',
    accountBank: '', idNumber: '', medicalCard: 'No', insuranceNo: '', ka3b3aml: 'No',
    contracts: 'Pending', emailSubject: '', emailSubjectContracts: '', emailSubjectMissing: '', emailSubjectRenewal: '', documents: emptyDocuments()
  });

  // Docs state
  const [docsCourier, setDocsCourier] = useState<ManpowerRecord | null>(null);
  const [courierFiles, setCourierFiles] = useState<any[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingName, setUploadingName] = useState('');
  const [selectedDocType, setSelectedDocType] = useState<'Contract' | 'HiringPapers' | 'MissingDocs' | 'RenewalDocs'>('HiringPapers');
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [tempSubject, setTempSubject] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);

  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});

  const getUniqueValues = (key: keyof ManpowerRecord) => {
    return Array.from(new Set(data.map(d => String(d[key] || '')))).sort();
  };

  const fetchRegions = async () => {
    const { data: savedRegions, error } = await (supabase as any)
      .from('manpower_regions')
      .select('name')
      .order('name', { ascending: true });

    if (error) {
      setRegions(REGIONS);
      return;
    }

    const nextRegions = Array.from(new Set<string>((savedRegions || []).map((r: any) => String(r.name || '')).filter(Boolean))).sort();
    setRegions(nextRegions);
  };

  const loadData = async () => {
    setLoading(true);
    const { data: records, error } = await supabase
      .from('manpower')
      .select('*')
      .order('courier_name', { ascending: true });

    if (error) {
      toast({ title: 'Error loading data', description: error.message, variant: 'destructive' });
    } else {
      const mapped = (records || []).map(r => ({
        id: r.id,
        courierName: r.courier_name,
        system: r.system,
        status: r.status as ManpowerRecord['status'],
        leaverType: (r as any).leaver_type || '',
        leaverReason: (r as any).leaver_reason || '',
        leavingDate: r.leaving_date || '-',
        employmentType: r.employment_type as ManpowerRecord['employmentType'],
        region: r.region,
        mobile: r.mobile,
        mobilePersonal: r.mobile_personal,
        gmail: r.gmail,
        mobileLine: r.mobile_line as ManpowerRecord['mobileLine'],
        accountBank: r.account_bank,
        idNumber: r.id_number,
        medicalCard: r.medical_card as ManpowerRecord['medicalCard'],
        insuranceNo: r.insurance_no,
        ka3b3aml: r.ka3b3aml as ManpowerRecord['ka3b3aml'],
        contracts: r.contracts as ManpowerRecord['contracts'],
        emailSubject: r.email_subject || '',
        emailSubjectContracts: r.email_subject_contracts || '',
        emailSubjectMissing: r.email_subject_missing || '',
        emailSubjectRenewal: r.email_subject_renewal || '',
        documents: {
          birth: r.doc_birth,
          criminal: r.doc_criminal,
          graduation: r.doc_graduation,
          military: r.doc_military,
          insurancePrint: r.doc_insurance_print,
          photos: r.doc_photos,
          form1: r.doc_form1,
        }
      })) as ManpowerRecord[];
      setData(mapped);
      
      // Load all file counts for indicators
      const counts: Record<string, number> = {};
      await Promise.all(mapped.map(async (c) => {
        const { data: list } = await supabase.storage.from(STORAGE_BUCKET).list(c.id, { limit: 100 });
        counts[c.id] = (list || []).filter(f => f.name !== '.emptyFolderPlaceholder').length;
      }));
      setDocCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRegions();
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      // Global search
      const matchesSearch = 
        row.courierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.system.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.region.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Tab filters
      if (activeRegion === 'Leavers') {
        if (row.status !== 'Leaver') return false;
      } else if (activeRegion !== 'All') {
        if (row.region !== activeRegion || row.status === 'Leaver') return false;
      } else {
        if (row.status === 'Leaver') return false;
      }

      // Column filters
      for (const [key, selectedValues] of Object.entries(columnFilters)) {
        if (selectedValues.length > 0) {
          if (key.startsWith('doc_')) {
            const docKey = key.replace('doc_', '') as keyof ManpowerRecord['documents'];
            const val = row.documents[docKey] ? 'Yes' : 'No';
            if (!selectedValues.includes(val)) return false;
          } else {
            const val = String(row[key as keyof ManpowerRecord] || '');
            if (!selectedValues.includes(val)) return false;
          }
        }
      }

      return true;
    });
  }, [data, activeRegion, searchQuery, columnFilters]);

  const totalManpower = data.filter(d => d.status !== 'Leaver').length;
  const activeCount = data.filter(d => d.status === 'Active').length;
  const leaverCount = data.filter(d => d.status === 'Leaver').length;

  const regionStats = useMemo(() => {
    return regions.map(region => {
      const regionData = data.filter(d => d.region === region && d.status !== 'Leaver');
      const total = regionData.length;
      const active = regionData.filter(d => d.status === 'Active').length;
      return { region, total, active, percentage: total > 0 ? Math.round((active / total) * 100) : 0 };
    }).sort((a, b) => b.total - a.total);
  }, [data, regions]);

  const handleExport = () => {
    const exportData = filteredData.map(r => ({
      'Courier Name': r.courierName,
      'System ID': r.system,
      'Status': r.status,
      'Type': r.employmentType,
      'Region': r.region,
      'Mobile (Work)': r.mobile,
      'Mobile (Personal)': r.mobilePersonal,
      'Gmail': r.gmail,
      'Mobile Line': r.mobileLine,
      'Bank Account': r.accountBank,
      'ID Number': r.idNumber,
      'Medical Card': r.medicalCard,
      'Insurance No': r.insuranceNo,
      'Ka3b 3aml': r.ka3b3aml,
      'Contracts': r.contracts,
      'Email Subject': r.emailSubject,
      'Birth Cert': r.documents.birth ? 'Yes' : 'No',
      'Criminal Record': r.documents.criminal ? 'Yes' : 'No',
      'Graduation Cert': r.documents.graduation ? 'Yes' : 'No',
      'Military Cert': r.documents.military ? 'Yes' : 'No',
      'Insurance Print': r.documents.insurancePrint ? 'Yes' : 'No',
      'Photos': r.documents.photos ? 'Yes' : 'No',
      'Form 1': r.documents.form1 ? 'Yes' : 'No',
    }));
    exportToExcel(exportData, `Manpower_${activeRegion}_${new Date().toISOString().slice(0,10)}`);
  };

  const handleOpenAddForm = () => {
    setIsEditMode(false);
    setEditingRecord({
      id: '', courierName: '', system: '', status: 'Active', leaverType: '', leaverReason: '', leavingDate: '-', employmentType: 'Fixed',
      region: activeRegion === 'All' || activeRegion === 'Leavers' ? 'Assiut FC' : activeRegion, 
      mobile: '', mobilePersonal: '', gmail: '', mobileLine: 'No',
      accountBank: '', idNumber: '', medicalCard: 'No', insuranceNo: '', ka3b3aml: 'No',
      contracts: 'Pending', emailSubject: '', documents: emptyDocuments()
    });
    setIsSheetOpen(true);
  };

  const handleOpenEditForm = (record: ManpowerRecord) => {
    setIsEditMode(true);
    setEditingRecord({ ...record });
    setIsSheetOpen(true);
  };

  const updateField = (field: keyof ManpowerRecord, value: any) => {
    setEditingRecord(prev => ({ ...prev, [field]: value }));
  };

  const updateDocument = (docField: keyof ManpowerRecord['documents'], value: boolean) => {
    setEditingRecord(prev => ({
      ...prev,
      documents: { ...prev.documents, [docField]: value }
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord.status === 'Leaver' && (!editingRecord.leaverType || !editingRecord.leaverReason.trim() || !editingRecord.leavingDate || editingRecord.leavingDate === '-')) {
      toast({ title: 'Leaver details incomplete', description: 'Select Terminated or Churned and enter the reason and date.', variant: 'destructive' });
      return;
    }
    const payload = {
      courier_name: editingRecord.courierName,
      system: editingRecord.system,
      status: editingRecord.status,
      leaver_type: editingRecord.status === 'Leaver' ? editingRecord.leaverType : '',
      leaver_reason: editingRecord.status === 'Leaver' ? editingRecord.leaverReason : '',
      leaving_date: editingRecord.status === 'Leaver' ? editingRecord.leavingDate : '-',
      employment_type: editingRecord.employmentType,
      region: editingRecord.region,
      mobile: editingRecord.mobile,
      mobile_personal: editingRecord.mobilePersonal,
      gmail: editingRecord.gmail,
      mobile_line: editingRecord.mobileLine,
      account_bank: editingRecord.accountBank,
      id_number: editingRecord.idNumber,
      medical_card: editingRecord.medicalCard,
      insurance_no: editingRecord.insuranceNo,
      ka3b3aml: editingRecord.ka3b3aml,
      contracts: editingRecord.contracts,
      email_subject: editingRecord.emailSubject,
      doc_birth: editingRecord.documents.birth,
      doc_criminal: editingRecord.documents.criminal,
      doc_graduation: editingRecord.documents.graduation,
      doc_military: editingRecord.documents.military,
      doc_insurance_print: editingRecord.documents.insurancePrint,
      doc_photos: editingRecord.documents.photos,
      doc_form1: editingRecord.documents.form1,
    };

    if (isEditMode) {
      // Optimistic UI Update: update local state immediately
      const updatedRecord = { ...editingRecord };
      setData(prev => prev.map(r => r.id === editingRecord.id ? updatedRecord : r));
      setIsSheetOpen(false);
      
      const { error } = await (supabase as any).from('manpower').update(payload).eq('id', editingRecord.id);
      if (error) {
        toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
        loadData(); // Revert/Refresh on error
      } else {
        toast({ title: 'Updated successfully' });
      }
    } else {
      const { data: newRow, error } = await (supabase as any).from('manpower').insert([payload]).select().single();
      if (error) toast({ title: 'Creation failed', description: error.message, variant: 'destructive' });
      else {
        toast({ title: 'Created successfully' });
        setIsSheetOpen(false);
        // Map new row to local state format
        const mapped: ManpowerRecord = {
          id: newRow.id,
          courierName: newRow.courier_name,
          system: newRow.system,
          status: newRow.status,
          leaverType: newRow.leaver_type || '',
          leaverReason: newRow.leaver_reason || '',
          leavingDate: newRow.leaving_date || '-',
          employmentType: newRow.employment_type,
          region: newRow.region,
          mobile: newRow.mobile,
          mobilePersonal: newRow.mobile_personal,
          gmail: newRow.gmail,
          mobileLine: newRow.mobile_line,
          accountBank: newRow.account_bank,
          idNumber: newRow.id_number,
          medicalCard: newRow.medical_card,
          insuranceNo: newRow.insurance_no,
          ka3b3aml: newRow.ka3b3aml,
          contracts: newRow.contracts,
          emailSubject: newRow.email_subject || '',
          documents: {
            birth: newRow.doc_birth,
            criminal: newRow.doc_criminal,
            graduation: newRow.doc_graduation,
            military: newRow.doc_military,
            insurancePrint: newRow.doc_insurance_print,
            photos: newRow.doc_photos,
            form1: newRow.doc_form1,
          }
        };
        setData(prev => [mapped, ...prev]);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this courier?')) return;
    const { error } = await supabase.from('manpower').delete().eq('id', id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Deleted successfully' });
      loadData();
    }
  };

  const loadCourierFiles = async (id: string) => {
    setFilesLoading(true);
    const { data: list, error } = await supabase.storage.from(STORAGE_BUCKET).list(id, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' }
    });
    
    if (error) {
      toast({ title: 'Error loading files', description: error.message, variant: 'destructive' });
    } else {
      const files = (list || [])
        .filter(f => f.name !== '.emptyFolderPlaceholder')
        .map(f => {
          const path = `${id}/${f.name}`;
          return { name: f.name, path, size: f.metadata?.size };
        });
      setCourierFiles(files);
      setDocCounts(prev => ({ ...prev, [id]: files.length }));
    }
    setFilesLoading(false);
  };

  const getSubjectFieldForType = (type: typeof selectedDocType) => {
    switch (type) {
      case 'HiringPapers': return 'email_subject';
      case 'Contract': return 'email_subject_contracts';
      case 'MissingDocs': return 'email_subject_missing';
      case 'RenewalDocs': return 'email_subject_renewal';
      default: return 'email_subject';
    }
  };

  const getDefaultSubjectValue = (courier: ManpowerRecord | null, type: typeof selectedDocType) => {
    if (!courier) return '';
    const name = courier.courierName;
    const id = courier.system;
    switch (type) {
      case 'HiringPapers':
        return `Hiring Papers - ${name} - ${id}`;
      case 'Contract':
        return `Contract - ${name} - ${id}`;
      case 'MissingDocs':
        return `Missing Papers - ${name} - ${id}`;
      case 'RenewalDocs':
        return `Renewal Papers - ${name} - ${id}`;
      default:
        return '';
    }
  };

  const getSubjectValueForType = (courier: ManpowerRecord | null, type: typeof selectedDocType) => {
    if (!courier) return '';
    switch (type) {
      case 'HiringPapers': return courier.emailSubject || '';
      case 'Contract': return courier.emailSubjectContracts || '';
      case 'MissingDocs': return courier.emailSubjectMissing || '';
      case 'RenewalDocs': return courier.emailSubjectRenewal || '';
      default: return '';
    }
  };

  const handleSelectDocType = (type: typeof selectedDocType) => {
    setSelectedDocType(type);
    const subject = getSubjectValueForType(docsCourier, type);
    if (subject.trim()) {
      setTempSubject(subject);
      setIsEditingSubject(false);
    } else {
      setTempSubject(getDefaultSubjectValue(docsCourier, type));
      setIsEditingSubject(true);
    }
  };

  const handleOpenDocs = (courier: ManpowerRecord) => {
    setDocsCourier(courier);
    
    // Determine initially selected doc type based on locking
    let initialType: typeof selectedDocType = 'HiringPapers';
    if (courier.emailSubject?.trim()) {
      initialType = 'Contract';
      if (courier.emailSubjectContracts?.trim()) {
        initialType = 'MissingDocs';
        if (courier.emailSubjectMissing?.trim()) {
          initialType = 'RenewalDocs';
        }
      }
    }
    setSelectedDocType(initialType);
    
    const initialSubject = getSubjectValueForType(courier, initialType);
    if (initialSubject.trim()) {
      setTempSubject(initialSubject);
      setIsEditingSubject(false);
    } else {
      setTempSubject(getDefaultSubjectValue(courier, initialType));
      setIsEditingSubject(true);
    }
    
    loadCourierFiles(courier.id);
  };

  const handleSaveSubject = async () => {
    if (!docsCourier) return;
    setSavingSubject(true);
    const dbField = getSubjectFieldForType(selectedDocType);
    try {
      const { error } = await supabase
        .from('manpower')
        .update({ [dbField]: tempSubject } as any)
        .eq('id', docsCourier.id);

      if (error) {
        toast({ title: 'Failed to save email subject', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Email subject saved successfully' });
        
        const courierProp = selectedDocType === 'HiringPapers' ? 'emailSubject' 
          : selectedDocType === 'Contract' ? 'emailSubjectContracts'
          : selectedDocType === 'MissingDocs' ? 'emailSubjectMissing'
          : 'emailSubjectRenewal';

        const updatedCourier = { ...docsCourier, [courierProp]: tempSubject };
        setDocsCourier(updatedCourier);
        setData(prev => prev.map(r => r.id === docsCourier.id ? updatedCourier : r));
        setIsEditingSubject(!tempSubject.trim());
      }
    } catch (err: any) {
      toast({ title: 'An error occurred', description: err.message, variant: 'destructive' });
    } finally {
      setSavingSubject(false);
    }
  };

  const handleRequestEditSubject = () => {
    const pw = prompt('Please enter the password to edit or delete the email subject:');
    if (pw === '1017') {
      setIsEditingSubject(true);
    } else {
      toast({ title: 'Incorrect password', description: 'You cannot edit or delete the email subject without the correct password.', variant: 'destructive' });
    }
  };


  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docsCourier) return;
    
    const currentSubject = getSubjectValueForType(docsCourier, selectedDocType);
    if (currentSubject.trim()) {
      let typeLabel = 'Hiring Papers';
      if (selectedDocType === 'Contract') typeLabel = 'Contract';
      if (selectedDocType === 'MissingDocs') typeLabel = 'Missing Papers';
      if (selectedDocType === 'RenewalDocs') typeLabel = 'Renewal Papers';

      toast({ title: 'Upload failed', description: `Uploading ${typeLabel} is locked because an email subject is already registered for this courier.`, variant: 'destructive' });
      if (docFileInputRef.current) docFileInputRef.current.value = '';
      return;
    }
    
    setUploadingDoc(true);
    setUploadProgress(5);
    setUploadingName(file.name);
    
    const prefix = 
      selectedDocType === 'Contract' ? 'CNT' : 
      selectedDocType === 'HiringPapers' ? 'HIR' : 
      selectedDocType === 'MissingDocs' ? 'MIS' : 'REN';
    const safeName = `${prefix}_${Date.now()}_${cleanFileName(file.name)}`;
    const path = `${docsCourier.id}/${safeName}`;
    
    try {
      await uploadFileWithProgress(path, file, setUploadProgress);
      setUploadProgress(100);
      const nextFile = { name: safeName, path, size: file.size };
      setCourierFiles(prev => [nextFile, ...prev]);
      setDocCounts(prev => ({ ...prev, [docsCourier.id]: (prev[docsCourier.id] || 0) + 1 }));
      toast({ title: 'Upload successful', description: file.name });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setTimeout(() => {
        setUploadingDoc(false);
        setUploadProgress(0);
      }, 500);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (fileName: string) => {
    if (!docsCourier || !confirm('Delete this document?')) return;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([`${docsCourier.id}/${fileName}`]);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Deleted' });
      setCourierFiles(prev => prev.filter(f => f.name !== fileName));
      setDocCounts(prev => ({ ...prev, [docsCourier.id]: Math.max((prev[docsCourier.id] || 1) - 1, 0) }));
    }
  };

  const downloadAsBlob = async (path: string, name: string) => {
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
      if (error || !data) throw error || new Error('Download failed');
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60 * 10, { download: false });
    if (error || !data?.signedUrl) {
      toast({ title: 'Open failed', description: error?.message || 'Try again', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadTemplate = () => {
    if (activeRegion === 'All' || activeRegion === 'Leavers') return;
    const template = [
      {
        'Courier Name': 'John Doe',
        'System ID': '12345',
        'Employment Type': 'Fixed',
        'Mobile (Work)': '0123456789',
        'Mobile (Personal)': '0123456789',
        'Gmail': 'john@gmail.com',
        'Mobile Line': 'No',
        'Account Bank': 'CIB-0000',
        'National ID': '29000000000000',
        'Medical Card': 'No',
        'Insurance No': '987654321',
        'Contracts Status': 'Pending',
        'Ka3b 3aml': 'No',
        'Email Subject': '',
        'Birth': 'No',
        'Crim': 'No',
        'Grad': 'No',
        'Mili': 'No',
        'Insurance Print': 'No',
        'Photos': 'No',
        'Form1': 'No'
      }
    ];
    exportToExcel(template, `Template_${activeRegion}`);
  };

  const handleBulkFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeRegion === 'All' || activeRegion === 'Leavers') return;
    
    setBulkUploading(true);
    toast({ title: 'Processing file...', description: 'Please wait' });
    
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws) as any[];
        
        const toInsert = rows.map(r => ({
          courier_name: r['Courier Name'] || '',
          system: String(r['System ID'] || ''),
          status: 'Active',
          employment_type: r['Employment Type'] || 'Fixed',
          region: activeRegion,
          mobile: String(r['Mobile (Work)'] || ''),
          mobile_personal: String(r['Mobile (Personal)'] || ''),
          gmail: r['Gmail'] || '',
          mobile_line: r['Mobile Line'] || 'No',
          account_bank: r['Account Bank'] || '',
          id_number: String(r['National ID'] || ''),
          medical_card: r['Medical Card'] || 'No',
          insurance_no: String(r['Insurance No'] || ''),
          contracts: r['Contracts Status'] || 'Pending',
          ka3b3aml: r['Ka3b 3aml'] || 'No',
          email_subject: r['Email Subject'] || '',
          doc_birth: toDocBool(r['Birth'] ?? r['Birth Cert']),
          doc_criminal: toDocBool(r['Crim'] ?? r['Criminal Record']),
          doc_graduation: toDocBool(r['Grad'] ?? r['Graduation Cert']),
          doc_military: toDocBool(r['Mili'] ?? r['Military Cert']),
          doc_insurance_print: toDocBool(r['Insurance Print']),
          doc_photos: toDocBool(r['Photos']),
          doc_form1: toDocBool(r['Form1'] ?? r['Form 1']),
        }));

        const { error } = await (supabase as any).from('manpower').insert(toInsert);
        if (error) toast({ title: 'Bulk upload failed', description: error.message, variant: 'destructive' });
        else {
          toast({ title: 'Bulk upload success', description: `Added ${toInsert.length} couriers to ${activeRegion}` });
          loadData();
        }
        setBulkUploading(false);
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      toast({ title: 'Processing failed', description: err.message, variant: 'destructive' });
      setBulkUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddRegion = async () => {
    const name = newRegionName.trim();
    if (!name) return;
    if (regions.includes(name)) {
      toast({ title: "Warehouse already exists", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from('manpower_regions').insert([{ name }]);
    if (error) {
      toast({ title: "Failed to add warehouse", description: error.message, variant: "destructive" });
      return;
    }
    setRegions(prev => [...prev, name].sort());
    setActiveRegion(name);
    setNewRegionName("");
    toast({ title: "Warehouse added successfully" });
  };

  const handleRemoveRegion = async (regionToRemove: string) => {
    if (data.some(d => d.region === regionToRemove && d.status !== 'Leaver')) {
      toast({ 
        title: "Cannot delete warehouse", 
        description: "There are active couriers in this warehouse.", 
        variant: "destructive" 
      });
      return;
    }
    const { error } = await (supabase as any).from('manpower_regions').delete().eq('name', regionToRemove);
    if (error) {
      toast({ title: "Failed to delete warehouse", description: error.message, variant: "destructive" });
      return;
    }
    setRegions(prev => prev.filter(r => r !== regionToRemove));
    if (activeRegion === regionToRemove) setActiveRegion("All");
    toast({ title: "Warehouse deleted" });
  };

  const verifyPassword = () => {
    if (regionPassword === "1017") {
      setIsPasswordVerified(true);
      setRegionPassword("");
    } else {
      toast({ title: "Incorrect password", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden font-sans rounded-xl border border-slate-200 shadow-sm relative">
      
      {/* Main Tabs Container */}
      <Tabs defaultValue="manpower" onValueChange={(val) => { if (val === 'manpower') loadData(); }} className="flex-1 flex flex-col min-h-0">
        <div className="bg-white px-4 border-b border-slate-200 z-10 flex-shrink-0 flex items-center justify-between">
          <TabsList className="bg-transparent border-b-0 h-12 gap-6">
            <TabsTrigger 
              value="manpower" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-2 text-sm font-bold"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Manpower List
              </div>
            </TabsTrigger>
            <TabsTrigger 
              value="archive" 
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 rounded-none h-12 px-2 text-sm font-bold"
            >
              <div className="flex items-center gap-2">
                <FolderArchive className="w-4 h-4" />
                Uploaded Papers
              </div>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 uppercase tracking-wider">
              System Version 2.0
            </span>
          </div>
        </div>

        <TabsContent value="manpower" className="flex-1 flex flex-col min-h-0 m-0 p-0 border-0 data-[state=inactive]:hidden">
          {/* Ultra Compact Header Area */}
          <div className="bg-white px-4 py-2 border-b border-slate-200 z-10 flex-shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Manpower
                </h1>
                
                {/* Inline Mini KPIs */}
                <div className="hidden md:flex items-center gap-2 border-l pl-3 border-slate-200">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 shadow-sm gap-1">
                    <Users className="w-3 h-3 text-indigo-600" /> 
                    <span className="font-bold text-slate-900">{totalManpower}</span> Total
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm gap-1">
                    <UserCheck className="w-3 h-3" /> 
                    <span className="font-bold text-emerald-900">{activeCount}</span> Active
                  </span>
                  <button 
                    onClick={() => setActiveRegion("Leavers")}
                    className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border shadow-sm gap-1 transition-all hover:bg-rose-100 ${activeRegion === 'Leavers' ? 'bg-rose-100 border-rose-300 text-rose-800 ring-1 ring-rose-500' : 'bg-rose-50 text-rose-700 border-rose-200'}`}
                  >
                    <UserX className="w-3 h-3" /> 
                    <span className="font-bold text-rose-900">{leaverCount}</span> Leavers
                  </button>
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-900 text-slate-100 border border-slate-800 shadow-sm gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Synced
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 w-48 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-xs text-slate-700 gap-1.5 border-slate-200 hover:bg-slate-50">
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
                {(() => {
                  const regionLocked = activeRegion !== 'All' && activeRegion !== 'Leavers' && regions.includes(activeRegion);
                  return (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadTemplate}
                        disabled={!regionLocked}
                        title={regionLocked ? `Download template for ${activeRegion}` : 'Select your warehouse tab first'}
                        className="h-8 text-xs text-slate-700 gap-1.5 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Template{regionLocked ? ` · ${activeRegion}` : ''}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleBulkFileChosen}
                      />
                      <Button
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={bulkUploading || !regionLocked}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title={regionLocked ? `All rows will be uploaded to: ${activeRegion}` : 'Pick your warehouse tab first — bulk upload to All Regions is disabled'}
                      >
                        {bulkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Bulk Upload{regionLocked ? ` · ${activeRegion}` : ''}
                      </Button>
                    </>
                  );
                })()}
                <Button size="sm" onClick={handleOpenAddForm} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm">
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsManagingRegions(true)} 
                  className="h-8 text-xs text-slate-700 gap-1.5 border-slate-200 hover:bg-slate-50"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Warehouses
                </Button>
              </div>
            </div>
          </div>

          {/* Compact Regional Stats Scroller */}
          <div className="bg-white border-b border-slate-200 px-4 py-1.5 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
              {regionStats.map(stat => (
                <div key={stat.region} className="snap-start flex-shrink-0 w-32 bg-slate-50 border border-slate-200 rounded-md p-1.5 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer" onClick={() => setActiveRegion(stat.region)}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-semibold text-slate-800 truncate pr-1 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-slate-400" /> {stat.region}
                    </span>
                    <span className="text-[10px] font-bold text-slate-900 bg-white px-1 py-0.5 rounded shadow-sm border border-slate-100">{stat.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1 mb-1 overflow-hidden">
                    <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${stat.percentage}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[9px] font-medium text-slate-500">
                    <span>Act: {stat.active}</span>
                    <span className={stat.percentage > 80 ? 'text-emerald-600' : 'text-amber-600'}>{stat.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
            
            {/* Navigation Pills */}
            <div className="px-4 py-2 flex-shrink-0 flex items-center justify-between bg-white border-b border-slate-200">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                <button 
                  onClick={() => setActiveRegion("All")}
                  className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-semibold transition-all ${activeRegion === "All" ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 border border-transparent hover:border-slate-300'}`}
                >
                  All Regions
                </button>
                {regions.map(region => (
                  <button 
                    key={region}
                    onClick={() => setActiveRegion(region)}
                    className={`whitespace-nowrap px-3 py-1 rounded-md text-xs font-semibold transition-all ${activeRegion === region ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 border border-transparent hover:border-slate-300'}`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Table Container */}
            <div className="flex-1 flex flex-col min-h-0 bg-white border-b border-slate-200 shadow-sm overflow-hidden m-4 rounded-lg border">
              <div className="overflow-auto flex-1 min-h-0 relative">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-max">
                  <thead className="bg-slate-50/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-200 shadow-sm">
                    <tr className="bg-slate-50">
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left sticky left-0 bg-slate-50 z-20 min-w-[150px]">
                        <div className="flex items-center justify-between gap-2">
                          Courier Profile
                          <ColumnFilter label="Courier" options={getUniqueValues('courierName')} selected={columnFilters.courierName || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, courierName: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[100px]">
                        <div className="flex items-center justify-between gap-2">
                          Status
                          <ColumnFilter label="Status" options={getUniqueValues('status')} selected={columnFilters.status || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, status: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[100px]">
                        <div className="flex items-center justify-between gap-2">
                          Type
                          <ColumnFilter label="Type" options={getUniqueValues('employmentType')} selected={columnFilters.employmentType || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, employmentType: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[120px]">
                        <div className="flex items-center justify-between gap-2">
                          Region
                          <ColumnFilter label="Region" options={getUniqueValues('region')} selected={columnFilters.region || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, region: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[110px]">
                        <div className="flex items-center justify-between gap-2">
                          Work Mobile
                          <ColumnFilter label="Work Mobile" options={getUniqueValues('mobile')} selected={columnFilters.mobile || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, mobile: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[110px]">
                        <div className="flex items-center justify-between gap-2">
                          Personal
                          <ColumnFilter label="Personal Mobile" options={getUniqueValues('mobilePersonal')} selected={columnFilters.mobilePersonal || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, mobilePersonal: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[150px]">
                        <div className="flex items-center justify-between gap-2">
                          Gmail
                          <ColumnFilter label="Gmail" options={getUniqueValues('gmail')} selected={columnFilters.gmail || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, gmail: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-center min-w-[90px]">
                        <div className="flex items-center justify-center gap-2">
                          Line
                          <ColumnFilter label="Line" options={getUniqueValues('mobileLine')} selected={columnFilters.mobileLine || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, mobileLine: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[120px]">
                        <div className="flex items-center justify-between gap-2">
                          Bank
                          <ColumnFilter label="Bank" options={getUniqueValues('accountBank')} selected={columnFilters.accountBank || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, accountBank: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[130px]">
                        <div className="flex items-center justify-between gap-2">
                          ID Number
                          <ColumnFilter label="ID" options={getUniqueValues('idNumber')} selected={columnFilters.idNumber || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, idNumber: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-center min-w-[90px]">
                        <div className="flex items-center justify-center gap-2">
                          Med
                          <ColumnFilter label="Medical" options={getUniqueValues('medicalCard')} selected={columnFilters.medicalCard || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, medicalCard: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[120px]">
                        <div className="flex items-center justify-between gap-2">
                          Insur. No
                          <ColumnFilter label="Insur." options={getUniqueValues('insuranceNo')} selected={columnFilters.insuranceNo || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, insuranceNo: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-center min-w-[90px]">
                        <div className="flex items-center justify-center gap-2">
                          Ka3b
                          <ColumnFilter label="Ka3b" options={getUniqueValues('ka3b3aml')} selected={columnFilters.ka3b3aml || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, ka3b3aml: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide text-left min-w-[110px]">
                        <div className="flex items-center justify-between gap-2">
                          Contracts
                          <ColumnFilter label="Contracts" options={getUniqueValues('contracts')} selected={columnFilters.contracts || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, contracts: vals }))} />
                        </div>
                      </th>
                      
                      <th className="py-2 px-1 text-[10px] font-bold text-slate-400 bg-slate-50/50">
                        <div className="flex flex-col items-center">
                          Birth
                          <ColumnFilter label="Birth" options={['Yes', 'No']} selected={columnFilters.doc_birth || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, doc_birth: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-1 text-[10px] font-bold text-slate-400 bg-slate-50/50">
                        <div className="flex flex-col items-center">
                          Crim
                          <ColumnFilter label="Criminal" options={['Yes', 'No']} selected={columnFilters.doc_criminal || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, doc_criminal: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-1 text-[10px] font-bold text-slate-400 bg-slate-50/50">
                        <div className="flex flex-col items-center">
                          Grad
                          <ColumnFilter label="Grad" options={['Yes', 'No']} selected={columnFilters.doc_graduation || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, doc_graduation: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-1 text-[10px] font-bold text-slate-400 bg-slate-50/50">
                        <div className="flex flex-col items-center">
                          Mili
                          <ColumnFilter label="Mili" options={['Yes', 'No']} selected={columnFilters.doc_military || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, doc_military: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-1 text-[10px] font-bold text-slate-400 bg-slate-50/50">
                        <div className="flex flex-col items-center">
                          Photo
                          <ColumnFilter label="Photos" options={['Yes', 'No']} selected={columnFilters.doc_photos || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, doc_photos: vals }))} />
                        </div>
                      </th>
                      <th className="py-2 px-1 text-[10px] font-bold text-slate-400 bg-slate-50/50">
                        <div className="flex flex-col items-center">
                          F1
                          <ColumnFilter label="Form 1" options={['Yes', 'No']} selected={columnFilters.doc_form1 || []} onSelect={(vals) => setColumnFilters(f => ({ ...f, doc_form1: vals }))} />
                        </div>
                      </th>
                      
                      <th className="py-2 px-4 text-xs font-semibold text-slate-500 tracking-wide sticky right-0 bg-slate-50 z-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Courier Profile */}
                        <td className="py-3 px-4 sticky left-0 bg-white group-hover:bg-slate-50/95 z-10">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{row.courierName}</p>
                            <p className="text-xs text-slate-500 font-medium">{row.system}</p>
                          </div>
                        </td>
                        
                        <td className="py-3 px-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="py-3 px-4">
                          <TypeBadge type={row.employmentType} />
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {row.region}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" /> <span title="Work Mobile">{row.mobile}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {row.mobilePersonal ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Phone className="w-3 h-3 text-slate-400" /> <span title="Personal Mobile">{row.mobilePersonal}</span>
                            </div>
                          ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="py-3 px-4">
                          {row.gmail ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <Mail className="w-3 h-3 text-slate-400" /> {row.gmail}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {row.mobileLine === 'Yes' ? (
                            <span className="text-emerald-600 text-sm font-medium">Yes</span>
                          ) : (
                            <span className="text-slate-400 text-sm">No</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-sm text-slate-600 font-medium">
                          {row.accountBank || '-'}
                        </td>

                        <td className="py-3 px-4 text-sm text-slate-600 font-mono">
                          {row.idNumber || '-'}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {row.medicalCard === 'Yes' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                              <ShieldAlert className="w-3 h-3" /> Yes
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">No</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-sm text-slate-600 font-medium">
                          {row.insuranceNo || '-'}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {row.ka3b3aml === 'Yes' ? (
                            <span className="text-emerald-600 text-sm font-medium">Yes</span>
                          ) : (
                            <span className="text-slate-400 text-sm">No</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {row.contracts === "Signed" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Briefcase className="w-3 h-3 mr-1" /> Signed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Documents */}
                        <td className="py-3 px-2 text-center bg-slate-50/30 border-l border-slate-100"><DocIcon hasDoc={row.documents?.birth} /></td>
                        <td className="py-3 px-2 text-center bg-slate-50/30"><DocIcon hasDoc={row.documents?.criminal} /></td>
                        <td className="py-3 px-2 text-center bg-slate-50/30"><DocIcon hasDoc={row.documents?.graduation} /></td>
                        <td className="py-3 px-2 text-center bg-slate-50/30"><DocIcon hasDoc={row.documents?.military} /></td>
                        <td className="py-3 px-2 text-center bg-slate-50/30"><DocIcon hasDoc={row.documents?.photos} /></td>
                        <td className="py-3 px-2 text-center bg-slate-50/30 border-r border-slate-100"><DocIcon hasDoc={row.documents?.form1} /></td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDocs(row)}
                                title={docCounts[row.id] ? `${docCounts[row.id]} PDF(s) uploaded` : 'Upload appointment papers (PDF)'}
                                className={`h-8 w-8 p-0 ${docCounts[row.id] ? 'text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50'}`}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              {docCounts[row.id] > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-1 ring-white">
                                  {docCounts[row.id]}
                                </span>
                              )}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleOpenEditForm(row)} className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(row.id)} className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={20} className="py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <Search className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-base font-medium text-slate-600">No couriers found in this view.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between text-sm text-slate-600 flex-shrink-0">
                <div>Showing <span className="font-semibold text-slate-900">{filteredData.length}</span> results</div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="archive" className="flex-1 flex flex-col min-h-0 m-0 p-0 border-0 data-[state=inactive]:hidden">
          <div className="flex-1 min-h-0 p-4 bg-slate-50/30">
            <ManpowerPapers onSaveSubject={loadData} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Courier Dialog */}
      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="sm:max-w-xl w-full p-0 bg-white overflow-hidden rounded-xl border-none shadow-2xl">
          <div className="px-6 py-5 border-b border-slate-100">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-xl font-bold text-slate-900">
                {isEditMode ? 'Edit Courier Record' : 'Add New Courier'}
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-sm">
                {isEditMode ? 'Update the details for this courier below.' : 'Fill in the information to add a new courier to the system.'}
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="max-h-[80vh] overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-slate-200">
            <form onSubmit={handleSave} className="space-y-8">
              {/* Section 1: Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">Basic Information</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Full Name</label>
                    <input 
                      required 
                      type="text" 
                      value={editingRecord.courierName} 
                      onChange={e => updateField('courierName', e.target.value)} 
                      placeholder="e.g. Abd Allah Lotfy Mohamed Abdel Aziz"
                      className="w-full text-sm border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-4 py-2.5 transition-all outline-none font-medium text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">System ID</label>
                      <input 
                        required 
                        type="text" 
                        value={editingRecord.system} 
                        onChange={e => updateField('system', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border transition-all outline-none" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Region</label>
                      <select 
                        required 
                        value={editingRecord.region} 
                        onChange={e => updateField('region', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border bg-white transition-all outline-none appearance-none"
                      >
                        {regions.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Status</label>
                      <select 
                        required 
                        value={editingRecord.status} 
                        onChange={e => updateField('status', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border bg-white transition-all outline-none appearance-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Leaver">Leaver</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Employment Type</label>
                      <select 
                        required 
                        value={editingRecord.employmentType} 
                        onChange={e => updateField('employmentType', e.target.value)} 
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 px-3.5 py-2 border bg-white transition-all outline-none appearance-none"
                      >
                        <option value="Fixed">Fixed</option>
                        <option value="Outsource">Outsource</option>
                      </select>
                    </div>
                  </div>
                </div>

                {editingRecord.status === 'Leaver' && (
                  <div className="grid grid-cols-3 gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-rose-700 uppercase">Leaver Type</label>
                      <select required value={editingRecord.leaverType} onChange={e => updateField('leaverType', e.target.value)} className="w-full text-xs border-rose-200 rounded-lg px-2 py-1.5 border bg-white">
                        <option value="">Select</option>
                        <option value="Terminated">Terminated</option>
                        <option value="Churned">Churned</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-rose-700 uppercase">Leaving Date</label>
                      <input required type="date" value={editingRecord.leavingDate === '-' ? '' : editingRecord.leavingDate} onChange={e => updateField('leavingDate', e.target.value)} className="w-full text-xs border-rose-200 rounded-lg px-2 py-1.5 border" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-rose-700 uppercase">Reason</label>
                      <input required type="text" value={editingRecord.leaverReason} onChange={e => updateField('leaverReason', e.target.value)} className="w-full text-xs border-rose-200 rounded-lg px-2 py-1.5 border" />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Contact Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">Contact Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Mobile (Work)</label>
                    <input type="text" value={editingRecord.mobile} onChange={e => updateField('mobile', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border transition-all outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Mobile Line</label>
                    <select value={editingRecord.mobileLine} onChange={e => updateField('mobileLine', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border bg-white appearance-none outline-none">
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Mobile (Personal)</label>
                    <input type="text" value={editingRecord.mobilePersonal} onChange={e => updateField('mobilePersonal', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border transition-all outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Email (Gmail)</label>
                    <input type="email" value={editingRecord.gmail} onChange={e => updateField('gmail', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border transition-all outline-none" />
                  </div>
                </div>
              </div>

              {/* Section 3: Documentation Status */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">Documentation Status</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2 bg-slate-50/50 p-5 rounded-xl border border-slate-100">
                  {Object.entries({
                    birth: 'Birth Certificate',
                    criminal: 'Criminal Record',
                    graduation: 'Graduation Cert.',
                    military: 'Military Cert.',
                    insurancePrint: 'Insurance Print',
                    photos: '6 Photos',
                    form1: 'Form 1'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                      <Checkbox 
                        checked={editingRecord.documents[key as keyof typeof editingRecord.documents]} 
                        onCheckedChange={(checked) => updateDocument(key as any, !!checked)}
                        className="w-4.5 h-4.5 rounded-md border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                      <span className="text-[13px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors truncate" title={label}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 4: Legal & Banking (Advanced) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider">Legal, Medical & Banking</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">National ID</label>
                    <input type="text" value={editingRecord.idNumber} onChange={e => updateField('idNumber', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Medical Card</label>
                    <select value={editingRecord.medicalCard} onChange={e => updateField('medicalCard', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border bg-white appearance-none outline-none">
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Insurance No.</label>
                    <input type="text" value={editingRecord.insuranceNo} onChange={e => updateField('insuranceNo', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Account Bank</label>
                    <input type="text" value={editingRecord.accountBank} onChange={e => updateField('accountBank', e.target.value)} placeholder="e.g. CIB-12345" className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border outline-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Contracts Status</label>
                    <select value={editingRecord.contracts} onChange={e => updateField('contracts', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border bg-white appearance-none outline-none">
                      <option value="Pending">Pending</option>
                      <option value="Signed">Signed</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Ka3b 3aml</label>
                    <select value={editingRecord.ka3b3aml} onChange={e => updateField('ka3b3aml', e.target.value)} className="w-full text-sm border-slate-200 rounded-lg px-3.5 py-2 border bg-white appearance-none outline-none">
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-8 flex justify-end gap-3 sticky bottom-0 bg-white py-4 mt-4 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsSheetOpen(false)}
                  className="px-6 h-11 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="px-10 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20"
                >
                  {isEditMode ? 'Save Changes' : 'Create Courier'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!docsCourier} onOpenChange={(o) => { if (!o) setDocsCourier(null); }}>
        <DialogContent className="sm:max-w-2xl" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 justify-start">
              <FileText className="w-5 h-5 text-emerald-600" />
              Courier Papers — {docsCourier?.courierName}
            </DialogTitle>
            <DialogDescription className="text-right">
              Upload, view, or delete the courier's documents (contracts or hiring papers).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pb-4 border-b">
            {(() => {
              const currentSubject = getSubjectValueForType(docsCourier, selectedDocType);
              if (currentSubject?.trim()) {
                let typeLabel = 'Hiring Papers';
                if (selectedDocType === 'Contract') typeLabel = 'Contract';
                if (selectedDocType === 'MissingDocs') typeLabel = 'Missing Papers';
                if (selectedDocType === 'RenewalDocs') typeLabel = 'Renewal Papers';

                return (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2 rounded-lg text-right flex items-center justify-between gap-2">
                    <span>Uploading {typeLabel} is locked because an email subject is already registered for this courier: <strong>{currentSubject}</strong></span>
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                {docsCourier?.system} · {docsCourier?.region}
              </div>
            </div>

            {/* Email Subject Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 font-sans">
                  Email Subject for {
                    selectedDocType === 'Contract' ? 'Contract' :
                    selectedDocType === 'HiringPapers' ? 'Hiring Papers' :
                    selectedDocType === 'MissingDocs' ? 'Missing Papers' :
                    'Renewal Papers'
                  }:
                </label>
                {isEditingSubject ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={tempSubject}
                      onChange={(e) => setTempSubject(e.target.value)}
                      placeholder="Type the sent email subject here..."
                      className="flex-1 text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveSubject}
                      disabled={savingSubject}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      {savingSubject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-3 py-1.5">
                    <span className="text-xs text-slate-800 font-semibold select-all font-sans">
                      {getSubjectValueForType(docsCourier, selectedDocType)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRequestEditSubject}
                      className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold gap-1"
                    >
                      Edit / Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700">File type to upload:</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="docType"
                      checked={selectedDocType === 'HiringPapers'}
                      onChange={() => handleSelectDocType('HiringPapers')}
                      className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                    />
                    <span className={`text-sm ${selectedDocType === 'HiringPapers' ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>Hiring Papers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="docType"
                      checked={selectedDocType === 'Contract'}
                      onChange={() => handleSelectDocType('Contract')}
                      className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                    />
                    <span className={`text-sm ${selectedDocType === 'Contract' ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>Contract</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="docType"
                      checked={selectedDocType === 'MissingDocs'}
                      onChange={() => handleSelectDocType('MissingDocs')}
                      className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                    />
                    <span className={`text-sm ${selectedDocType === 'MissingDocs' ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>Missing Papers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="docType"
                      checked={selectedDocType === 'RenewalDocs'}
                      onChange={() => handleSelectDocType('RenewalDocs')}
                      className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                    />
                    <span className={`text-sm ${selectedDocType === 'RenewalDocs' ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>Renewal Papers</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  ref={docFileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleUploadDoc}
                />
                <Button
                  size="sm"
                  onClick={() => docFileInputRef.current?.click()}
                  disabled={uploadingDoc || !!getSubjectValueForType(docsCourier, selectedDocType)?.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 w-full h-10 text-sm font-bold"
                >
                  {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload {
                    selectedDocType === 'Contract' ? 'Contract' :
                    selectedDocType === 'HiringPapers' ? 'Hiring Papers' :
                    selectedDocType === 'MissingDocs' ? 'Missing Papers' :
                    'Renewal Papers'
                  } file (PDF)
                </Button>
              </div>
            </div>
          </div>

          {uploadingDoc && (
            <div className="border border-emerald-200 bg-emerald-50/50 rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-800 dir-rtl">
                <span className="truncate flex-1 font-medium text-right">Uploading: {uploadingName}</span>
                <span className="font-bold mr-2">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
          <div className="max-h-[400px] overflow-y-auto -mx-1 px-1">
            {filesLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin ml-2" /> Loading…
              </div>
            ) : courierFiles.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No files uploaded yet.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {courierFiles.map(f => {
                  const isContract = f.name.startsWith('CNT_') || f.name.startsWith('عقد_');
                  const isHiring = f.name.startsWith('HIR_') || f.name.startsWith('أوراق_تعيين_');
                  const isMissing = f.name.startsWith('MIS_') || f.name.startsWith('الاوراق_الناقصة_') || f.name.startsWith('أوراق_ناقصة_');
                  const isRenewal = f.name.startsWith('REN_') || f.name.startsWith('اوراق_التجديد_') || f.name.startsWith('أوراق_تجديد_');
                  const displayName = f.name.replace(/^(CNT_|HIR_|MIS_|REN_|عقد_|أوراق_تعيين_|الاوراق_الناقصة_|أوراق_ناقصة_|اوراق_التجديد_|أوراق_تجديد_)(\d+_)?/, '');
                  
                  return (
                    <li key={f.name} className="flex items-center gap-3 py-3 hover:bg-slate-50 px-2 rounded-md transition-colors">
                      <div className={`p-2 rounded-lg ${
                        isContract ? 'bg-blue-50 text-blue-600' : 
                        isHiring ? 'bg-amber-50 text-amber-600' : 
                        isMissing ? 'bg-rose-50 text-rose-600' :
                        isRenewal ? 'bg-purple-50 text-purple-600' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                        <FileText className="w-4 h-4 flex-shrink-0" />
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-slate-800 truncate" title={f.name}>{displayName}</p>
                          {isContract && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded border border-blue-200">Contract</span>
                          )}
                          {isHiring && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded border border-amber-200">Hiring Papers</span>
                          )}
                          {isMissing && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded border border-rose-200">Missing Papers</span>
                          )}
                          {isRenewal && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded border border-purple-200">Renewal Papers</span>
                          )}
                        </div>
                        {f.size != null && (
                          <p className="text-[11px] text-slate-400">{(f.size / 1024).toFixed(1)} KB</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openDoc(f.path)} className="h-8 gap-1.5 text-xs font-medium">
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAsBlob(f.path, f.name)}
                          title="Download"
                          className="h-8 w-8 p-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteDoc(f.name)}
                          className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:border-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Regions Management Dialog */}
      <Dialog open={isManagingRegions} onOpenChange={(o) => { 
        setIsManagingRegions(o); 
        if (!o) { setIsPasswordVerified(false); setRegionPassword(""); } 
      }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>Manage Warehouses</DialogTitle>
            <DialogDescription>Add or remove a warehouse from the system.</DialogDescription>
          </DialogHeader>

          {!isPasswordVerified ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-bold">Password required:</label>
                <input 
                  type="password" 
                  value={regionPassword}
                  onChange={(e) => setRegionPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                  className="w-full p-2 border rounded-md text-center font-mono tracking-widest"
                  placeholder="****"
                />
              </div>
              <Button onClick={verifyPassword} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                Verify
              </Button>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newRegionName}
                  onChange={(e) => setNewRegionName(e.target.value)}
                  className="flex-1 p-2 border rounded-md text-sm"
                  placeholder="New warehouse name..."
                />
                <Button onClick={handleAddRegion} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Add
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 border-b text-xs font-bold text-slate-500">Current Warehouses</div>
                <div className="max-h-[300px] overflow-y-auto">
                  {regions.map(r => (
                    <div key={r} className="flex items-center justify-between px-3 py-2 border-b last:border-0 hover:bg-slate-50 group transition-colors">
                      <span className="text-sm text-slate-700 font-medium">{r}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleRemoveRegion(r)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-[10px] text-slate-400 text-center">
                Note: A warehouse with active couriers cannot be deleted.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
