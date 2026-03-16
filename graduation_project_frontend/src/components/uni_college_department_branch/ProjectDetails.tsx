import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  FiCalendar, FiMapPin, FiBookOpen, FiTool, FiUser, FiUsers, 
  FiX, FiInfo, FiFileText, FiBriefcase, FiTag, FiClock, 
  FiImage, FiDownload, FiLink, FiArrowRight, FiHome,
  FiChevronLeft, FiExternalLink, FiPaperclip, FiLock, FiLoader,
  FiMail, FiPhone, FiHash, FiAward, FiStar, FiShield
} from 'react-icons/fi';
import Navbar from '../Navbar';
import { projectService } from '../../services/projectService';
import api from '../../services/api';

// ** الألوان الأكاديمية - مطابقة لـ SystemManagerDashboard **
const academicColors = {
  primary: '#312583', // البنفسجي الأزرق الداكن
  secondary: '#4a3fa0', // البنفسجي الأزرق الفاتح
  accent: '#5d4db8', // البنفسجي الفاتح
  background: '#ffffff', // خلفية بيضاء
  paper: '#ffffff',
  text: '#1a1a2e',
  textLight: '#4a5568',
  border: '#312583/20',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
  gradient: {
    primary: 'from-[#312583] to-[#4a3fa0]',
    secondary: 'from-[#4a3fa0] to-[#5d4db8]',
    accent: 'from-[#5d4db8] to-[#312583]',
  }
};

interface Student {
  name: string;
  id?: string;
  email?: string;
  phone?: string;
  username?: string;
  gender?: string;
  cid?: string;
}

interface Project {
  project_id: number;
  title: string;
  description: string;
  project_type: string;
  state: string;
  field: string;
  tools: string;
  university_name: string;
  branch_name: string;
  college_name: string;
  department_name?: string;
  program_name?: string;
  start_date: number;
  end_date: number;
  external_company?: string;
  supervisor_name: string;
  co_supervisor_name?: string;
  logo?: string;
  documentation_path?: string | null;
  students?: Student[];
}

