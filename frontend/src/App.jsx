import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { request, checkApiHealth } from './api.js';
import {
  IconGraduationCap,
  IconDashboard,
  IconUsers,
  IconBuilding,
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconDownload,
  IconTable,
  IconGrid,
  IconX,
  IconCheck,
  IconAlert,
  IconEye,
  IconMail,
  IconPhone,
  IconSun,
  IconMoon,
  IconSortAsc,
  IconSortDesc,
  IconArrowUpDown,
  IconRefresh
} from './components/Icons.jsx';
import { getInitials, getAvatarColor, exportStudentsToCsv } from './utils/avatar.js';

const emptyStudent = {
  studentId: '',
  name: '',
  email: '',
  department: '',
  section: '',
  semester: '',
  contact: ''
};

export default function App() {
  const [page, setPage] = useState('overview');
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(null);

  // Filters & Views
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Modals & Forms
  const [form, setForm] = useState(null);
  const [profileModal, setProfileModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('campusdesk_theme') || 'dark');

  // Toasts
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('campusdesk_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([request('/api/students'), request('/api/departments')]);
      setStudents(s.data || []);
      setDepartments(d.data || []);
      setApiOnline(true);
    } catch (e) {
      setApiOnline(false);
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      const online = await checkApiHealth();
      setApiOnline(online);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) {
        setForm(null);
        setProfileModal(null);
        setDeleteConfirm(null);
      }
      if (e.key === '/' && !form && !profileModal && !deleteConfirm) {
        const searchInput = document.getElementById('student-search-input');
        if (searchInput && document.activeElement !== searchInput) {
          e.preventDefault();
          setPage('students');
          setTimeout(() => searchInput.focus(), 50);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, form, profileModal, deleteConfirm]);

  // Department student counts
  const deptCounts = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      const id = s.department?._id;
      if (id) map[id] = (map[id] || 0) + 1;
    });
    return map;
  }, [students]);

  // Sort & Filter visible students
  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = students.filter((s) => {
      const matchDept = !deptFilter || s.department?._id === deptFilter;
      const matchSem = !semesterFilter || String(s.semester) === semesterFilter;
      const matchQuery =
        !q ||
        [s.studentId, s.name, s.email, s.department?.name, s.section, s.contact]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      return matchDept && matchSem && matchQuery;
    });

    list.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === 'studentId') {
        valA = a.studentId.toLowerCase();
        valB = b.studentId.toLowerCase();
      } else if (sortField === 'department') {
        valA = (a.department?.name || '').toLowerCase();
        valB = (b.department?.name || '').toLowerCase();
      } else if (sortField === 'semester') {
        valA = Number(a.semester) || 0;
        valB = Number(b.semester) || 0;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      } else if (sortField === 'section') {
        valA = (a.section || '').toLowerCase();
        valB = (b.section || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [students, query, deptFilter, semesterFilter, sortField, sortOrder]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Form open handlers
  const openStudent = (student = null) => {
    setForm({
      type: 'student',
      student,
      formError: '',
      values: student
        ? {
            studentId: student.studentId,
            name: student.name,
            email: student.email,
            department: student.department?._id || '',
            section: student.section,
            semester: String(student.semester),
            contact: student.contact || ''
          }
        : {
            ...emptyStudent,
            department: deptFilter || departments[0]?._id || ''
          }
    });
  };

  const openDepartment = (department = null) => {
    setForm({
      type: 'department',
      department,
      formError: '',
      values: {
        name: department?.name || '',
        sections: department ? department.sections.join(', ') : ''
      }
    });
  };

  const setField = (key, value, extra = {}) => {
    setForm((f) => ({ ...f, values: { ...f.values, [key]: value, ...extra } }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { type, student, department, values } = form;
      if (type === 'student') {
        const path = student ? `/api/students/${encodeURIComponent(student.studentId)}` : '/api/students';
        await request(path, {
          method: student ? 'PUT' : 'POST',
          body: JSON.stringify({ ...values, semester: Number(values.semester) })
        });
        addToast(student ? `Updated student ${values.name}` : `Added student ${values.name}`, 'success');
      } else {
        const sections = [...new Set(values.sections.split(',').map((s) => s.trim()).filter(Boolean))];
        await request(department ? `/api/departments/${department._id}` : '/api/departments', {
          method: department ? 'PUT' : 'POST',
          body: JSON.stringify({ name: values.name, sections })
        });
        addToast(department ? `Updated department ${values.name}` : `Created department ${values.name}`, 'success');
      }
      setForm(null);
      await loadData();
    } catch (err) {
      setForm((f) => ({ ...f, formError: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { kind, item } = deleteConfirm;
    setSaving(true);
    try {
      await request(
        kind === 'student' ? `/api/students/${encodeURIComponent(item.studentId)}` : `/api/departments/${item._id}`,
        { method: 'DELETE' }
      );
      addToast(`Deleted ${item.name}`, 'success');
      setDeleteConfirm(null);
      if (profileModal && profileModal.studentId === item.studentId) {
        setProfileModal(null);
      }
      await loadData();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Metrics calculation
  const totalSections = departments.reduce((acc, d) => acc + d.sections.length, 0);
  const enrolledSemestersCount = new Set(students.map((s) => s.semester)).size;
  const formSections = departments.find((d) => d._id === form?.values?.department)?.sections || [];

  // Palette colors for departments
  const deptColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];

  return (
    <div className="app-wrapper">
      {/* Top Navigation */}
      <header className="top-nav">
        <div className="nav-container">
          <div className="brand-group">
            <div className="brand-logo">
              <IconGraduationCap size={22} />
            </div>
            <div className="brand-text">
              <span className="brand-name">
                CampusDesk <span className="brand-badge">v2.0</span>
              </span>
            </div>
          </div>

          <nav className="nav-tabs" aria-label="Main Navigation">
            <button
              className={`nav-tab-btn ${page === 'overview' ? 'active' : ''}`}
              onClick={() => setPage('overview')}
            >
              <IconDashboard size={15} /> Overview
            </button>
            <button
              className={`nav-tab-btn ${page === 'students' ? 'active' : ''}`}
              onClick={() => setPage('students')}
            >
              <IconUsers size={15} /> Students
              <span className="nav-tab-counter">{students.length}</span>
            </button>
            <button
              className={`nav-tab-btn ${page === 'departments' ? 'active' : ''}`}
              onClick={() => setPage('departments')}
            >
              <IconBuilding size={15} /> Departments
              <span className="nav-tab-counter">{departments.length}</span>
            </button>
          </nav>

          <div className="nav-controls">
            <div
              className="status-pill"
              title={apiOnline ? 'REST API is healthy and reachable' : 'Unable to connect to REST API'}
            >
              <span className={`status-dot ${apiOnline ? 'online' : 'offline'}`} />
              <span>{apiOnline ? 'API Active' : 'Offline'}</span>
            </div>

            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>

            <button
              className="btn primary sm"
              onClick={() => openStudent()}
              disabled={!departments.length}
            >
              <IconPlus size={15} /> Add Student
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="content-area">
        {/* OVERVIEW TAB */}
        {page === 'overview' && (
          <div className="view-container">
            <div className="page-header">
              <div className="page-header-titles">
                <h1>Academic Dashboard</h1>
                <p>Real-time campus enrollment, department distribution, and student analytics</p>
              </div>
              <div className="header-actions">
                <button
                  className="btn"
                  onClick={() => exportStudentsToCsv(students)}
                  disabled={!students.length}
                >
                  <IconDownload size={15} /> Export CSV
                </button>
                <button
                  className="btn primary"
                  onClick={() => openStudent()}
                  disabled={!departments.length}
                >
                  <IconPlus size={16} /> New Student
                </button>
              </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-title">Total Enrolled</span>
                  <div className="stat-icon">
                    <IconUsers size={18} />
                  </div>
                </div>
                <div className="stat-value">{students.length}</div>
                <div className="stat-footer">
                  <span>Registered students</span>
                  <span className="stat-pill success">Active</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-title">Departments</span>
                  <div className="stat-icon">
                    <IconBuilding size={18} />
                  </div>
                </div>
                <div className="stat-value">{departments.length}</div>
                <div className="stat-footer">
                  <span>Academic units</span>
                  <span className="stat-pill info">{totalSections} sections</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-title">Class Sections</span>
                  <div className="stat-icon">
                    <IconDashboard size={18} />
                  </div>
                </div>
                <div className="stat-value">{totalSections}</div>
                <div className="stat-footer">
                  <span>Across departments</span>
                  <span className="stat-pill info">Active</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-header">
                  <span className="stat-title">Active Semesters</span>
                  <div className="stat-icon">
                    <IconGraduationCap size={18} />
                  </div>
                </div>
                <div className="stat-value">{enrolledSemestersCount}</div>
                <div className="stat-footer">
                  <span>Semesters 1 – 12</span>
                  <span className="stat-pill success">In Session</span>
                </div>
              </div>
            </div>

            {/* Analytics & Quick Actions Section */}
            <div className="analytics-section">
              <div className="analytics-card">
                <h2>
                  Department Enrollment Breakdown
                  <span className="stat-pill info">{departments.length} Departments</span>
                </h2>

                {students.length > 0 ? (
                  <>
                    <div className="dept-bar-track" aria-label="Department distribution">
                      {departments.map((dept, index) => {
                        const count = deptCounts[dept._id] || 0;
                        const pct = (count / students.length) * 100;
                        if (pct === 0) return null;
                        const color = deptColors[index % deptColors.length];
                        return (
                          <div
                            key={dept._id}
                            className="dept-bar-segment"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                            title={`${dept.name}: ${count} students (${pct.toFixed(1)}%)`}
                          />
                        );
                      })}
                    </div>

                    <div className="dept-legend-list">
                      {departments.map((dept, index) => {
                        const count = deptCounts[dept._id] || 0;
                        const pct = students.length ? ((count / students.length) * 100).toFixed(0) : 0;
                        const color = deptColors[index % deptColors.length];
                        return (
                          <div key={dept._id} className="dept-legend-item">
                            <span className="dept-legend-color" style={{ backgroundColor: color }} />
                            <span className="dept-legend-name">{dept.name}</span>
                            <span className="dept-legend-count">
                              {count} <span style={{ opacity: 0.6, fontSize: '11px' }}>({pct}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', padding: '16px 0' }}>
                    No enrollment data yet. Add students to see distribution analytics.
                  </p>
                )}
              </div>

              {/* Semester Cohort Distribution Container */}
              <div className="analytics-card">
                <h2>
                  Semester Cohort Distribution
                  <span className="stat-pill success">{enrolledSemestersCount} Active</span>
                </h2>

                {students.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="dept-bar-track" aria-label="Semester cohort distribution">
                      {Array.from(new Set(students.map((s) => s.semester)))
                        .sort((a, b) => Number(a) - Number(b))
                        .map((sem, index) => {
                          const count = students.filter((s) => s.semester === sem).length;
                          const pct = (count / students.length) * 100;
                          const colors = ['#06b6d4', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];
                          return (
                            <div
                              key={sem}
                              className="dept-bar-segment"
                              style={{ width: `${pct}%`, backgroundColor: colors[index % colors.length] }}
                              title={`Semester ${sem}: ${count} students (${pct.toFixed(1)}%)`}
                            />
                          );
                        })}
                    </div>

                    <div
                      className="dept-legend-list"
                      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}
                    >
                      {Array.from(new Set(students.map((s) => s.semester)))
                        .sort((a, b) => Number(a) - Number(b))
                        .map((sem, index) => {
                          const count = students.filter((s) => s.semester === sem).length;
                          const pct = students.length ? ((count / students.length) * 100).toFixed(0) : 0;
                          const colors = ['#06b6d4', '#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];
                          return (
                            <div key={sem} className="dept-legend-item">
                              <span
                                className="dept-legend-color"
                                style={{ backgroundColor: colors[index % colors.length] }}
                              />
                              <span className="dept-legend-name">Sem {sem}</span>
                              <span className="dept-legend-count">
                                {count} <span style={{ opacity: 0.6, fontSize: '11px' }}>({pct}%)</span>
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', padding: '16px 0' }}>
                    No student records yet. Enroll students to track semester progression.
                  </p>
                )}
              </div>

              <div className="analytics-card">
                <h2>Quick Actions</h2>
                <div className="quick-actions-box">
                  <button
                    className="quick-action-btn"
                    onClick={() => openStudent()}
                    disabled={!departments.length}
                  >
                    <div className="quick-action-icon">
                      <IconPlus size={16} />
                    </div>
                    <span>Register New Student</span>
                  </button>

                  <button className="quick-action-btn" onClick={() => openDepartment()}>
                    <div className="quick-action-icon">
                      <IconBuilding size={16} />
                    </div>
                    <span>Create Department</span>
                  </button>

                  <button
                    className="quick-action-btn"
                    onClick={() => exportStudentsToCsv(students)}
                    disabled={!students.length}
                  >
                    <div className="quick-action-icon">
                      <IconDownload size={16} />
                    </div>
                    <span>Download Roster CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Students Preview */}
            <div style={{ marginTop: '32px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px'
                }}
              >
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-strong)' }}>
                  Recent Student Registrations
                </h2>
                {students.length > 5 && (
                  <button className="btn subtle sm" onClick={() => setPage('students')}>
                    View all {students.length} students &rarr;
                  </button>
                )}
              </div>

              {students.length ? (
                <div className="table-card">
                  <StudentTable
                    rows={students.slice(0, 5)}
                    onView={(s) => setProfileModal(s)}
                    onEdit={(s) => openStudent(s)}
                    onDelete={(s) => setDeleteConfirm({ kind: 'student', item: s })}
                  />
                </div>
              ) : (
                <EmptyState
                  title="No Students Registered"
                  description="Begin building your campus directory by adding your first student record."
                  actionText="Add Student"
                  onAction={() => openStudent()}
                  disabled={!departments.length}
                />
              )}
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {page === 'students' && (
          <div className="view-container">
            <div className="page-header">
              <div className="page-header-titles">
                <h1>Student Directory</h1>
                <p>
                  Showing {visibleStudents.length} of {students.length} enrolled students
                </p>
              </div>
              <div className="header-actions">
                <button
                  className="btn"
                  onClick={() => exportStudentsToCsv(visibleStudents)}
                  disabled={!visibleStudents.length}
                  title="Export currently filtered list to CSV"
                >
                  <IconDownload size={15} /> Export CSV
                </button>
                <button
                  className="btn primary"
                  onClick={() => openStudent()}
                  disabled={!departments.length}
                >
                  <IconPlus size={16} /> Add Student
                </button>
              </div>
            </div>

            {/* Filters & View Toolbar */}
            <div className="controls-bar">
              <div className="search-input-wrapper">
                <span className="search-icon-inside">
                  <IconSearch size={15} />
                </span>
                <input
                  id="student-search-input"
                  className="input-styled"
                  placeholder="Search by name, student ID, email, or section (Press /)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="search-clear-btn"
                    onClick={() => setQuery('')}
                    title="Clear search"
                  >
                    <IconX size={13} />
                  </button>
                )}
              </div>

              <div className="filters-row">
                <select
                  className="filter-select"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <select
                  className="filter-select"
                  value={semesterFilter}
                  onChange={(e) => setSemesterFilter(e.target.value)}
                >
                  <option value="">All Semesters</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      Semester {i + 1}
                    </option>
                  ))}
                </select>

                <div className="view-toggle-group">
                  <button
                    className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Table view"
                  >
                    <IconTable size={16} />
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Cards view"
                  >
                    <IconGrid size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Warning if no departments exist */}
            {!departments.length && (
              <div
                style={{
                  padding: '14px 18px',
                  background: 'var(--amber-light)',
                  border: '1px solid var(--amber-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--amber)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <IconAlert size={18} />
                <span>
                  Please create at least one department first before enrolling students.{' '}
                  <button
                    style={{
                      textDecoration: 'underline',
                      fontWeight: 700,
                      color: 'var(--text-strong)'
                    }}
                    onClick={() => setPage('departments')}
                  >
                    Go to Departments &rarr;
                  </button>
                </span>
              </div>
            )}

            {/* List / Grid Display */}
            {visibleStudents.length > 0 ? (
              viewMode === 'table' ? (
                <div className="table-card">
                  <StudentTable
                    rows={visibleStudents}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={toggleSort}
                    onView={(s) => setProfileModal(s)}
                    onEdit={(s) => openStudent(s)}
                    onDelete={(s) => setDeleteConfirm({ kind: 'student', item: s })}
                  />
                </div>
              ) : (
                <div className="cards-grid">
                  {visibleStudents.map((s) => (
                    <StudentCard
                      key={s._id}
                      student={s}
                      onView={() => setProfileModal(s)}
                      onEdit={() => openStudent(s)}
                      onDelete={() => setDeleteConfirm({ kind: 'student', item: s })}
                    />
                  ))}
                </div>
              )
            ) : (
              <EmptyState
                title={query || deptFilter || semesterFilter ? 'No Matching Students' : 'No Students Yet'}
                description={
                  query || deptFilter || semesterFilter
                    ? 'Try adjusting your search criteria or clear filters to view students.'
                    : 'Get started by creating your first student profile.'
                }
                actionText={query || deptFilter || semesterFilter ? 'Clear Filters' : 'Add Student'}
                onAction={() => {
                  if (query || deptFilter || semesterFilter) {
                    setQuery('');
                    setDeptFilter('');
                    setSemesterFilter('');
                  } else {
                    openStudent();
                  }
                }}
              />
            )}
          </div>
        )}

        {/* DEPARTMENTS TAB */}
        {page === 'departments' && (
          <div className="view-container">
            <div className="page-header">
              <div className="page-header-titles">
                <h1>Academic Departments</h1>
                <p>Manage college departments, section allocations, and student quotas</p>
              </div>
              <div className="header-actions">
                <button className="btn primary" onClick={() => openDepartment()}>
                  <IconPlus size={16} /> New Department
                </button>
              </div>
            </div>

            {departments.length ? (
              <div className="dept-grid">
                {departments.map((dept) => {
                  const enrolled = deptCounts[dept._id] || 0;
                  return (
                    <div key={dept._id} className="dept-card">
                      <div className="dept-card-header">
                        <div className="dept-title-group">
                          <h3>{dept.name}</h3>
                          <span className="dept-enrolled-count">
                            {enrolled} {enrolled === 1 ? 'student enrolled' : 'students enrolled'}
                          </span>
                        </div>
                        <div className="actions-cell">
                          <button
                            className="action-icon-btn"
                            onClick={() => openDepartment(dept)}
                            title="Edit department"
                          >
                            <IconEdit size={15} />
                          </button>
                          <button
                            className="action-icon-btn danger"
                            onClick={() => setDeleteConfirm({ kind: 'department', item: dept })}
                            disabled={enrolled > 0}
                            title={
                              enrolled > 0
                                ? 'Cannot delete department while students are enrolled'
                                : 'Delete department'
                            }
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            color: 'var(--text-muted)'
                          }}
                        >
                          Configured Sections ({dept.sections.length})
                        </span>
                        <div className="dept-sections-wrap">
                          {dept.sections.length ? (
                            dept.sections.map((sec) => (
                              <span key={sec} className="section-chip">
                                Section {sec}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                              No sections configured
                            </span>
                          )}
                        </div>
                      </div>

                      {enrolled > 0 && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-subtle)',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--line)'
                          }}
                        >
                          🔒 Sections with active students are protected from deletion.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No Departments Found"
                description="Set up your college departments and available sections to enroll students."
                actionText="Create Department"
                onAction={() => openDepartment()}
              />
            )}
          </div>
        )}
      </main>

      {/* MODAL: ADD / EDIT STUDENT OR DEPARTMENT */}
      {form && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setForm(null);
          }}
        >
          <div className="modal-box" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>
                {form.type === 'student'
                  ? form.student
                    ? 'Edit Student Record'
                    : 'Register New Student'
                  : form.department
                  ? 'Edit Department'
                  : 'Create Department'}
              </h2>
              <button
                className="icon-btn"
                style={{ width: '28px', height: '28px' }}
                onClick={() => setForm(null)}
                disabled={saving}
              >
                <IconX size={15} />
              </button>
            </div>

            {form.formError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--danger-light)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontSize: '13px'
                }}
              >
                {form.formError}
              </div>
            )}

            <form onSubmit={submitForm}>
              {form.type === 'student' ? (
                <>
                  <div className="form-group">
                    <label>Student ID</label>
                    <input
                      required
                      maxLength="30"
                      className="input-styled"
                      placeholder="e.g. CS2026-081"
                      disabled={Boolean(form.student)}
                      value={form.values.studentId}
                      onChange={(e) => setField('studentId', e.target.value)}
                    />
                    {form.student && (
                      <span className="form-hint">Student ID cannot be changed once assigned.</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      required
                      maxLength="100"
                      className="input-styled"
                      placeholder="e.g. Alex Morgan"
                      value={form.values.name}
                      onChange={(e) => setField('name', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      required
                      type="email"
                      maxLength="254"
                      className="input-styled"
                      placeholder="e.g. alex.morgan@campus.edu"
                      value={form.values.email}
                      onChange={(e) => setField('email', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Department</label>
                    <select
                      required
                      className="input-styled"
                      value={form.values.department}
                      onChange={(e) =>
                        setField('department', e.target.value, { section: '' })
                      }
                    >
                      <option value="" disabled>
                        Select academic department
                      </option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Section</label>
                      <select
                        required={formSections.length > 0}
                        disabled={!formSections.length}
                        className="input-styled"
                        value={form.values.section}
                        onChange={(e) => setField('section', e.target.value)}
                      >
                        <option value="" disabled={formSections.length > 0}>
                          {formSections.length ? 'Select section' : 'No sections'}
                        </option>
                        {formSections.map((sec) => (
                          <option key={sec} value={sec}>
                            Section {sec}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Semester</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="12"
                        className="input-styled"
                        placeholder="1 - 12"
                        value={form.values.semester}
                        onChange={(e) => setField('semester', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Phone Number (Optional)</label>
                    <input
                      type="tel"
                      maxLength="20"
                      className="input-styled"
                      placeholder="+1 (555) 000-0000"
                      value={form.values.contact}
                      onChange={(e) => setField('contact', e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Department Name</label>
                    <input
                      required
                      maxLength="80"
                      className="input-styled"
                      placeholder="e.g. Computer Science and Engineering"
                      value={form.values.name}
                      onChange={(e) => setField('name', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Sections (Comma separated)</label>
                    <input
                      maxLength="500"
                      className="input-styled"
                      placeholder="A, B, C"
                      value={form.values.sections}
                      onChange={(e) => setField('sections', e.target.value)}
                    />
                    <span className="form-hint">
                      Separate section names by commas (e.g. A, B, C). Sections with active students
                      cannot be removed.
                    </span>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={saving}
                  onClick={() => setForm(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STUDENT DOSSIER PROFILE VIEW */}
      {profileModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProfileModal(null);
          }}
        >
          <div className="modal-box" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Student Profile Dossier</h2>
              <button
                className="icon-btn"
                style={{ width: '28px', height: '28px' }}
                onClick={() => setProfileModal(null)}
              >
                <IconX size={15} />
              </button>
            </div>

            {(() => {
              const pal = getAvatarColor(profileModal.name || profileModal.studentId);
              return (
                <div>
                  <div className="profile-hero">
                    <div
                      className="profile-avatar-large"
                      style={{
                        backgroundColor: pal.bg,
                        color: pal.text,
                        borderColor: pal.border
                      }}
                    >
                      {getInitials(profileModal.name)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-strong)' }}>
                        {profileModal.name}
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        ID: <span className="id-badge">{profileModal.studentId}</span>
                      </p>
                    </div>
                  </div>

                  <div className="profile-details-grid">
                    <div className="profile-detail-cell">
                      <dt>Department</dt>
                      <dd>{profileModal.department?.name || '—'}</dd>
                    </div>

                    <div className="profile-detail-cell">
                      <dt>Class Section</dt>
                      <dd>Section {profileModal.section || '—'}</dd>
                    </div>

                    <div className="profile-detail-cell">
                      <dt>Semester</dt>
                      <dd>Semester {profileModal.semester}</dd>
                    </div>

                    <div className="profile-detail-cell">
                      <dt>Status</dt>
                      <dd style={{ color: 'var(--emerald)' }}>Active Enrolled</dd>
                    </div>

                    <div className="profile-detail-cell" style={{ gridColumn: 'span 2' }}>
                      <dt>Email Address</dt>
                      <dd>
                        <a
                          href={`mailto:${profileModal.email}`}
                          style={{
                            color: 'var(--primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <IconMail size={14} /> {profileModal.email}
                        </a>
                      </dd>
                    </div>

                    {profileModal.contact && (
                      <div className="profile-detail-cell" style={{ gridColumn: 'span 2' }}>
                        <dt>Contact Telephone</dt>
                        <dd>
                          <a
                            href={`tel:${profileModal.contact}`}
                            style={{
                              color: 'var(--text-strong)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <IconPhone size={14} /> {profileModal.contact}
                          </a>
                        </dd>
                      </div>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button
                      className="btn danger"
                      onClick={() => {
                        const s = profileModal;
                        setProfileModal(null);
                        setDeleteConfirm({ kind: 'student', item: s });
                      }}
                    >
                      <IconTrash size={15} /> Delete Record
                    </button>
                    <button
                      className="btn primary"
                      onClick={() => {
                        const s = profileModal;
                        setProfileModal(null);
                        openStudent(s);
                      }}
                    >
                      <IconEdit size={15} /> Edit Record
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM DESTRUCTIVE CONFIRMATION */}
      {deleteConfirm && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setDeleteConfirm(null);
          }}
        >
          <div className="modal-box" style={{ maxWidth: '440px' }} role="dialog">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--danger-light)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                <IconAlert size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-strong)' }}>
                  Delete {deleteConfirm.kind === 'student' ? 'Student' : 'Department'}?
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text)', marginBottom: '20px' }}>
              Are you sure you want to permanently delete{' '}
              <strong style={{ color: 'var(--text-strong)' }}>{deleteConfirm.item.name}</strong>? All
              associated record data will be permanently removed.
            </p>

            <div className="modal-actions">
              <button
                className="btn"
                disabled={saving}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                disabled={saving}
                onClick={handleConfirmDelete}
              >
                {saving ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOASTS */}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? <IconCheck size={18} /> : <IconAlert size={18} />}
            </span>
            <span>{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss toast"
            >
              <IconX size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Student Table Component with Sortable Headers
function StudentTable({ rows, sortField, sortOrder, onSort, onView, onEdit, onDelete }) {
  const renderSortIndicator = (field) => {
    if (!onSort) return null;
    if (sortField !== field) return <IconArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortOrder === 'asc' ? <IconSortAsc size={13} /> : <IconSortDesc size={13} />;
  };

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th
              className={onSort ? 'sortable' : ''}
              onClick={() => onSort && onSort('name')}
            >
              <span className="th-content">
                Student {renderSortIndicator('name')}
              </span>
            </th>
            <th
              className={onSort ? 'sortable' : ''}
              onClick={() => onSort && onSort('studentId')}
            >
              <span className="th-content">
                Student ID {renderSortIndicator('studentId')}
              </span>
            </th>
            <th
              className={onSort ? 'sortable' : ''}
              onClick={() => onSort && onSort('department')}
            >
              <span className="th-content">
                Department {renderSortIndicator('department')}
              </span>
            </th>
            <th
              className={onSort ? 'sortable' : ''}
              onClick={() => onSort && onSort('section')}
            >
              <span className="th-content">
                Section {renderSortIndicator('section')}
              </span>
            </th>
            <th
              className={onSort ? 'sortable' : ''}
              onClick={() => onSort && onSort('semester')}
            >
              <span className="th-content">
                Semester {renderSortIndicator('semester')}
              </span>
            </th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const pal = getAvatarColor(s.name || s.studentId);
            return (
              <tr key={s._id}>
                <td>
                  <div className="student-cell">
                    <div
                      className="avatar"
                      style={{
                        backgroundColor: pal.bg,
                        color: pal.text,
                        borderColor: pal.border
                      }}
                    >
                      {getInitials(s.name)}
                    </div>
                    <div className="student-info-text">
                      <button
                        className="student-name-link"
                        style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                        onClick={() => onView(s)}
                      >
                        {s.name}
                      </button>
                      <span className="student-email-sub">{s.email}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="id-badge">{s.studentId}</span>
                </td>
                <td>
                  <span className="dept-pill">{s.department?.name || '—'}</span>
                </td>
                <td>
                  <span className="section-tag">{s.section || '—'}</span>
                </td>
                <td>
                  <span className="semester-pill">Sem {s.semester}</span>
                </td>
                <td>
                  <div className="actions-cell">
                    <button
                      className="action-icon-btn"
                      onClick={() => onView(s)}
                      title="View Student Dossier"
                    >
                      <IconEye size={15} />
                    </button>
                    <button
                      className="action-icon-btn"
                      onClick={() => onEdit(s)}
                      title="Edit Student Record"
                    >
                      <IconEdit size={15} />
                    </button>
                    <button
                      className="action-icon-btn danger"
                      onClick={() => onDelete(s)}
                      title="Delete Student"
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Student Card Component (Grid View)
function StudentCard({ student, onView, onEdit, onDelete }) {
  const pal = getAvatarColor(student.name || student.studentId);
  return (
    <div className="student-card">
      <div className="student-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="avatar"
            style={{
              width: '42px',
              height: '42px',
              backgroundColor: pal.bg,
              color: pal.text,
              borderColor: pal.border,
              fontSize: '15px'
            }}
          >
            {getInitials(student.name)}
          </div>
          <div>
            <h4
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-strong)',
                cursor: 'pointer'
              }}
              onClick={onView}
            >
              {student.name}
            </h4>
            <span className="id-badge">{student.studentId}</span>
          </div>
        </div>

        <span className="dept-pill" style={{ fontSize: '11px' }}>
          {student.department?.name || '—'}
        </span>
      </div>

      <div className="student-card-meta">
        <div className="meta-item">
          <dt>Section</dt>
          <dd>{student.section || '—'}</dd>
        </div>
        <div className="meta-item">
          <dt>Semester</dt>
          <dd>Semester {student.semester}</dd>
        </div>
        <div className="meta-item" style={{ gridColumn: 'span 2' }}>
          <dt>Email</dt>
          <dd style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
            {student.email}
          </dd>
        </div>
      </div>

      <div className="student-card-footer">
        <button className="btn subtle sm" onClick={onView}>
          <IconEye size={14} /> Details
        </button>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="action-icon-btn" onClick={onEdit} title="Edit Student">
            <IconEdit size={14} />
          </button>
          <button className="action-icon-btn danger" onClick={onDelete} title="Delete Student">
            <IconTrash size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Clean Empty State Component
function EmptyState({ title, description, actionText, onAction, disabled }) {
  return (
    <div className="empty-state">
      <div className="empty-icon-wrap">
        <IconGraduationCap size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionText && (
        <button className="btn primary" onClick={onAction} disabled={disabled}>
          <IconPlus size={15} /> {actionText}
        </button>
      )}
    </div>
  );
}
