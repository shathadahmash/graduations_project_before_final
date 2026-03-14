import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiMapPin, FiBookOpen, FiTool, FiUser, FiUsers, FiX, FiSearch, FiSliders, FiFilter, FiInfo, FiEye, FiFileText, FiBriefcase, FiTag, FiClock, FiImage, FiDownload, FiLink, FiArrowLeft, FiUserCheck, FiLoader } from 'react-icons/fi';
import Navbar from '../Navbar';
import { projectService } from '../../services/projectService';
import { userService } from '../../services/userService';

// تعريف واجهة Member
interface Member {
  user: number;
  user_detail?: {
    id?: number;
    name?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    email?: string;
  };
}

// تعريف واجهة Group
interface Group {
  id?: number;
  group_name?: string;
  members?: Member[];
}

interface Project {
  project_id: number;
  title: string;
  description: string;
  project_type: string;
  state: string;
  state_name?: string;
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
  documentation?: string;
  students?: { name: string; id?: string }[];
  studentsLoading?: boolean;
  groups?: Group[];
}

interface GroupMember {
  user: number;
  user_detail: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    name: string;
    email: string;
    phone: string | null;
    gender: string;
    CID: string | null;
    roles: { role__role_ID: number; role__type: string }[];
    department_id: number | null;
    college_id: number | null;
    staff_profiles: any[];
  };
  group: number;
}

interface FilterOptions {
  universities: { id: number; name: string; logo?: string }[];
  colleges: { id: number; name: string; university_id?: number }[];
  departments: { id: number; name: string; college_id?: number }[];
  supervisors: { id: number; name: string }[];
  co_supervisors: { id: number; name: string }[];
  years: string[];
  fields: string[];
  tools: string[];
  project_types: { value: string; label: string }[];
}

// مكون InfoCard منفصل
const InfoCard: React.FC<{ icon: React.ReactNode; title: string; value: string }> = ({ icon, title, value }) => (
  <div className="flex items-start gap-2 p-3 rounded-lg border bg-gray-50">
    <div className="text-[#31257D] text-lg">{icon}</div>
    <div>
      <span className="text-gray-500 text-xs">{title}</span>
      <div className="text-gray-800 font-medium text-sm">{value}</div>
    </div>
  </div>
);

