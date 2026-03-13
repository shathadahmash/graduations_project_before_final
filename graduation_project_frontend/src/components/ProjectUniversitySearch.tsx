import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiMapPin, FiBookOpen, FiUser, FiSearch, FiEye, FiArrowLeft } from 'react-icons/fi';
import Navbar from './Navbar';
import { Group, projectService } from '../services/projectService';
import { userService } from '../services/userService';
import ProjectDetailModal from './ProjectDetailModal';

interface Project {
  project_id: number;
  title: string;
  description: string;
  project_type: string;
  state_name: string;
  field: string;
  tools: string;
  university_name: string;
  college_name?: string;
  department_name?: string;
  program_name?: string;
  branch_name?: string;
  start_date?: number;
  end_date?: number;
  external_company?: string;
  supervisor_name: string;
  co_supervisor_name?: string;
  logo?: string;
  documentation?: string;
  groups?: Group[];
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

interface Props {
  universityId: number;
  colleges: { id: number; name: string; university_id?: number }[];
}

const ProjectSearch: React.FC<Props> = ({ universityId, colleges }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    project_university: universityId.toString(),
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
    colleges: colleges || [],
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

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedProjectStudents, setSelectedProjectStudents] = useState<{ name: string; id?: string }[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const removeDuplicatesById = <T extends { id: number }>(items: T[]): T[] => {
    const unique = new Map<number, T>();
    items.forEach(item => { if (!unique.has(item.id)) unique.set(item.id, item); });
    return Array.from(unique.values());
  };

  const fetchFilterOptions = useCallback(async () => {
    try {
      const options = await projectService.getFilterOptions();
      const departments = await userService.getDepartments();
      setFilterOptions(prev => ({
        ...prev,
        departments: removeDuplicatesById(departments || []),
        supervisors: removeDuplicatesById(options.supervisors || []),
        co_supervisors: removeDuplicatesById(options.co_supervisors || []),
        years: Array.from(new Set((options.years || []).map((y: string) => y.toString().substring(0, 4)))).sort((a, b) => parseInt(b) - parseInt(a)),
        fields: Array.from(new Set(options.fields || [])),
        tools: Array.from(new Set(options.tools || []))
      }));
    } catch (err) {
      console.error('خطأ في جلب خيارات الفلاتر', err);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    if (!filters.project_university) {
      setProjects([]);
      return;
    }
    try {
      setLoading(true);
      const params: any = { limit: 50, project_university: Number(filters.project_university) };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (filters.college) params.college = Number(filters.college);
      if (filters.department) params.department = Number(filters.department);
      if (filters.year) params.year = filters.year;
      if (filters.field) params.field = filters.field;
      if (filters.tools) params.tools = filters.tools;
      if (filters.supervisor) params.supervisor = filters.supervisor;
      if (filters.co_supervisor) params.co_supervisor = filters.co_supervisor;
      if (filters.project_type) params.project_type = filters.project_type;

      const response = await projectService.getProjects(params);
      const data = Array.isArray(response) ? response : response?.results || response?.data || [];

      setProjects(data.map((p: any) => ({
        project_id: p.project_id,
        title: p.title,
        description: p.description,
        project_type: p.project_type,
        state_name: p.state_name || p.state?.name || '',
        field: p.field,
        tools: p.tools,
        university_name: p.university_name || p.university?.name || '',
        branch_name: p.branch_name || p.branch?.name || '',
        college_name: p.college_name || p.college?.name || 'لا توجد كلية',
        department_name: p.department?.name,
        program_name: p.program?.p_name || p.program_name,
        start_date: p.start_date,
        end_date: p.end_date,
        external_company: p.external_company?.name,
        supervisor_name: p.supervisor_name || 'لا يوجد مشرف',
        co_supervisor_name: p.co_supervisor_name || 'لا يوجد مشرف مساعد',
        logo: p.logo || '/default-project-logo.png',
        documentation: p.documentation_url || null,
        groups: p.groups || []
      })));
    } catch (err) {
      console.error('خطأ في جلب المشاريع', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery]);

  const handleQuickView = (project: Project) => {
    setSelectedProject(project);
    const students =
      project.groups?.flatMap(g =>
        g.members?.map(m => ({
          name: m.user_detail?.name || `${m.user_detail?.first_name || ''} ${m.user_detail?.last_name || ''}`.trim()
        })) || []
      ) || [];
    setSelectedProjectStudents(students);
  };

  const getProjectTypeBadge = (type: string) => {
    switch (type) {
      case 'Proposed': return { label: 'مقترح', bg: 'bg-purple-100', color: 'text-purple-700' };
      case 'Governmental': return { label: 'حكومي', bg: 'bg-blue-100', color: 'text-blue-700' };
      case 'External': return { label: 'شركات خارجية', bg: 'bg-green-100', color: 'text-green-700' };
      default: return { label: 'غير محدد', bg: 'bg-gray-100', color: 'text-gray-700' };
    }
  };

  const extractYear = (date: number) => date ? new Date(date).getFullYear() : 'غير محدد';
  const getActiveFiltersCount = () => Object.values(filters).filter(v => v).length;
  const clearAllFilters = () => setFilters({ ...filters, college: '', department: '', year: '', field: '', tools: '', supervisor: '', co_supervisor: '', project_type: '' });

  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(fetchProjects, 500);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, filters, fetchProjects]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir="rtl">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-[#31257D] mb-4">البحث عن مشاريع التخرج</h1>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="ابحث في المشاريع..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="border rounded px-3 py-2 flex-1"
          />
          <select value={filters.college} onChange={e => setFilters(f => ({ ...f, college: e.target.value }))}>
            <option value="">الكلية</option>
            {filterOptions.colleges
              .filter(c => c.university_id === Number(filters.project_university))
              .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Projects Results */}
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
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(p => {
              const badge = getProjectTypeBadge(p.project_type);
              return (
                <div key={p.project_id} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-[#31257D]/10 flex flex-col h-full group">
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#31257D]/5 to-[#4937BF]/5">
                    <img src={p.logo?.startsWith('http') ? p.logo : `http://localhost:8001${p.logo}`} alt={p.title} className="w-full h-full object-cover transition-all duration-300" onError={(e) => { e.currentTarget.src = '/default-project-logo.png'; }} />
                    {p.project_type !== 'غير محدد' && (
                      <div className="absolute top-3 right-3">
                        <span className={`${badge.bg} ${badge.color} px-3 py-1 rounded-full text-xs font-bold shadow-lg`}>
                          {badge.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-xl text-[#31257D] mb-3 line-clamp-2 text-right leading-tight">{p.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2 border-r-2 border-[#4937BF] pr-3">{p.description || 'لا يوجد ملخص متاح'}</p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#F8FAFC] p-2 rounded-lg">
                        <div className="flex items-center gap-1 text-[#4937BF] mb-1">
                          <FiMapPin size={14} />
                          <span className="text-xs">الجامعة</span>
                        </div>
                        <p className="font-medium text-[#31257D] text-sm line-clamp-1">{p.university_name}</p>
                      </div>
                      <div className="bg-[#F8FAFC] p-2 rounded-lg">
                        <div className="flex items-center gap-1 text-[#4937BF] mb-1">
                          <FiBookOpen size={14} />
                          <span className="text-xs">الكلية</span>
                        </div>
                        <p className="font-medium text-[#31257D] text-sm line-clamp-1">{p.college_name}</p>
                      </div>
                      <div className="bg-[#F8FAFC] p-2 rounded-lg">
                        <div className="flex items-center gap-1 text-[#4937BF] mb-1">
                          <FiCalendar size={14} />
                          <span className="text-xs">السنة</span>
                        </div>
                        <p className="font-medium text-[#31257D] text-sm">{extractYear(p.start_date)}</p>
                      </div>
                      <div className="bg-[#F8FAFC] p-2 rounded-lg">
                        <div className="flex items-center gap-1 text-[#4937BF] mb-1">
                          <FiUser size={14} />
                          <span className="text-xs">المشرف</span>
                        </div>
                        <p className="font-medium text-[#31257D] text-sm line-clamp-1">{p.supervisor_name}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <button
                        onClick={() => handleQuickView(p)}
                        className="py-2.5 bg-[#31257D] text-white rounded-lg text-sm font-medium hover:bg-[#4937BF] transition-colors flex items-center justify-center gap-1"
                      >
                        <FiEye size={16} /> عرض سريع
                      </button>
                      <Link to={`/projects/${p.project_id}`} className="py-2.5 bg-white text-[#31257D] border-2 border-[#31257D] rounded-lg text-sm font-medium hover:bg-[#31257D] hover:text-white transition-all duration-300 flex items-center justify-center gap-1 group">
                        <span>التفاصيل</span>
                        <FiArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick View Modal */}
        {selectedProject && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => { setSelectedProject(null); setSelectedProjectStudents([]); }}>
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <h2 className="font-bold text-xl mb-4">{selectedProject.title}</h2>
                <p>{selectedProject.description || 'لا يوجد ملخص متاح'}</p>
              </div>
            </div>
          </div>
        )}
        {selectedProject && (
          <ProjectDetailModal
            project={selectedProject}
            students={selectedProjectStudents}
            loadingStudents={loadingStudents}
            onClose={() => {
              setSelectedProject(null);
              setSelectedProjectStudents([]);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProjectSearch;