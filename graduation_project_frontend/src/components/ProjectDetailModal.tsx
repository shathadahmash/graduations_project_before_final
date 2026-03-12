import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectDetails from "../components/uni_college_department_branch/ProjectDetails";
import {
  FiX,
  FiCalendar,
  FiMapPin,
  FiBookOpen,
  FiUser,
  FiUsers,
  FiTool,
  FiFileText,
} from 'react-icons/fi';

interface Student {
  name: string;
  id?: string;
}

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
  students?: Student[];
}

interface Props {
  project: Project;
  students: Student[];
  loadingStudents?: boolean;
  onClose: () => void;
}

const ProjectDetailModal: React.FC<Props> = ({ project, students, loadingStudents, onClose }) => {
  const navigate = useNavigate();
  const extractYear = (year?: number) => (year ? year : 'غير محدد');

  const getProjectTypeBadge = (type: string) => {
    switch (type) {
      case 'Governmental':
        return 'bg-green-100 text-green-800';
      case 'External':
        return 'bg-blue-100 text-blue-800';
      case 'Proposed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden relative border border-gray-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <FiX size={24} />
        </button>

        <div className="p-6 space-y-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <img
              src={project.logo?.startsWith('http') ? project.logo : `http://localhost:8001${project.logo}`}
              alt={project.title}
              className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-xl border border-gray-200 shadow-sm"
              onError={e => { (e.currentTarget as HTMLImageElement).src = '/default-project-logo.png'; }}
            />
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#31257D]">{project.title}</h2>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getProjectTypeBadge(project.project_type)}`}>
                  {project.project_type || 'غير محدد'}
                </span>
                {project.state_name && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-800">
                    {project.state_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-50 p-4 rounded-lg shadow-inner max-h-36 overflow-y-auto text-gray-700 text-sm">
            {project.description || 'لا يوجد ملخص متاح'}
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
            <InfoCard icon={<FiMapPin />} title="الجامعة" value={project.university_name || 'غير محدد'} />
            <InfoCard icon={<FiBookOpen />} title="الكلية" value={project.college_name || 'غير محدد'} />
            <InfoCard icon={<FiBookOpen />} title="القسم" value={project.department_name || 'غير محدد'} />
            <InfoCard icon={<FiBookOpen />} title="البرنامج" value={project.program_name || 'غير محدد'} />
            <InfoCard icon={<FiBookOpen />} title="الفرع" value={project.branch_name || 'غير محدد'} />
            <InfoCard icon={<FiCalendar />} title="السنة" value={`${extractYear(project.start_date)} - ${extractYear(project.end_date)}`} />
            <InfoCard icon={<FiUser />} title="المشرف" value={project.supervisor_name || 'غير محدد'} />
            <InfoCard icon={<FiUser />} title="مشرف مساعد" value={project.co_supervisor_name || 'غير محدد'} />
            {project.project_type === 'External' && project.external_company && (
              <InfoCard icon={<FiTool />} title="الشركة" value={project.external_company} />
            )}
            <InfoCard icon={<FiTool />} title="الأدوات" value={project.tools || 'غير محدد'} />
            <InfoCard icon={<FiUsers />} title="المجال" value={project.field || 'غير محدد'} />
          </div>

          {/* Students */}
          <div>
            <h3 className="text-lg font-bold text-[#31257D] mb-2">الطلاب المشاركون</h3>
            {loadingStudents ? (
              <p>جاري تحميل الطلاب...</p>
            ) : students.length === 0 ? (
              <p>لا يوجد طلاب مشاركين</p>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {students.map((s, idx) => (
                  <li key={idx}>{s.name}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Documentation */}
          {project.documentation && (
            <div className="mt-4">
              <a
                href={project.documentation}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline font-medium"
              >
                <FiFileText /> عرض المستندات / الملفات
              </a>
            </div>
          )}

          {/* ✅ See More Details Button */}
          <button
            onClick={() => {
              navigate(`/projectdetail/${project.project_id}`, { state: { project } });
              onClose(); // close the modal
            }}
            className="mt-6 w-full bg-gradient-to-r from-[#31257D] to-[#4937BF] text-white py-2.5 rounded-lg font-semibold hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            عرض التفاصيل الكاملة
          </button>
        </div>
      </div>
    </div>
  );
};

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon, title, value }) => (
  <div className="flex items-start gap-2 p-3 rounded-lg shadow-sm border border-gray-200 bg-gray-50 hover:shadow-md transition-all">
    <div className="text-[#31257D] text-lg">{icon}</div>
    <div className="flex flex-col">
      <span className="text-gray-500 text-xs">{title}</span>
      <span className="text-gray-800 font-medium text-sm">{value}</span>
    </div>
  </div>
);

export default ProjectDetailModal;