const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);

  const API_BASE_URL = 'http://localhost:8001';

  // دالة لجلب رابط الصورة
  const getImageUrl = (imagePath?: string): string => {
    if (!imagePath) return '/default-project-logo.png';
    if (imagePath.startsWith('http')) return imagePath;
    const cleanPath = imagePath.replace(/^\/+/, '');
    return `${API_BASE_URL}/media/${cleanPath}`;
  };

  // دالة لاستخراج اسم الملف من المسار
  const getFileNameFromPath = (filePath: string): string => {
    if (!filePath) return '';
    
    const cleanPath = filePath.split('?')[0];
    const fileName = cleanPath.split('/').pop() || '';
    
    try {
      return decodeURIComponent(fileName);
    } catch {
      return fileName;
    }
  };

  // دالة للتحقق إذا كان النص يحتوي على عربي
  const containsArabic = (text: string): boolean => {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicPattern.test(text);
  };

  // دالة لعرض اسم الملف مع الحفاظ على اتجاه النص
  const renderFileName = (fileName: string) => {
    if (!fileName) return 'ملف التوثيق';
    
    const extension = fileName.split('.').pop() || '';
    const nameWithoutExt = fileName.substring(0, fileName.length - extension.length - 1);
    const hasArabic = containsArabic(nameWithoutExt);
    
    return (
      <div className="flex items-center gap-2">
        <FiFileText className="text-[#4a3fa0]" size={18} />
        <div className={`flex items-center gap-1 ${hasArabic ? 'font-arabic' : 'font-english'}`} dir={hasArabic ? 'rtl' : 'ltr'}>
          <span className="truncate max-w-[200px] text-[#312583]">{nameWithoutExt}</span>
          <span className="text-[#4a3fa0] text-xs">.{extension}</span>
        </div>
      </div>
    );
  };

  // دالة لجلب طلاب المشروع
  const fetchProjectStudents = async (projectId: number) => {
    try {
      setLoadingStudents(true);
      console.log(`🔍 جاري جلب طلاب المشروع رقم: ${projectId}`);
      
      const groups = await projectService.getProjectGroups(projectId);
      
      console.log('📦 البيانات المستلمة من API:', groups);
      
      const studentsMap = new Map();

      if (Array.isArray(groups) && groups.length > 0) {
        const projectGroups = groups.filter((group: any) => 
          group.project === projectId || group.project_id === projectId
        );
        
        console.log(`📊 عدد المجموعات التي تخص المشروع ${projectId}:`, projectGroups.length);
        
        projectGroups.forEach((group: any, groupIndex: number) => {
          console.log(`👥 المجموعة ${groupIndex + 1}:`, group);
          
          if (group.members && Array.isArray(group.members)) {
            console.log(`👤 عدد الأعضاء في المجموعة ${groupIndex + 1}:`, group.members.length);
            
            group.members.forEach((member: any, memberIndex: number) => {
              const user = member.user_detail;
              if (user && user.id) {
                console.log(`👨‍🎓 العضو ${memberIndex + 1}:`, user);
                
                if (!studentsMap.has(user.id)) {
                  studentsMap.set(user.id, {
                    name: user.name || 
                          `${user.first_name || ""} ${user.last_name || ""}`.trim() || 
                          user.username || 
                          "طالب",
                    id: user.id?.toString(),
                    email: user.email || "لا يوجد",
                    phone: user.phone || "لا يوجد",
                    username: user.username || "",
                    gender: user.gender || "",
                    cid: user.CID || "",
                  });
                }
              }
            });
          } else {
            console.log(`⚠️ المجموعة ${groupIndex + 1} لا تحتوي على members`);
          }
        });
      } else {
        console.log('ℹ️ لا توجد مجموعات لهذا المشروع أو البيانات ليست مصفوفة');
      }

      const studentsList = Array.from(studentsMap.values());
      
      console.log(`✅ تم العثور على ${studentsList.length} طالب للمشروع ${projectId}:`, studentsList);
      setStudents(studentsList);
      
      setProject(prev => prev ? { ...prev, students: studentsList } : null);
      
    } catch (error) {
      console.error("❌ خطأ في جلب طلاب المشروع:", error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  // دالة لاستخراج السنة
  const extractYear = (date: number | string): string => {
    if (!date) return 'غير محدد';
    return date.toString().substring(0, 4);
  };

  // دالة لتنسيق التاريخ
  const formatDate = (date: number | string): string => {
    if (!date) return 'غير محدد';
    const dateStr = date.toString();
    if (dateStr.length === 8) {
      return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
    }
    return dateStr;
  };

  // ترجمة نوع المشروع
  const getProjectTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      'Governmental': 'حكومي',
      'External': 'شركات خارجية',
      'Proposed': 'مقترح'
    };
    return types[type] || type;
  };

  // الحصول على ألوان نوع المشروع
  const getProjectTypeColors = (type: string) => {
    const colors: { [key: string]: { bg: string; text: string; border: string; gradient: string } } = {
      'Governmental': { 
        bg: 'bg-[#312583]/10', 
        text: 'text-[#312583]', 
        border: 'border-[#312583]/20',
        gradient: 'from-[#312583] to-[#4a3fa0]'
      },
      'External': { 
        bg: 'bg-[#4a3fa0]/10', 
        text: 'text-[#4a3fa0]', 
        border: 'border-[#4a3fa0]/20',
        gradient: 'from-[#4a3fa0] to-[#5d4db8]'
      },
      'Proposed': { 
        bg: 'bg-[#5d4db8]/10', 
        text: 'text-[#5d4db8]', 
        border: 'border-[#5d4db8]/20',
        gradient: 'from-[#5d4db8] to-[#312583]'
      }
    };
    return colors[type] || { 
      bg: 'bg-gray-100', 
      text: 'text-gray-700', 
      border: 'border-gray-200',
      gradient: 'from-gray-600 to-gray-700'
    };
  };

  // دالة لعرض محتوى التوثيق
  const renderDocumentation = (doc?: string | null) => {
    if (!doc || doc.trim() === '' || doc === 'null' || doc === 'undefined') {
      return (
        <div className="bg-gray-50 p-8 rounded-xl text-center border-2 border-dashed border-[#312583]/20">
          <FiFileText className="mx-auto mb-3 text-[#4a3fa0] opacity-50" size={48} />
          <p className="text-[#312583] font-medium">لا يوجد ملف توثيق لهذا المشروع</p>
          <p className="text-[#4a5568] text-sm mt-1">يمكن للمشرف إضافة ملف لاحقاً</p>
        </div>
      );
    }

    const fileName = getFileNameFromPath(doc);
    const hasArabic = containsArabic(fileName);

    return (
      <div className="bg-gray-50 p-8 rounded-xl border border-[#312583]/20 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[#312583] to-[#4a3fa0] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#312583]/20">
          <FiLock className="text-white" size={32} />
        </div>
        
        <h4 className="text-xl font-bold text-[#312583] mb-3">
          ملف توثيق المشروع
        </h4>
        
        <p className="text-[#4a5568] mb-4 max-w-md mx-auto">
          ملف التوثيق الكامل للمشروع متاح ولكن لا يمكن الوصول إليه حفاظاً على حقوق الملكية الفكرية
        </p>
        
        <div className={`bg-white p-4 rounded-lg border border-[#312583]/20 inline-block mx-auto shadow-sm ${hasArabic ? 'rtl' : 'ltr'}`}>
          {renderFileName(fileName)}
        </div>
        
        <div className="mt-4 text-xs text-[#4a3fa0] flex items-center justify-center gap-1">
          <FiInfo size={14} />
          <span>للاطلاع على ملف التوثيق، يرجى التواصل مع المشرف</span>
        </div>
      </div>
    );
  };

  // دالة عرض تفاصيل الطالب في نافذة منبثقة
  const StudentDetailsModal = () => {
    if (!selectedStudent) return null;

    return (
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all duration-300"
        onClick={() => {
          setSelectedStudent(null);
          setShowStudentModal(false);
        }}
      >
        <div 
          className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 scale-100 animate-fadeIn border border-[#312583]/20"
          onClick={e => e.stopPropagation()}
        >
          {/* رأس النافذة */}
          <div className="bg-gradient-to-l from-[#312583] to-[#4a3fa0] p-5 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <FiUser size={20} />
              <h2 className="text-xl font-bold">تفاصيل الطالب</h2>
            </div>
            <button
              onClick={() => {
                setSelectedStudent(null);
                setShowStudentModal(false);
              }}
              className="hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <FiX size={22} />
            </button>
          </div>

          {/* محتوى النافذة */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-[#312583] to-[#4a3fa0] rounded-full flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-[#312583]/20">
                {selectedStudent.name?.charAt(0) || 'ط'}
              </div>
              <h3 className="text-2xl font-bold text-[#312583]">{selectedStudent.name}</h3>
              {selectedStudent.username && (
                <p className="text-[#4a5568]">@{selectedStudent.username}</p>
              )}
            </div>

            <div className="space-y-4">
              {/* رقم الطالب */}
              {selectedStudent.id && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-[#312583]/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#312583] to-[#4a3fa0] rounded-full flex items-center justify-center shadow-md">
                    <FiHash className="text-white" size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#4a5568]">الرقم الجامعي</p>
                    <p className="font-bold text-[#312583]">{selectedStudent.id}</p>
                  </div>
                </div>
              )}

              {/* البريد الإلكتروني */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-[#312583]/10">
                <div className="w-10 h-10 bg-gradient-to-br from-[#312583] to-[#4a3fa0] rounded-full flex items-center justify-center shadow-md">
                  <FiMail className="text-white" size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-[#4a5568]">البريد الإلكتروني</p>
                  <p className={`font-bold ${selectedStudent.email && selectedStudent.email !== "لا يوجد" ? 'text-[#312583]' : 'text-[#4a5568]'}`}>
                    {selectedStudent.email || "لا يوجد"}
                  </p>
                </div>
              </div>

              {/* رقم الهاتف */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-[#312583]/10">
                <div className="w-10 h-10 bg-gradient-to-br from-[#312583] to-[#4a3fa0] rounded-full flex items-center justify-center shadow-md">
                  <FiPhone className="text-white" size={18} />
                </div>
                <div>
                  <p className="text-xs text-[#4a5568]">رقم الهاتف</p>
                  <p className={`font-bold ${selectedStudent.phone && selectedStudent.phone !== "لا يوجد" ? 'text-[#312583]' : 'text-[#4a5568]'}`}>
                    {selectedStudent.phone || "لا يوجد"}
                  </p>
                </div>
              </div>

              {/* الجنس */}
              {selectedStudent.gender && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-[#312583]/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#312583] to-[#4a3fa0] rounded-full flex items-center justify-center shadow-md">
                    <FiUser className="text-white" size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#4a5568]">الجنس</p>
                    <p className="font-bold text-[#312583]">
                      {selectedStudent.gender === 'Male' ? 'ذكر' : 
                       selectedStudent.gender === 'Female' ? 'أنثى' : 'غير محدد'}
                    </p>
                  </div>
                </div>
              )}

              {/* الرقم الوطني */}
              {selectedStudent.cid && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-[#312583]/10">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#312583] to-[#4a3fa0] rounded-full flex items-center justify-center shadow-md">
                    <FiShield className="text-white" size={18} />
                  </div>
                  <div>
                    <p className="text-xs text-[#4a5568]">الرقم الوطني</p>
                    <p className="font-bold text-[#312583]">{selectedStudent.cid}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // جلب بيانات المشروع
  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        const response = await projectService.getProjectById(Number(id));
        setProject(response);
        
        if (response?.project_id) {
          await fetchProjectStudents(response.project_id);
        }
      } catch (error) {
        console.error('خطأ في جلب بيانات المشروع:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProject();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white font-['Cairo',sans-serif]" dir="rtl">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#312583]/20 border-t-[#312583]"></div>
            <p className="mt-4 text-[#312583] font-medium">جاري تحميل بيانات المشروع...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white font-['Cairo',sans-serif]" dir="rtl">
        <Navbar />
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-[#312583]">المشروع غير موجود</h2>
          <Link to="/projects" className="text-[#4a3fa0] hover:underline mt-4 inline-block">
            العودة إلى قائمة المشاريع
          </Link>
        </div>
      </div>
    );
  }

  const typeColors = getProjectTypeColors(project.project_type);

  return (
    <div className="min-h-screen bg-white font-['Cairo',sans-serif]" dir="rtl">
      <Navbar />
      
      {/* مسار التنقل (Breadcrumb) */}
      <div className="bg-white border-b border-[#312583]/10">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-[#4a5568] hover:text-[#312583] flex items-center gap-1 transition-colors">
              <FiHome size={14} />
              الرئيسية
            </Link>
            <FiChevronLeft className="text-[#4a3fa0]" size={14} />
            <Link to="/projects" className="text-[#4a5568] hover:text-[#312583] transition-colors">
              المشاريع
            </Link>
            <FiChevronLeft className="text-[#4a3fa0]" size={14} />
            <span className="text-[#312583] font-medium truncate">{project.title}</span>
          </div>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* رأس الصفحة */}
        <div className="bg-white rounded-2xl shadow-lg shadow-[#312583]/5 overflow-hidden mb-8 border border-[#312583]/10">
          {/* الشريط العلوي الملون حسب نوع المشروع */}
          <div className={`h-2 bg-gradient-to-r ${typeColors.gradient}`}></div>
          
          <div className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* صورة المشروع */}
              <div className="md:w-64 flex-shrink-0">
                <div className="bg-gray-50 rounded-xl overflow-hidden border-2 border-[#312583]/10 shadow-md">
                  <img
                    src={getImageUrl(project.logo)}
                    alt={project.title}
                    className="w-full h-64 md:h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/default-project-logo.png';
                    }}
                  />
                </div>
              </div>

              {/* معلومات المشروع الأساسية */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${typeColors.bg} ${typeColors.text} border ${typeColors.border}`}>
                    {getProjectTypeLabel(project.project_type)}
                  </span>
                  {project.state && project.state !== 'غير محدد' && (
                    <span className="px-4 py-1.5 bg-[#4a3fa0]/10 text-[#4a3fa0] rounded-full text-sm border border-[#4a3fa0]/20">
                      {project.state}
                    </span>
                  )}
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-[#312583] mb-4 leading-tight">
                  {project.title}
                </h1>

                {/* معلومات سريعة في بطاقات - تظهر هنا سنة البداية والنهاية مرة واحدة فقط */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-[#312583]/10">
                    <FiCalendar className="text-[#4a3fa0] mb-2" size={20} />
                    <p className="text-xs text-[#4a5568]">سنة البداية</p>
                    <p className="font-bold text-[#312583]">{extractYear(project.start_date)}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-xl border border-[#312583]/10">
                    <FiClock className="text-[#4a3fa0] mb-2" size={20} />
                    <p className="text-xs text-[#4a5568]">سنة النهاية</p>
                    <p className="font-bold text-[#312583]">{extractYear(project.end_date)}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-xl border border-[#312583]/10">
                    <FiUser className="text-[#4a3fa0] mb-2" size={20} />
                    <p className="text-xs text-[#4a5568]">المشرف</p>
                    <p className="font-bold text-[#312583] truncate">{project.supervisor_name}</p>
                  </div>
                  
                  {project.co_supervisor_name && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-[#312583]/10">
                      <FiUsers className="text-[#4a3fa0] mb-2" size={20} />
                      <p className="text-xs text-[#4a5568]">مشرف مساعد</p>
                      <p className="font-bold text-[#4a3fa0] truncate">{project.co_supervisor_name}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* شبكة المعلومات التفصيلية */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* العمود الأيمن - معلومات المؤسسة */}
          <div className="lg:col-span-1 space-y-6">
            {/* بطاقة الجامعة والكلية */}
            <div className="bg-white rounded-xl shadow-lg shadow-[#312583]/5 p-6 border border-[#312583]/10">
              <h3 className="text-xl font-bold text-[#312583] mb-4 flex items-center gap-2">
                <FiMapPin className="text-[#4a3fa0]" />
                الموقع الأكاديمي
              </h3>
              
              <div className="space-y-4">
                <div className="border-b border-[#312583]/10 pb-3">
                  <p className="text-sm text-[#4a5568] mb-1">الجامعة</p>
                  <p className="font-bold text-[#312583] text-lg">{project.university_name}</p>
                </div>
                
                <div className="border-b border-[#312583]/10 pb-3">
                  <p className="text-sm text-[#4a5568] mb-1">الكلية</p>
                  <p className="font-bold text-[#312583]">{project.college_name}</p>
                </div>
                
                {project.department_name && (
                  <div className="border-b border-[#312583]/10 pb-3">
                    <p className="text-sm text-[#4a5568] mb-1">القسم</p>
                    <p className="font-bold text-[#312583]">{project.department_name}</p>
                  </div>
                )}
                
                {project.program_name && (
                  <div className="border-b border-[#312583]/10 pb-3">
                    <p className="text-sm text-[#4a5568] mb-1">البرنامج</p>
                    <p className="font-bold text-[#312583]">{project.program_name}</p>
                  </div>
                )}
                
                {project.branch_name && (
                  <div className="border-b border-[#312583]/10 pb-3">
                    <p className="text-sm text-[#4a5568] mb-1">الفرع</p>
                    <p className="font-bold text-[#312583]">{project.branch_name}</p>
                  </div>
                )}
                
                {project.external_company && (
                  <div>
                    <p className="text-sm text-[#4a5568] mb-1">الجهة الخارجية</p>
                    <p className="font-bold text-[#312583]">{project.external_company}</p>
                  </div>
                )}
              </div>
            </div>

            {/* بطاقة المجال والأدوات */}
            <div className="bg-white rounded-xl shadow-lg shadow-[#312583]/5 p-6 border border-[#312583]/10">
              <h3 className="text-xl font-bold text-[#312583] mb-4 flex items-center gap-2">
                <FiBriefcase className="text-[#4a3fa0]" />
                التخصص والأدوات
              </h3>
              
              <div className="space-y-4">
                {project.field && project.field !== 'غير محدد' && (
                  <div>
                    <p className="text-sm text-[#4a5568] mb-2">المجال</p>
                    <div className="bg-gray-50 p-3 rounded-lg border border-[#312583]/10">
                      <p className="text-[#312583] font-medium">{project.field}</p>
                    </div>
                  </div>
                )}
                
                {project.tools && project.tools !== 'غير محدد' && (
                  <div>
                    <p className="text-sm text-[#4a5568] mb-2">الأدوات والتقنيات</p>
                    <div className="flex flex-wrap gap-2">
                      {project.tools.split(',').map((tool, idx) => (
                        <span 
                          key={idx} 
                          className="bg-[#312583]/10 text-[#312583] px-3 py-1.5 rounded-full text-sm border border-[#312583]/20"
                        >
                          {tool.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* زر العودة */}
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 bg-gradient-to-r from-[#312583] to-[#4a3fa0] text-white rounded-xl font-bold hover:shadow-lg hover:shadow-[#312583]/20 transition-all flex items-center justify-center gap-2"
            >
              <FiArrowRight size={18} />
              العودة إلى القائمة
            </button>
          </div>

          {/* العمود الأيسر - ملخص المشروع والطلاب والتوثيق */}
          <div className="lg:col-span-2 space-y-6">
            {/* ملخص المشروع */}
            <div className="bg-white rounded-xl shadow-lg shadow-[#312583]/5 p-6 border border-[#312583]/10">
              <h3 className="text-xl font-bold text-[#312583] mb-4 flex items-center gap-2">
                <FiBookOpen className="text-[#4a3fa0]" />
                ملخص المشروع
              </h3>
              <div className="bg-gray-50 p-6 rounded-lg border border-[#312583]/10">
                <p className="text-[#1a1a2e] leading-relaxed whitespace-pre-line">
                  {project.description || 'لا يوجد ملخص متاح لهذا المشروع'}
                </p>
              </div>
            </div>

            {/* الطلاب المشاركون */}
            <div className="bg-white rounded-xl shadow-lg shadow-[#312583]/5 p-6 border border-[#312583]/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#312583] flex items-center gap-2">
                  <FiUsers className="text-[#4a3fa0]" />
                  الطلاب المشاركون
                </h3>
                {students.length > 0 && (
                  <span className="bg-gradient-to-r from-[#312583] to-[#4a3fa0] text-white text-sm px-3 py-1 rounded-full shadow-md">
                    {students.length}
                  </span>
                )}
                {loadingStudents && (
                  <FiLoader className="animate-spin text-[#4a3fa0]" size={20} />
                )}
              </div>
              
              {loadingStudents ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#312583]/20 border-t-[#312583]"></div>
                  <p className="mt-4 text-[#4a5568]">جاري تحميل الطلاب...</p>
                </div>
              ) : students.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {students.map((student, index) => {
                    const hasEmail = student.email && student.email !== "لا يوجد" && student.email !== "";
                    const hasPhone = student.phone && student.phone !== "لا يوجد" && student.phone !== "";
                    
                    return (
                      <div 
                        key={index} 
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowStudentModal(true);
                        }}
                        className="flex items-center gap-3 p-4 rounded-lg border border-[#312583]/10 bg-gray-50 hover:shadow-md hover:border-[#312583]/30 transition-all cursor-pointer group"
                      >
                        <div className="w-12 h-12 bg-gradient-to-br from-[#312583] to-[#4a3fa0] rounded-full flex items-center justify-center text-white font-bold text-lg group-hover:scale-105 transition-transform shadow-md">
                          {student.name?.charAt(0) || 'ط'}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-[#312583] text-base">{student.name}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            {hasEmail ? (
                              <div className="flex items-center gap-1 text-[#4a5568]">
                                <FiMail size={12} className="text-[#4a3fa0]" />
                                <span className="truncate max-w-[100px]">{student.email}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[#4a5568]">
                                <FiMail size={12} className="text-[#4a5568]" />
                                <span>لا يوجد بريد</span>
                              </div>
                            )}
                            {hasPhone ? (
                              <div className="flex items-center gap-1 text-[#4a5568]">
                                <FiPhone size={12} className="text-[#4a3fa0]" />
                                <span>{student.phone}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[#4a5568]">
                                <FiPhone size={12} className="text-[#4a5568]" />
                                <span>لا يوجد هاتف</span>
                              </div>
                            )}
                          </div>
                          {student.id && (
                            <p className="text-xs text-[#4a5568] mt-1">رقم: {student.id}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-[#312583]/10">
                  <FiUsers className="mx-auto mb-3 text-[#4a3fa0] opacity-50" size={40} />
                  <p className="text-[#312583] font-medium">لا يوجد طلاب مشاركين في هذا المشروع</p>
                  <p className="text-sm text-[#4a5568] mt-1">يمكن إضافة الطلاب لاحقاً</p>
                </div>
              )}
            </div>

            {/* ملف التوثيق */}
            <div className="bg-white rounded-xl shadow-lg shadow-[#312583]/5 p-6 border border-[#312583]/10">
              <h3 className="text-xl font-bold text-[#312583] mb-4 flex items-center gap-2">
                <FiFileText className="text-[#4a3fa0]" />
                ملف التوثيق
              </h3>
              
              {renderDocumentation(project.documentation_path)}
            </div>

            {/* معلومات إضافية - بدون تكرار للتواريخ ✅ */}
            <div className="bg-white rounded-xl shadow-lg shadow-[#312583]/5 p-6 border border-[#312583]/10">
              <h3 className="text-xl font-bold text-[#312583] mb-4 flex items-center gap-2">
                <FiInfo className="text-[#4a3fa0]" />
                معلومات إضافية
              </h3>
              
              {project.external_company ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-[#312583]/10">
                  <p className="text-sm text-[#4a5568] mb-1">الجهة الخارجية</p>
                  <p className="font-bold text-[#312583] text-lg">{project.external_company}</p>
                </div>
              ) : (
                <p className="text-[#4a5568] text-center py-4">لا توجد معلومات إضافية</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* نافذة تفاصيل الطالب */}
      <StudentDetailsModal />

      {/* إضافة تنسيقات إضافية */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .font-arabic {
          font-family: 'Cairo', sans-serif;
        }
        .font-english {
          font-family: 'Poppins', sans-serif;
        }
      `}</style>
    </div>
  );
};

export default ProjectDetails;