const ProjectSearch: React.FC = () => {
  const navigate = useNavigate();
  
  // تعريف جميع حالات useState أولاً
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedProjectStudents, setSelectedProjectStudents] = useState<{ name: string; id?: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [filters, setFilters] = useState({
    university: '',
    college: '',
    department: '',
    year: '',
    field: '',
    tools: '',
    supervisor: '',
    co_supervisor: '',
    project_type: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    universities: [],
    colleges: [],
    departments: [],
    supervisors: [],
    co_supervisors: [],
    years: [],
    fields: [],
    tools: [],
    project_types: [
      { value: 'Governmental', label: 'حكومي' },
      { value: 'External', label: 'شركات خارجية' },
      { value: 'Proposed', label: 'مقترح' }
    ]
  });
  const [filteredColleges, setFilteredColleges] = useState<{ id: number; name: string; university_id?: number }[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<{ id: number; name: string; college_id?: number }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // ثابت عنوان API
  const API_BASE_URL = 'http://localhost:8001/api/';

  // دالة لبناء رابط الصورة الكامل
  const getImageUrl = (imagePath?: string): string => {
    if (!imagePath) {
      return '/default-project-logo.png';
    }

    if (imagePath.startsWith('http')) {
      return imagePath;
    }

    const cleanPath = imagePath.replace(/^\/+|\/+$/g, '');
    return `${API_BASE_URL}/media/${cleanPath}`;
  };

  // دالة لجلب طلاب المشروع (مازالت موجودة لكن لن نستخدمها في العرض)
  const fetchProjectStudents = async (projectId: number) => {
    try {
      const response = await projectService.getProjectGroups(projectId);
      const groups = response?.data || response?.results || response || [];
      
      // استخدام Map لتجنب التكرار
      const studentsMap = new Map();

      if (Array.isArray(groups)) {
        groups.forEach((group: any) => {
          if (group.members && Array.isArray(group.members)) {
            group.members.forEach((member: any) => {
              const user = member.user_detail || member.user;
              
              if (user) {
                const userId = user.id || user.user_id;
                const studentName = user.name ||
                  `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                  user.username ||
                  "طالب";
                
                if (userId && !studentsMap.has(userId)) {
                  studentsMap.set(userId, {
                    name: studentName,
                    id: userId?.toString(),
                  });
                } else if (!userId) {
                  const key = studentName + Math.random();
                  studentsMap.set(key, {
                    name: studentName,
                  });
                }
              }
            });
          }
        });
      }

      return Array.from(studentsMap.values());
    } catch (error) {
      console.error("خطأ في جلب طلاب المشروع:", error);
      return [];
    }
  };

  // دالة لفتح نافذة العرض السريع (بدون جلب الطلاب)
  const handleQuickView = async (project: Project) => {
    setSelectedProject(project);
    // لا نقوم بجلب الطلاب
    setSelectedProjectStudents([]);
  };

  // جلب خيارات الفلاتر
  const fetchFilterOptions = useCallback(async () => {
    try {
      const options = await projectService.getFilterOptions();
      const departments = await userService.getDepartments();

      const uniqueColleges = removeDuplicatesByName(options.colleges || []);
      const uniqueDepartments = removeDuplicatesByName(departments || []);
      const uniqueUniversities = removeDuplicatesById(options.universities || []);
      const uniqueSupervisors = removeDuplicatesById(options.supervisors || []);
      const uniqueCoSupervisors = removeDuplicatesById(options.co_supervisors || []);

      const uniqueFields = Array.from(new Set(options.fields || []));
      const uniqueTools = Array.from(new Set(options.tools || []));
      const uniqueYears = Array.from(new Set(
        (options.years || [])
          .map((y: string) => {
            const match = y.match(/\d{4}/);
            return match ? match[0] : y;
          })
      )).sort((a, b) => parseInt(b) - parseInt(a));

      setFilterOptions({
        universities: uniqueUniversities,
        colleges: uniqueColleges,
        departments: uniqueDepartments,
        supervisors: uniqueSupervisors,
        co_supervisors: uniqueCoSupervisors,
        years: uniqueYears,
        fields: uniqueFields,
        tools: uniqueTools,
        project_types: [
          { value: 'Governmental', label: 'حكومي' },
          { value: 'External', label: 'شركات خارجية' },
          { value: 'Proposed', label: 'مقترح' }
        ]
      });

      setFilteredColleges(uniqueColleges);
      setFilteredDepartments(uniqueDepartments);

    } catch (err) {
      console.error('خطأ في جلب خيارات الفلاتر', err);
    }
  }, []);

  // جلب المشاريع
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 50 };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });

      const response = await projectService.getProjects(params);
      const data = Array.isArray(response) ? response : response?.results || response?.data || [];
      
      const processedData = data.map((p: any) => {
        const universityName = p.university?.name || p.university_name || 'غير محدد';
        const branchName = p.branch?.name || p.branch_name || 'غير محدد';
        const collegeName = p.college?.name || p.college_name || 'غير محدد';
        const departmentName = p.department?.name || p.department_name;
        const programName = p.program?.name || p.program_name;
        const stateName = p.state?.name || p.state || 'غير محدد';
        const externalCompanyName = p.external_company?.name || p.external_company;
        const logo = p.logo;

        return {
          project_id: p.project_id || p.id,
          title: p.title || 'بدون عنوان',
          description: p.description || '',
          project_type: p.project_type || 'غير محدد',
          state: stateName,
          state_name: stateName,
          field: p.field || 'غير محدد',
          tools: p.tools || 'غير محدد',
          university_name: universityName,
          branch_name: branchName,
          college_name: collegeName,
          department_name: departmentName,
          program_name: programName,
          start_date: p.start_date,
          end_date: p.end_date,
          external_company: externalCompanyName,
          supervisor_name: p.supervisor_name || 'غير محدد',
          co_supervisor_name: p.co_supervisor_name,
          logo: logo,
          documentation: p.documentation,
          students: [],
          studentsLoading: false,
          groups: p.groups || []
        };
      });

      setProjects(processedData);
      setInitialLoad(false);
    } catch (err) {
      console.error('خطأ في جلب المشاريع', err);
      setProjects([]);
      setInitialLoad(false);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery]);

  // دوال لإزالة التكرار من المصفوفات
  const removeDuplicatesByName = <T extends { id: number; name: string }>(items: T[]): T[] => {
    const uniqueMap = new Map<string, T>();
    items.forEach(item => {
      if (!uniqueMap.has(item.name)) {
        uniqueMap.set(item.name, item);
      }
    });
    return Array.from(uniqueMap.values());
  };

  const removeDuplicatesById = <T extends { id: number }>(items: T[]): T[] => {
    const uniqueMap = new Map<number, T>();
    items.forEach(item => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });
    return Array.from(uniqueMap.values());
  };

  // دالة لاستخراج السنة من التاريخ الرقمي
  const extractYear = (date: number | string): string => {
    if (!date) return 'غير محدد';
    const dateStr = date.toString();
    return dateStr.substring(0, 4);
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

  // الحصول على لون نوع المشروع
  const getProjectTypeBadgeClass = (type: string) => {
    switch (type) {
      case "Governmental":
        return "bg-green-100 text-green-800";
      case "External":
        return "bg-blue-100 text-blue-800";
      case "Proposed":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  useEffect(() => {
    fetchFilterOptions();
    fetchProjects();
  }, [fetchFilterOptions, fetchProjects]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => fetchProjects(), 500);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, filters, fetchProjects]);

  useEffect(() => {
    if (filters.university) {
      const universityId = parseInt(filters.university);

      const cols = filterOptions.colleges.filter(c => c.university_id === universityId);
      const uniqueCols = removeDuplicatesByName(cols);
      setFilteredColleges(uniqueCols.length ? uniqueCols : filterOptions.colleges);

      if (filters.college && !uniqueCols.some(c => c.id === parseInt(filters.college))) {
        setFilters(f => ({ ...f, college: '', department: '' }));
      }
    } else {
      setFilteredColleges(filterOptions.colleges);
    }
  }, [filters.university, filterOptions.colleges]);

  useEffect(() => {
    if (filters.college) {
      const collegeId = parseInt(filters.college);
      const depts = filterOptions.departments.filter(d => d.college_id === collegeId);
      const uniqueDepts = removeDuplicatesByName(depts);
      setFilteredDepartments(uniqueDepts.length ? uniqueDepts : filterOptions.departments);

      if (filters.department && !uniqueDepts.some(d => d.id === parseInt(filters.department))) {
        setFilters(f => ({ ...f, department: '' }));
      }
    } else {
      setFilteredDepartments(filterOptions.departments);
    }
  }, [filters.college, filterOptions.departments]);

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(v => v !== '').length;
  };

  const clearAllFilters = () => {
    setFilters({
      university: '',
      college: '',
      department: '',
      year: '',
      field: '',
      tools: '',
      supervisor: '',
      co_supervisor: '',
      project_type: ''
    });
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Cairo',sans-serif]" dir="rtl">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* عنوان الصفحة */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[#31257D] mb-2">البحث عن مشاريع التخرج</h1>
          <p className="text-[#4A5568]">استعرض مشاريع التخرج والرسائل العلمية في الجامعات اليمنية</p>
        </div>

        {/* شريط البحث والفلاتر */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="ابحث في المشاريع..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 pr-4 pl-10 border border-[#31257D]/10 rounded-lg focus:border-[#31257D] outline-none transition-all"
            />
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4937BF]" size={18} />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
              >
                <FiX size={16} />
              </button>
            )}
          </div>
          <button
            className={`px-4 py-2 rounded-lg border flex items-center gap-2 transition-all ${showFilters
              ? 'bg-[#31257D] text-white border-[#31257D]'
              : 'bg-white text-[#31257D] border-[#31257D]/20 hover:bg-[#31257D]/5'
              }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiSliders />
            فلترة
            {getActiveFiltersCount() > 0 && (
              <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {getActiveFiltersCount()}
              </span>
            )}
          </button>
        </div>

        {/* عرض الفلاتر النشطة */}
        {getActiveFiltersCount() > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 bg-white p-3 rounded-lg border border-[#31257D]/10">
            <span className="text-sm text-[#31257D] font-semibold ml-2">الفلاتر النشطة:</span>
            {Object.entries(filters).map(([key, value]) => {
              if (!value) return null;
              let displayText = '';
              switch (key) {
                case 'university':
                  displayText = filterOptions.universities.find(u => u.id === parseInt(value))?.name || value;
                  break;
                case 'college':
                  displayText = filterOptions.colleges.find(c => c.id === parseInt(value))?.name || value;
                  break;
                case 'department':
                  displayText = filterOptions.departments.find(d => d.id === parseInt(value))?.name || value;
                  break;
                case 'year': displayText = `سنة ${value}`; break;
                case 'field': displayText = `مجال ${value}`; break;
                case 'tools': displayText = `أدوات ${value}`; break;
                case 'supervisor': displayText = `مشرف ${value}`; break;
                case 'co_supervisor': displayText = `مشرف مساعد ${value}`; break;
                case 'project_type':
                  displayText = `نوع: ${filterOptions.project_types.find(t => t.value === value)?.label || value}`;
                  break;
              }
              return (
                <span key={key} className="bg-[#31257D]/10 text-[#31257D] text-xs px-3 py-1 rounded-full flex items-center gap-1">
                  {displayText}
                  <button onClick={() => setFilters(f => ({ ...f, [key]: '' }))} className="hover:text-red-600">
                    <FiX size={12} />
                  </button>
                </span>
              );
            })}
            <button
              onClick={clearAllFilters}
              className="text-red-600 hover:text-red-800 text-xs px-2 py-1 font-semibold"
            >
              مسح الكل
            </button>
          </div>
        )}

        {/* لوحة الفلاتر */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-white p-4 rounded-xl shadow border border-[#31257D]/10">
            <select value={filters.university} onChange={e => setFilters(f => ({ ...f, university: e.target.value }))}>
              <option value="">الجامعة</option>
              {filterOptions.universities.map(u => (
                <option key={`uni-${u.id}`} value={u.id}>{u.name}</option>
              ))}
            </select>

            <select value={filters.college} onChange={e => setFilters(f => ({ ...f, college: e.target.value }))}>
              <option value="">الكلية</option>
              {filteredColleges.map(c => (
                <option key={`col-${c.id}-${c.name}`} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}>
              <option value="">القسم</option>
              {filteredDepartments.map(d => (
                <option key={`dept-${d.id}-${d.name}`} value={d.id}>{d.name}</option>
              ))}
            </select>

            <select value={filters.project_type} onChange={e => setFilters(f => ({ ...f, project_type: e.target.value }))}>
              <option value="">نوع المشروع</option>
              {filterOptions.project_types.map(t => (
                <option key={`type-${t.value}`} value={t.value}>{t.label}</option>
              ))}
            </select>

            <select value={filters.year} onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}>
              <option value="">سنة المشروع</option>
              {filterOptions.years.map((y, i) => (
                <option key={`year-${y}-${i}`} value={y}>{y}</option>
              ))}
            </select>

            <select value={filters.field} onChange={e => setFilters(f => ({ ...f, field: e.target.value }))}>
              <option value="">المجال</option>
              {filterOptions.fields.map((f, i) => (
                <option key={`field-${f}-${i}`} value={f}>{f}</option>
              ))}
            </select>

            <select value={filters.tools} onChange={e => setFilters(f => ({ ...f, tools: e.target.value }))}>
              <option value="">الأدوات</option>
              {filterOptions.tools.map((t, i) => (
                <option key={`tool-${t}-${i}`} value={t}>{t}</option>
              ))}
            </select>

            <select value={filters.supervisor} onChange={e => setFilters(f => ({ ...f, supervisor: e.target.value }))}>
              <option value="">المشرف</option>
              {filterOptions.supervisors.map(s => (
                <option key={`sup-${s.id}`} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select value={filters.co_supervisor} onChange={e => setFilters(f => ({ ...f, co_supervisor: e.target.value }))}>
              <option value="">المشرف المساعد</option>
              {filterOptions.co_supervisors.map(s => (
                <option key={`cosup-${s.id}`} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* نتائج المشاريع */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#31257D]"></div>
            <p className="mt-4 text-[#4A5568]">جاري تحميل المشاريع...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-[#31257D]/5">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-[#31257D]/10 rounded-full flex items-center justify-center">
                <FiSearch className="text-[#31257D]" size={32} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-[#31257D] mb-2">لا توجد مشاريع مطابقة</h3>
            <p className="text-[#4A5568] mb-4 max-w-md mx-auto">
              لم نتمكن من العثور على أي مشاريع تطابق معايير البحث الخاصة بك.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-[#4A5568] flex items-center justify-between">
              <span>
                تم العثور على <span className="font-bold text-[#31257D]">{projects.length}</span> مشروع
              </span>
              {(searchQuery || getActiveFiltersCount() > 0) && (
                <button
                  onClick={clearAllFilters}
                  className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                >
                  <FiX size={14} />
                  إعادة تعيين
                </button>
              )}
            </div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {projects.map(p => {
                const badgeClass = getProjectTypeBadgeClass(p.project_type);
                const badgeLabel = getProjectTypeLabel(p.project_type);
                
                return (
                  <div
                    key={p.project_id}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-[#31257D]/10 flex flex-col h-full group"
                  >
                    {/* صورة المشروع */}
                    <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#31257D]/5 to-[#4937BF]/5">
                      {p.logo ? (
                        <img
                          src={getImageUrl(p.logo)}
                          alt={p.title}
                          className="w-full h-full object-cover transition-all duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/default-project-logo.png';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                          <FiImage size={40} className="mb-2" />
                          <span className="text-xs">لا توجد صورة</span>
                        </div>
                      )}

                      {p.project_type !== 'غير محدد' && (
                        <div className="absolute top-3 right-3">
                          <span className={`${badgeClass} px-3 py-1 rounded-full text-xs font-bold shadow-lg`}>
                            {badgeLabel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* محتوى البطاقة */}
                    <div className="p-5 flex-1 flex flex-col">
                      {/* عنوان المشروع */}
                      <h3 className="font-bold text-xl text-[#31257D] mb-3 line-clamp-2 text-right leading-tight">
                        {p.title}
                      </h3>

                      {/* ملخص المشروع */}
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2 border-r-2 border-[#4937BF] pr-3">
                        {p.description || 'لا يوجد ملخص متاح'}
                      </p>

                      {/* المعلومات الأساسية */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {/* الجامعة */}
                        <div className="bg-[#F8FAFC] p-2 rounded-lg">
                          <div className="flex items-center gap-1 text-[#4937BF] mb-1">
                            <FiMapPin size={14} />
                            <span className="text-xs">الجامعة</span>
                          </div>
                          <p className="font-medium text-[#31257D] text-sm line-clamp-1">{p.university_name}</p>
                        </div>

                        {/* الكلية */}
                        <div className="bg-[#F8FAFC] p-2 rounded-lg">
                          <div className="flex items-center gap-1 text-[#4937BF] mb-1">
                            <FiBookOpen size={14} />
                            <span className="text-xs">الكلية</span>
                          </div>
                          <p className="font-medium text-[#31257D] text-sm line-clamp-1">{p.college_name}</p>
                        </div>

                        {/* السنة */}
                        <div className="bg-[#F8FAFC] p-2 rounded-lg">
                          <div className="flex items-center gap-1 text-[#4937BF] mb-1">
                            <FiCalendar size={14} />
                            <span className="text-xs">السنة</span>
                          </div>
                          <p className="font-medium text-[#31257D] text-sm">
                            {extractYear(p.start_date)}
                          </p>
                        </div>

                        {/* المشرف */}
                        <div className="bg-[#F8FAFC] p-2 rounded-lg">
                          <div className="flex items-center gap-1 text-[#4937BF] mb-1">
                            <FiUser size={14} />
                            <span className="text-xs">المشرف</span>
                          </div>
                          <p className="font-medium text-[#31257D] text-sm line-clamp-1">{p.supervisor_name}</p>
                        </div>
                      </div>

                      {/* زرين - عرض سريع وتفاصيل كاملة */}
                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <button
                          onClick={() => handleQuickView(p)}
                          className="py-2.5 bg-[#31257D] text-white rounded-lg text-sm font-medium hover:bg-[#4937BF] transition-colors flex items-center justify-center gap-1"
                        >
                          <FiEye size={16} />
                          عرض سريع
                        </button>

                        <Link
                          to={`/projects/${p.project_id}`}
                          className="py-2.5 bg-white text-[#31257D] border-2 border-[#31257D] rounded-lg text-sm font-medium hover:bg-[#31257D] hover:text-white transition-all duration-300 flex items-center justify-center gap-1 group"
                        >
                          <span>التفاصيل</span>
                          <FiArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* نافذة العرض السريع المنبثقة - بدون الطلاب المشاركون */}
        {selectedProject && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => {
              setSelectedProject(null);
              setSelectedProjectStudents([]);
            }}
          >
            <div
              className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden relative border border-gray-200"
              onClick={e => e.stopPropagation()}
            >
              {/* زر الإغلاق */}
              <button
                onClick={() => {
                  setSelectedProject(null);
                  setSelectedProjectStudents([]);
                }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10"
              >
                <FiX size={24} />
              </button>
              

              <div className="p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                {/* Header مع الصورة والعنوان */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <img
                    src={getImageUrl(selectedProject.logo)}
                    alt={selectedProject.title}
                    className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-xl border"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/default-project-logo.png";
                    }}
                  />

                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-[#31257D]">
                      {selectedProject.title}
                    </h2>

                    <div className="mt-2 flex gap-2 flex-wrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${getProjectTypeBadgeClass(
                          selectedProject.project_type
                        )}`}
                      >
                        {getProjectTypeLabel(selectedProject.project_type)}
                      </span>

                      <span className="px-2 py-1 rounded-full text-xs bg-gray-200">
                        {selectedProject.state_name || selectedProject.state || "غير محدد"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* الوصف */}
                <div className="bg-gray-50 p-4 rounded-lg text-gray-700 text-sm">
                  {selectedProject.description || "لا يوجد ملخص متاح"}
                </div>

                {/* بطاقات المعلومات - بتصميم InfoCard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <InfoCard icon={<FiMapPin />} title="الجامعة" value={selectedProject.university_name || "غير محدد"} />
                  <InfoCard icon={<FiBookOpen />} title="الكلية" value={selectedProject.college_name || "غير محدد"} />
                  <InfoCard icon={<FiBookOpen />} title="القسم" value={selectedProject.department_name || "غير محدد"} />
                  {selectedProject.program_name && (
                    <InfoCard icon={<FiBookOpen />} title="البرنامج" value={selectedProject.program_name} />
                  )}
                  <InfoCard icon={<FiBookOpen />} title="الفرع" value={selectedProject.branch_name || "غير محدد"} />
                  <InfoCard
                    icon={<FiCalendar />}
                    title="المدة"
                    value={`${extractYear(selectedProject.start_date)} - ${extractYear(selectedProject.end_date)}`}
                  />
                  <InfoCard icon={<FiUser />} title="المشرف" value={selectedProject.supervisor_name || "غير محدد"} />
                  {selectedProject.co_supervisor_name && (
                    <InfoCard icon={<FiUser />} title="مشرف مساعد" value={selectedProject.co_supervisor_name} />
                  )}
                  {selectedProject.external_company && (
                    <InfoCard icon={<FiTool />} title="الشركة" value={selectedProject.external_company} />
                  )}
                  <InfoCard icon={<FiTool />} title="الأدوات" value={selectedProject.tools || "غير محدد"} />
                  <InfoCard icon={<FiUsers />} title="المجال" value={selectedProject.field || "غير محدد"} />
                </div>

                {/* تم إزالة قسم الطلاب المشاركون */}

                {/* رابط المستندات */}
                {selectedProject.documentation && (
                  <a
                    href={selectedProject.documentation.startsWith('http') 
                      ? selectedProject.documentation 
                      : `${API_BASE_URL}${selectedProject.documentation}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline"
                  >
                    <FiFileText />
                    عرض المستندات / الملفات
                  </a>
                )}

                {/* زر التفاصيل الكاملة */}
                <button
                  onClick={() => {
                    navigate(`/projectdetail/${selectedProject.project_id}`, { state: { project: selectedProject } });
                    setSelectedProject(null);
                    setSelectedProjectStudents([]);
                  }}
                  className="mt-6 w-full bg-gradient-to-r from-[#31257D] to-[#4937BF] text-white py-2.5 rounded-lg font-semibold hover:scale-105 transition-all"
                >
                  عرض التفاصيل الكاملة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* إضافة حركة الظهور */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .line-clamp-1 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 1;
        }
        .line-clamp-2 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }
        .line-clamp-3 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
      `}</style>
    </div>
  );
};

export default ProjectSearch;