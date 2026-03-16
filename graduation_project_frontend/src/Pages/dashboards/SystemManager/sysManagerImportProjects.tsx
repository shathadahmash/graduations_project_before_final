import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FiUploadCloud,
  FiDownload,
  FiArrowRight,
  FiCheckCircle,
  FiAlertTriangle,
  FiX
} from "react-icons/fi";

// Types
type ImportError = { row: number; field?: string; message: string; };
type ImportResult = {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  created_projects?: number;
  updated_projects?: number;
  errors: ImportError[];
  valid_projects_names?: string[];
};

const SysManagerImport: React.FC = () => {
  const navigate = useNavigate();

  // --- Logic State ---
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // --- Hierarchy State ---
  const [universities, setUniversities] = useState([]);
  const [cities, setCities] = useState([])
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);

  const [pre, setPre] = useState({
    university_id: "",
    city_id: "",
    college_id: "",
    department_id: "",
    program_id: "",
  });

  // --- UI feedback ---
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  // --- Fetching Logic (Matching Student Import Pattern) ---
  useEffect(() => {
    axios.get("/api/universities/").then(r => setUniversities(r.data));
    axios.get("/api/cities/").then(r => setCities(r.data));
  }, []);

  // When University changes, reset and fetch colleges
  useEffect(() => {
    if (pre.university_id) {
      axios.get(`/api/colleges/?university=${pre.university_id}`).then(r => setColleges(r.data));
    } else {
      setColleges([]);
    }
    setPre(p => ({ ...p, college_id: "", department_id: "", program_id: "" }));
  }, [pre.university_id]);
  if (pre.city_id) {
        const city = cities.find((c: any) => c.bid === pre.city_id);
        if (city) params.append("pre_city_name", city.bname_ar);
      }

  // When College changes, reset and fetch departments
  useEffect(() => {
    if (pre.college_id) {
      axios.get(`/api/departments/?college=${pre.college_id}`).then(r => setDepartments(r.data));
    } else {
      setDepartments([]);
    }
    setPre(p => ({ ...p, department_id: "", program_id: "" }));
  }, [pre.college_id]);

  // When Department changes, reset and fetch programs
  useEffect(() => {
    if (pre.department_id) {
      axios.get(`/api/programs/?department=${pre.department_id}`).then(r => setPrograms(r.data));
    } else {
      setPrograms([]);
    }
    setPre(p => ({ ...p, program_id: "" }));
  }, [pre.department_id]);

  const canCommit = useMemo(() => {
    if (!result) return false;
    return result.valid_rows > 0 && result.invalid_rows === 0;
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      if (!f.name.toLowerCase().endsWith(".xlsx")) {
        setStatusMessage({ text: "الرجاء اختيار ملف بصيغة .xlsx فقط", type: "error" });
        return;
      }
      setFile(f);
      setResult(null);
      setStatusMessage(null);
    }
  };

  const validateFile = async () => {
    if (!file) return;
    setLoading(true);
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("/api/import_projects_validate/", formData, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      setResult(res.data);
      setStatusMessage({ 
        text: res.data.invalid_rows > 0 ? "يوجد أخطاء في الملف ❌" : "الملف صالح للاستيراد ✅", 
        type: res.data.invalid_rows > 0 ? "error" : "success" 
      });
    } catch (err: any) {
      setStatusMessage({ text: "فشل التحقق من الملف", type: "error" });
    } finally { setLoading(false); }
  };

  const commitFile = async () => {
    if (!file) return;
    setLoading(true);
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("/api/import_projects_commit/", formData, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      setResult(res.data);
      setStatusMessage({ text: "تم الاستيراد بنجاح 🎉", type: "success" });
    } catch (err: any) {
      setStatusMessage({ text: "فشل عملية الاستيراد", type: "error" });
    } finally { setLoading(false); }
  };

  const downloadTemplate = async () => {
    try {
      const params = new URLSearchParams();
      
      // Find names from the state arrays to send to backend
      if (pre.university_id) {
        const uni = universities.find((u: any) => u.uid === pre.university_id);
        if (uni) params.append("pre_university_name", uni.uname_ar);
      }
      if (pre.college_id) {
        const coll = colleges.find((c: any) => c.cid === pre.college_id);
        if (coll) params.append("pre_college_name", coll.name_ar);
      }
      if (pre.department_id) {
        const dept = departments.find((d: any) => d.department_id === pre.department_id);
        if (dept) params.append("pre_department_name", dept.name);
      }
      if (pre.program_id) {
        const prog = programs.find((p: any) => p.pid === pre.program_id);
        if (prog) params.append("pre_program_name", prog.p_name);
      }

      const res = await axios.get(`/api/import-projects/template/`, { 
        params: params, 
        responseType: "blob" 
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "projects_template.xlsx");
      document.body.appendChild(link);
      link.click();
      setShowTemplateModal(false);
    } catch (err) { alert("فشل تحميل القالب"); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-right" dir="rtl">
      <div className="max-w-6xl mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors">
              <FiArrowRight />
            </button>
            <h1 className="text-2xl font-black text-slate-800">استيراد المشاريع من Excel</h1>
          </div>
          <button onClick={() => setShowTemplateModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700">
            <FiDownload /> تحميل القالب
          </button>
        </div>

        {/* Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
              <button onClick={() => setShowTemplateModal(false)} className="absolute top-4 left-4 text-slate-400"><FiX size={24} /></button>
              <h2 className="text-xl font-bold mb-2 text-center">تجهيز قالب الاستيراد</h2>
              {/* <p className="text-sm text-slate-500 mb-6 text-center">
                تأكد من تحديد <strong>نوع المشروع</strong> (حكومي، شركات خارجية، أو مقترح) داخل ملف الـ Excel.
              </p> */}
              <p className="text-sm text-slate-500 mb-6 text-center">يمكنك اختيار البيانات مسبقاً لتسهيل تعبئة الملف، أو التحميل مباشرة للحصول على قالب فارغ.</p>
              
              <div className="space-y-4 mb-6 text-right">
                <div>
                  <label className="block text-sm font-bold mb-1">الجامعة (اختياري)</label>
                  <select className="w-full p-2 border rounded-lg bg-white" value={pre.university_id} onChange={e => setPre({...pre, university_id: e.target.value})}>
                    <option value="">-- تخطي أو اختر جامعة --</option>
                    {universities.map((u: any) => <option key={u.uid} value={u.uid}>{u.uname_ar}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">الكلية (اختياري)</label>
                  <select className="w-full p-2 border rounded-lg bg-white" value={pre.college_id} onChange={e => setPre({...pre, college_id: e.target.value})} disabled={!pre.university_id}>
                    <option value="">-- اختر الكلية --</option>
                    {colleges.map((c: any) => <option key={c.cid} value={c.cid}>{c.name_ar}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">القسم (اختياري)</label>
                  <select className="w-full p-2 border rounded-lg bg-white" value={pre.department_id} onChange={e => setPre({...pre, department_id: e.target.value})} disabled={!pre.college_id}>
                    <option value="">-- اختر القسم --</option>
                    {departments.map((d: any) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">البرنامج (اختياري)</label>
                  <select className="w-full p-2 border rounded-lg bg-white" value={pre.program_id} onChange={e => setPre({...pre, program_id: e.target.value})} disabled={!pre.department_id}>
                    <option value="">-- اختر البرنامج --</option>
                    {programs.map((p: any) => <option key={p.pid} value={p.pid}>{p.p_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setShowTemplateModal(false)} className="px-6 py-2 border rounded-xl hover:bg-slate-50 transition-colors">إلغاء</button>
                <button 
                  onClick={downloadTemplate} 
                  className="px-6 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                >
                  تحميل XLSX
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Action Card */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <label className="w-full md:w-auto bg-slate-100 hover:bg-slate-200 px-6 py-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed border-slate-300">
              <FiUploadCloud className="text-blue-600" />
              <span className="font-bold text-slate-700">اختيار ملف Excel</span>
              <input type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
            </label>
            <button onClick={validateFile} disabled={!file || loading} className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-blue-700 transition-all shadow-md">
              {loading && !result ? "جارٍ الفحص..." : "رفع وفحص الملف"}
            </button>
            <button onClick={commitFile} disabled={!canCommit || loading} className="w-full md:w-auto bg-green-600 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 hover:bg-green-700 transition-all shadow-md">
              {loading && result ? "جارٍ الحفظ..." : "تأكيد الاستيراد النهائي"}
            </button>
          </div>
          <div className="mt-4 text-slate-500 italic">
             {file ? <span className="text-blue-700 font-medium">📄 {file.name}</span> : "لم يتم اختيار أي ملف بعد"}
          </div>
          {statusMessage && (
            <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 font-bold border ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {statusMessage.type === 'success' ? <FiCheckCircle /> : <FiAlertTriangle />} {statusMessage.text}
            </div>
          )}
        </div>

        {/* Stats and Errors */}
        {result && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
            <StatCard label="إجمالي الصفوف" value={result.total_rows} color="text-slate-700" />
            <StatCard label="صالحة" value={result.valid_rows} color="text-green-600" />
            <StatCard label="غير صالحة" value={result.invalid_rows} color="text-red-600" />
            <StatCard label="سيتم إنشاؤها" value={result.created_projects ?? "-"} color="text-blue-600" />
            <StatCard label="سيتم تحديثها" value={result.updated_projects ?? "-"} color="text-orange-600" />
          </div>
        )}

        {result?.errors && result.errors.length > 0 && (
          <div className="mt-8 bg-white shadow-sm border border-red-100 rounded-2xl overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-red-100 font-bold text-red-700">تفاصيل الأخطاء</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50"><tr><th className="p-4">الصف</th><th className="p-4">الحقل</th><th className="p-4">الرسالة</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {result.errors.map((err, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 font-bold">{err.row}</td>
                      <td className="p-4">{err.field || "عام"}</td>
                      <td className="p-4 text-red-600">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string; value: any; color: string }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
    <span className="text-xs font-bold text-slate-400 mb-1 uppercase">{label}</span>
    <span className={`text-3xl font-black ${color}`}>{value}</span>
  </div>
);

export default SysManagerImport;