import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useStore';

import HomePage from './Pages/HomePage';
import LoginPage from './Pages/LoginPage';
import DashboardRouter from './components/DashboardRouter';
import ProjectSearch from './components/uni_college_department_branch/ProjectSearch';
import UniversityDetails from "./components/UniversityDetails";

// Pages
import SysManagerImport from "./Pages/dashboards/SystemManager/sysManagerImport";
import ProjectDetails from './components/uni_college_department_branch/ProjectDetails';
import ProjectDetailModal from './components/ProjectDetailModal';
import ProjectCollegeSearch from './components/ProjectCollegeSearch';
import ProjectUniversitySearch from './components/ProjectUniversitySearch';
import ProjectDepartmentSearch from './components/ProjectDepartmentSearch';
import ProjectProgramSearch from './components/ProjectProgramSearch';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* System Manager Import */}
        <Route
          path="/dashboard/system-manager/import-users"
          element={
            <ProtectedRoute>
              <SysManagerImport />
            </ProtectedRoute>
          }
        />

        {/* Protected Dashboard */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardRouter />
            </ProtectedRoute>
          }
        />

        {/* Project Routes */}
        <Route path="/ProjectSearch" element={<ProjectSearch />} />
        <Route path="/projects/:id" element={<ProjectDetails />} />
        <Route path="/projectdetail" element={<ProjectDetails />} />
        <Route path="/projectdetail/:id" element={<ProjectDetails />} />
        <Route path="/ProjectCollegeSearch/:collegeId" element={<ProjectCollegeSearch/>} />

        {/* Project Search Variants */}
        <Route path="/ProjectUniversitySearch" element={<ProjectUniversitySearch />} />
        <Route path="/ProjectCollegeSearch" element={<ProjectCollegeSearch />} />
        <Route path="/ProjectDepartmentSearch" element={<ProjectDepartmentSearch />} />
        <Route path="/ProjectProgramSearch" element={<ProjectProgramSearch />} />

        {/* University Details */}
        <Route path="/university/:id" element={<UniversityDetails />} />

        {/* Fallback */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;