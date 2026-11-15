import React, { useMemo, useState } from 'react';
import {
  Banknote,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Clock,
  FileSignature,
  Kanban,
  List,
  Plus,
  Printer,
  Target,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import {
  AttendanceLog,
  Candidate,
  DocumentRecord,
  EmployeeRecord,
  LeaveRequest,
  MarketingCampaign,
  ProjectTask,
  ProjectTaskStatus,
  SupportTicket,
  TicketStatus,
} from '@/src/core/store/erpTypes';
import { formatNumericCurrency } from '@/src/lib/utils';

export function OperationsModulesView({
  slug,
}: {
  slug: 'hrms' | 'projects' | 'support' | 'documents' | 'marketing';
}) {
  if (slug === 'hrms') return <HrmsPanel />;
  if (slug === 'projects') return <ProjectsPanel />;
  if (slug === 'support') return <SupportPanel />;
  if (slug === 'documents') return <DocumentsPanel />;
  return <MarketingPanel />;
}

function HrmsPanel() {
  const { activeCompany } = useTenant();
  const {
    data,
    addEmployee,
    toggleEmployeeStatus,
    deleteEmployee,
    runMonthlyPayroll,
    addLeaveRequest,
    updateLeaveStatus,
    addAttendanceLog,
    addJobOpening,
    addCandidate,
    updateCandidateStage,
    hireCandidate,
    addPerformanceGoal,
    updatePerformanceProgress,
  } = useErpData();
  const currency = activeCompany.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);

  const [tab, setTab] = useState<'directory' | 'attendance' | 'ats' | 'okr'>('directory');
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [designation, setDesignation] = useState('Specialist');
  const [monthlySalary, setMonthlySalary] = useState('0');
  const [payrollNotice, setPayrollNotice] = useState<string | null>(null);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [payslipEmp, setPayslipEmp] = useState<EmployeeRecord | null>(null);

  // Leave & Attendance State
  const [attEmpId, setAttEmpId] = useState('');
  const [attIn, setAttIn] = useState('09:00');
  const [attOut, setAttOut] = useState('18:00');
  const [attHours, setAttHours] = useState('8');
  const [attStatus, setAttStatus] = useState<AttendanceLog['status']>('present');

  const [lvEmpId, setLvEmpId] = useState('');
  const [lvType, setLvType] = useState<LeaveRequest['leaveType']>('annual');
  const [lvStart, setLvStart] = useState(today);
  const [lvEnd, setLvEnd] = useState(today);
  const [lvDays, setLvDays] = useState('1');
  const [lvReason, setLvReason] = useState('');

  // ATS State
  const [jobTitle, setJobTitle] = useState('');
  const [jobDept, setJobDept] = useState('Engineering');
  const [jobSalary, setJobSalary] = useState('5000');
  const [candJobId, setCandJobId] = useState('');
  const [candName, setCandName] = useState('');
  const [candEmail, setCandEmail] = useState('');
  const [candSalary, setCandSalary] = useState('4500');

  // OKR State
  const [okrEmp, setOkrEmp] = useState('');
  const [okrTitle, setOkrTitle] = useState('');
  const [okrTarget, setOkrTarget] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    const sal = Math.max(0, Number(monthlySalary) || 0);
    addEmployee({
      employeeCode: `EMP-${String(data.employees.length + 1).padStart(3, '0')}`,
      fullName: fullName.trim(),
      email: email.trim(),
      department: department.trim() || 'Operations',
      designation: designation.trim() || 'Staff',
      monthlySalary: sal,
      basicSalary: Math.round(sal * 0.7),
      allowances: Math.round(sal * 0.3),
      deductions: 0,
      status: 'active',
      joinedDate: today,
    });
    setFullName('');
    setEmail('');
    setMonthlySalary('0');
    setShowForm(false);
  };

  const handleRunPayroll = () => {
    setPayrollError(null);
    setPayrollNotice(null);
    try {
      const run = runMonthlyPayroll();
      setPayrollNotice(
        `Posted ${formatNumericCurrency(run.totalGross, currency, 2)} payroll run (${run.periodKey}) for ${run.employeeCount} staff to Double-Entry Ledger.`,
      );
    } catch (err) {
      setPayrollError(
        err instanceof Error ? err.message : 'Unable to execute monthly payroll run.',
      );
    }
  };

  const handleAddAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = data.employees.find((x) => x.id === (attEmpId || data.employees[0]?.id));
    if (!emp) return;
    addAttendanceLog({
      employeeId: emp.id,
      employeeName: emp.fullName,
      date: today,
      checkIn: attIn,
      checkOut: attOut,
      hoursWorked: Math.max(0, Number(attHours) || 0),
      status: attStatus,
    });
    setPayrollNotice(`Logged attendance for ${emp.fullName}.`);
  };

  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = data.employees.find((x) => x.id === (lvEmpId || data.employees[0]?.id));
    if (!emp) return;
    addLeaveRequest({
      employeeId: emp.id,
      employeeName: emp.fullName,
      leaveType: lvType,
      startDate: lvStart,
      endDate: lvEnd,
      days: Math.max(0.5, Number(lvDays) || 1),
      reason: lvReason.trim() || 'Requested leave',
    });
    setLvReason('');
    setPayrollNotice(`Submitted leave request for ${emp.fullName}.`);
  };

  const handleAddJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim()) return;
    addJobOpening({
      title: jobTitle.trim(),
      department: jobDept.trim() || 'Operations',
      employmentType: 'full_time',
      targetSalary: Math.max(0, Number(jobSalary) || 0),
      status: 'open',
    });
    setJobTitle('');
  };

  const handleAddCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    const targetJob = candJobId || data.jobOpenings[0]?.id;
    if (!targetJob || !candName.trim()) return;
    addCandidate({
      jobOpeningId: targetJob,
      fullName: candName.trim(),
      email: candEmail.trim(),
      stage: 'applied',
      expectedSalary: Math.max(0, Number(candSalary) || 0),
      notes: '',
    });
    setCandName('');
    setCandEmail('');
  };

  const handleAddOkr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!okrTitle.trim()) return;
    addPerformanceGoal({
      employeeName: okrEmp.trim() || data.employees[0]?.fullName || 'Team',
      title: okrTitle.trim(),
      metricTarget: okrTarget.trim() || '100%',
      progressPct: 0,
      periodKey: today.slice(0, 7),
      status: 'on_track',
    });
    setOkrTitle('');
    setOkrTarget('');
  };

  const columns: DataColumn<EmployeeRecord>[] = [
    {
      key: 'code',
      header: 'ID & Employee',
      sortable: true,
      sortValue: (r) => r.fullName,
      render: (r) => (
        <div>
          <div className="font-semibold text-[#1C1917] dark:text-slate-100">{r.fullName}</div>
          <div className="font-mono text-[11px] text-[#718096] dark:text-slate-400">
            {r.employeeCode} · {r.email || 'No email'}
          </div>
        </div>
      ),
    },
    {
      key: 'dept',
      header: 'Department & Role',
      render: (r) => (
        <div>
          <div className="text-xs font-medium">{r.department}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">{r.designation}</div>
        </div>
      ),
    },
    {
      key: 'salary',
      header: `Monthly Salary (${currency})`,
      align: 'right',
      numeric: true,
      render: (r) => <span>{formatNumericCurrency(r.monthlySalary, currency, 2)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <button
          type="button"
          onClick={() => toggleEmployeeStatus(r.id)}
          className={`text-xs font-medium capitalize cursor-pointer ${
            r.status === 'active' ? 'text-[#16B8A6]' : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {r.status.replace('_', ' ')}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPayslipEmp(r)}
            title="View & print payslip"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
          >
            <Printer className="h-3 w-3" />
            Payslip
          </button>
          <button
            type="button"
            onClick={() => deleteEmployee(r.id)}
            className="p-1.5 text-[#718096] hover:text-red-600 cursor-pointer"
            aria-label={`Remove ${r.fullName}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            HRMS, Payroll, Attendance, ATS & OKRs
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Manage employee directory, payslips, double-entry payroll, attendance logs, leave approvals, applicant hiring, and OKRs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.employees.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleRunPayroll}>
              <Banknote className="h-3.5 w-3.5 text-[#16B8A6]" />
              Run Monthly Payroll
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
        {(
          [
            { id: 'directory', label: `Employees & Payroll (${data.employees.length})` },
            { id: 'attendance', label: `Attendance & Leave (${data.leaveRequests.length})` },
            { id: 'ats', label: `Recruitment ATS (${data.candidates.length})` },
            { id: 'okr', label: `Performance OKRs (${data.performanceGoals.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === t.id
                ? 'bg-white dark:bg-[#1B1417] text-[#1C1917] dark:text-slate-100 shadow-xs'
                : 'text-[#718096] dark:text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {payrollError && (
        <Surface padding="sm" className="text-xs font-medium text-red-600 dark:text-red-400">
          {payrollError}
        </Surface>
      )}
      {payrollNotice && (
        <Surface padding="sm" className="text-xs font-medium text-[#16B8A6]">
          {payrollNotice}
        </Surface>
      )}

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleAdd} className="space-y-4">
            <h2 className="text-sm font-semibold">Add Team Member</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name *"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work Email"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Department"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Role / Designation"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="number"
                step="0.01"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                placeholder={`Monthly Salary (${currency})`}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Employee
              </Button>
            </div>
          </form>
        </Surface>
      )}

      {tab === 'directory' && (
        <DataTable
          data={data.employees}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search employee name, ID, or department..."
          searchPredicate={(r, q) =>
            `${r.employeeCode} ${r.fullName} ${r.department} ${r.designation}`
              .toLowerCase()
              .includes(q)
          }
          emptyTitle="No employees added yet"
          emptyDescription="Add team members to manage departments, payslips, attendance, and payroll disbursements."
          emptyActionLabel="Add Employee"
          onEmptyAction={() => setShowForm(true)}
        />
      )}

      {tab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Surface padding="lg">
              <form onSubmit={handleAddAttendance} className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#DC2626]" />
                  Daily Attendance Log
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <select
                    value={attEmpId || data.employees[0]?.id || ''}
                    onChange={(e) => setAttEmpId(e.target.value)}
                    className="sm:col-span-2 h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    {data.employees.length === 0 ? (
                      <option value="">Add employee first...</option>
                    ) : (
                      data.employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName}
                        </option>
                      ))
                    )}
                  </select>
                  <input
                    type="time"
                    value={attIn}
                    onChange={(e) => setAttIn(e.target.value)}
                    className="h-9 px-2 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="time"
                    value={attOut}
                    onChange={(e) => setAttOut(e.target.value)}
                    className="h-9 px-2 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <select
                    value={attStatus}
                    onChange={(e) => setAttStatus(e.target.value as AttendanceLog['status'])}
                    className="h-9 px-2 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    <option value="present">Present</option>
                    <option value="remote">Remote</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <input
                    type="number"
                    step="0.5"
                    value={attHours}
                    onChange={(e) => setAttHours(e.target.value)}
                    placeholder="Hours"
                    className="w-28 h-8 px-2.5 rounded-md text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <Button type="submit" variant="primary" size="sm" disabled={data.employees.length === 0}>
                    Log Attendance
                  </Button>
                </div>
              </form>
            </Surface>

            <Surface padding="lg">
              <form onSubmit={handleAddLeave} className="space-y-3">
                <h2 className="text-sm font-semibold">Request Leave</h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    value={lvEmpId || data.employees[0]?.id || ''}
                    onChange={(e) => setLvEmpId(e.target.value)}
                    className="sm:col-span-2 h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    {data.employees.length === 0 ? (
                      <option value="">Add employee first...</option>
                    ) : (
                      data.employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.fullName}
                        </option>
                      ))
                    )}
                  </select>
                  <select
                    value={lvType}
                    onChange={(e) => setLvType(e.target.value as LeaveRequest['leaveType'])}
                    className="h-9 px-2 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    <option value="annual">Annual</option>
                    <option value="sick">Sick</option>
                    <option value="casual">Casual</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    value={lvDays}
                    onChange={(e) => setLvDays(e.target.value)}
                    placeholder="Days"
                    className="h-9 px-2 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="date"
                    value={lvStart}
                    onChange={(e) => setLvStart(e.target.value)}
                    className="h-9 px-2 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="date"
                    value={lvEnd}
                    onChange={(e) => setLvEnd(e.target.value)}
                    className="h-9 px-2 rounded-lg text-xs font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="text"
                    value={lvReason}
                    onChange={(e) => setLvReason(e.target.value)}
                    placeholder="Reason"
                    className="sm:col-span-2 h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm" disabled={data.employees.length === 0}>
                    Submit Leave
                  </Button>
                </div>
              </form>
            </Surface>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Surface padding="md" className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-[#718096]">
                Leave Approvals ({data.leaveRequests.length})
              </h3>
              {data.leaveRequests.length === 0 ? (
                <p className="text-xs text-[#718096]">No leave requests submitted.</p>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-[#32242A] text-xs">
                  {data.leaveRequests.map((l) => (
                    <div key={l.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {l.employeeName} · <span className="capitalize">{l.leaveType}</span> ({l.days}d)
                        </div>
                        <div className="text-[11px] text-[#718096]">
                          {l.startDate} to {l.endDate} · {l.reason}
                        </div>
                      </div>
                      {l.status === 'pending' ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => updateLeaveStatus(l.id, 'approved')}
                            className="text-xs font-medium text-[#16B8A6] hover:underline cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLeaveStatus(l.id, 'rejected')}
                            className="text-xs font-medium text-red-600 hover:underline cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`font-semibold capitalize ${
                            l.status === 'approved' ? 'text-[#16B8A6]' : 'text-red-600'
                          }`}
                        >
                          {l.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Surface>

            <Surface padding="md" className="space-y-3">
              <h3 className="text-xs font-semibold uppercase text-[#718096]">
                Recent Attendance ({data.attendanceLogs.length})
              </h3>
              {data.attendanceLogs.length === 0 ? (
                <p className="text-xs text-[#718096]">No attendance entries logged yet.</p>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-[#32242A] text-xs">
                  {data.attendanceLogs.slice(0, 8).map((a) => (
                    <div key={a.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold">{a.employeeName}</span>
                        <span className="ml-2 font-mono text-[11px] text-[#718096]">
                          {a.date} · {a.checkIn}-{a.checkOut} ({a.hoursWorked}h)
                        </span>
                      </div>
                      <span className="capitalize font-semibold text-[#DC2626]">{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        </div>
      )}

      {tab === 'ats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Surface padding="lg">
              <form onSubmit={handleAddJob} className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-[#DC2626]" />
                  Publish Job Opening
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Role Title *"
                    className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="text"
                    value={jobDept}
                    onChange={(e) => setJobDept(e.target.value)}
                    placeholder="Department"
                    className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={jobSalary}
                      onChange={(e) => setJobSalary(e.target.value)}
                      placeholder="Salary"
                      className="w-full h-9 px-2.5 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <Button type="submit" variant="primary" size="sm">
                      Post
                    </Button>
                  </div>
                </div>
              </form>
            </Surface>

            <Surface padding="lg">
              <form onSubmit={handleAddCandidate} className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-[#16B8A6]" />
                  Add Applicant Candidate
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    value={candJobId || data.jobOpenings[0]?.id || ''}
                    onChange={(e) => setCandJobId(e.target.value)}
                    className="h-9 px-2.5 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  >
                    {data.jobOpenings.length === 0 ? (
                      <option value="">Post job opening first...</option>
                    ) : (
                      data.jobOpenings.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                        </option>
                      ))
                    )}
                  </select>
                  <input
                    type="text"
                    required
                    value={candName}
                    onChange={(e) => setCandName(e.target.value)}
                    placeholder="Candidate Name *"
                    className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <input
                    type="email"
                    value={candEmail}
                    onChange={(e) => setCandEmail(e.target.value)}
                    placeholder="Email"
                    className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={candSalary}
                      onChange={(e) => setCandSalary(e.target.value)}
                      placeholder="Salary"
                      className="w-full h-9 px-2.5 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                    />
                    <Button type="submit" variant="primary" size="sm" disabled={data.jobOpenings.length === 0}>
                      Add
                    </Button>
                  </div>
                </div>
              </form>
            </Surface>
          </div>

          <Surface padding="none" className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#EFF3FA]/70 dark:bg-[#251B20] text-[#718096] border-b border-slate-200 dark:border-[#32242A]">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Expected Salary</th>
                  <th className="px-4 py-3">Pipeline Stage</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                {data.candidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#718096]">
                      No job applicants tracked yet.
                    </td>
                  </tr>
                ) : (
                  data.candidates.map((c) => {
                    const job = data.jobOpenings.find((j) => j.id === c.jobOpeningId);
                    return (
                      <tr key={c.id}>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{c.fullName}</div>
                          <div className="text-[11px] text-[#718096]">{c.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3">{job?.title ?? 'General'}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {formatNumericCurrency(c.expectedSalary, currency, 2)}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={c.stage}
                            onChange={(e) => updateCandidateStage(c.id, e.target.value as Candidate['stage'])}
                            className="h-7 px-2 rounded text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] capitalize"
                          >
                            <option value="applied">Applied</option>
                            <option value="screening">Screening</option>
                            <option value="interview">Interview</option>
                            <option value="offer">Offer</option>
                            <option value="hired">Hired</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {c.stage !== 'hired' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const emp = hireCandidate(c.id, today, c.expectedSalary);
                                setPayrollNotice(`Hired ${emp.fullName} as ${emp.employeeCode}!`);
                              }}
                            >
                              Hire & Onboard
                            </Button>
                          ) : (
                            <span className="text-xs font-semibold text-[#16B8A6]">Onboarded</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Surface>
        </div>
      )}

      {tab === 'okr' && (
        <div className="space-y-6">
          <Surface padding="lg">
            <form onSubmit={handleAddOkr} className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-[#DC2626]" />
                Assign Performance OKR / KPI Goal
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={okrEmp}
                  onChange={(e) => setOkrEmp(e.target.value)}
                  placeholder="Employee / Owner"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  required
                  value={okrTitle}
                  onChange={(e) => setOkrTitle(e.target.value)}
                  placeholder="Objective Title *"
                  className="sm:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={okrTarget}
                    onChange={(e) => setOkrTarget(e.target.value)}
                    placeholder="Key Result Target"
                    className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                  <Button type="submit" variant="primary" size="sm">
                    Add
                  </Button>
                </div>
              </div>
            </form>
          </Surface>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.performanceGoals.map((g) => (
              <Surface key={g.id} className="space-y-2.5">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="text-sm font-semibold">{g.title}</div>
                    <div className="text-xs text-[#718096]">
                      {g.employeeName} · Target: {g.metricTarget}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#DC2626]">{g.progressPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={g.progressPct}
                  onChange={(e) => updatePerformanceProgress(g.id, Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </Surface>
            ))}
          </div>
        </div>
      )}

      {/* Printable Payslip Modal */}
      {payslipEmp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B1417]/60"
          role="dialog"
          aria-modal="true"
          onClick={() => setPayslipEmp(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-[#32242A] pb-3">
              <div>
                <div className="text-xs font-semibold text-[#DC2626]">{activeCompany.legalName}</div>
                <h3 className="text-base font-bold">Employee Payslip — {payslipEmp.fullName}</h3>
                <div className="text-xs text-[#718096]">
                  {payslipEmp.employeeCode} · {payslipEmp.department} ({payslipEmp.designation})
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Button>
                <button
                  type="button"
                  onClick={() => setPayslipEmp(null)}
                  className="p-1 text-[#718096] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="font-sans text-[#718096]">Basic Pay (70%)</span>
                <span>{formatNumericCurrency(payslipEmp.basicSalary ?? payslipEmp.monthlySalary * 0.7, currency, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-[#718096]">Allowances (30%)</span>
                <span>{formatNumericCurrency(payslipEmp.allowances ?? payslipEmp.monthlySalary * 0.3, currency, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-[#718096]">Deductions</span>
                <span>({formatNumericCurrency(payslipEmp.deductions ?? 0, currency, 2)})</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-[#32242A] text-sm font-bold text-[#16B8A6]">
                <span className="font-sans">Net Monthly Pay</span>
                <span>{formatNumericCurrency(payslipEmp.monthlySalary - (payslipEmp.deductions ?? 0), currency, 2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectsPanel() {
  const { activeCompany } = useTenant();
  const {
    data,
    addProjectTask,
    updateProjectTaskStatus,
    deleteProjectTask,
    addTimesheet,
    markTimesheetBilled,
  } = useErpData();
  const currency = activeCompany.baseCurrency;
  const today = new Date().toISOString().slice(0, 10);

  const [viewTab, setViewTab] = useState<'list' | 'kanban' | 'timesheets'>('list');
  const [showForm, setShowForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [title, setTitle] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [priority, setPriority] = useState<ProjectTask['priority']>('medium');
  const [dueDate, setDueDate] = useState(today);
  const [budget, setBudget] = useState('0');
  const [isFieldService, setIsFieldService] = useState(false);
  const [siteAddress, setSiteAddress] = useState('');

  // Timesheet State
  const [tsProject, setTsProject] = useState('General Operations');
  const [tsEmp, setTsEmp] = useState('');
  const [tsHours, setTsHours] = useState('2');
  const [tsRate, setTsRate] = useState('75');
  const [tsBillable, setTsBillable] = useState(true);
  const [tsNotes, setTsNotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addProjectTask({
      projectName: projectName.trim() || 'General Operations',
      title: title.trim(),
      assigneeName: assigneeName.trim() || 'Unassigned',
      priority,
      status: 'backlog',
      dueDate,
      budget: Math.max(0, Number(budget) || 0),
      isFieldService,
      siteAddress: isFieldService ? siteAddress.trim() : undefined,
    });
    setTitle('');
    setBudget('0');
    setSiteAddress('');
    setIsFieldService(false);
    setShowForm(false);
  };

  const handleAddTimesheet = (e: React.FormEvent) => {
    e.preventDefault();
    addTimesheet({
      projectName: tsProject.trim() || 'General Operations',
      employeeName: tsEmp.trim() || 'Consultant',
      workDate: today,
      hours: Math.max(0.25, Number(tsHours) || 1),
      hourlyRate: Math.max(0, Number(tsRate) || 0),
      billable: tsBillable,
      notes: tsNotes.trim(),
    });
    setTsNotes('');
  };

  const totalBillableValue = useMemo(() => {
    return data.timesheets
      .filter((t) => t.billable)
      .reduce((s, t) => s + t.hours * t.hourlyRate, 0);
  }, [data.timesheets]);

  const columns: DataColumn<ProjectTask>[] = [
    {
      key: 'title',
      header: 'Task & Project',
      render: (r) => (
        <div>
          <div className="font-semibold text-[#1C1917] dark:text-slate-100">
            {r.title}
            {r.isFieldService ? ' · [Field Service]' : ''}
          </div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.projectName} · Assignee: {r.assigneeName}
            {r.siteAddress ? ` · Site: ${r.siteAddress}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'due',
      header: 'Due Date',
      render: (r) => <span className="font-mono text-xs">{r.dueDate}</span>,
    },
    {
      key: 'budget',
      header: 'Budget',
      align: 'right',
      numeric: true,
      render: (r) => <span>{formatNumericCurrency(r.budget, currency, 2)}</span>,
    },
    {
      key: 'status',
      header: 'Workflow',
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) => updateProjectTaskStatus(r.id, e.target.value as ProjectTaskStatus)}
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
        >
          <option value="backlog">Backlog</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => deleteProjectTask(r.id)}
          className="p-1.5 text-[#718096] hover:text-red-600 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  const TASK_STAGES: ProjectTaskStatus[] = ['backlog', 'in_progress', 'review', 'done'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            Projects, Timesheets & Field Service
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Execute deliverables via List or Kanban board, dispatch on-site Field Service jobs, and log billable timesheets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
            <button
              type="button"
              onClick={() => setViewTab('list')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewTab === 'list' ? 'bg-white dark:bg-[#1B1417] shadow-xs' : 'text-[#718096]'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewTab('kanban')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewTab === 'kanban' ? 'bg-white dark:bg-[#1B1417] shadow-xs' : 'text-[#718096]'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewTab('timesheets')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer ${
                viewTab === 'timesheets' ? 'bg-white dark:bg-[#1B1417] shadow-xs' : 'text-[#718096]'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Timesheets ({data.timesheets.length})
            </button>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project Name"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task Title *"
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="text"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="Assignee"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProjectTask['priority'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <input
                  type="number"
                  step="0.01"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder={`Budget (${currency})`}
                  className="w-40 h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFieldService}
                    onChange={(e) => setIsFieldService(e.target.checked)}
                  />
                  <span>Field Service Dispatch</span>
                </label>
                {isFieldService && (
                  <input
                    type="text"
                    value={siteAddress}
                    onChange={(e) => setSiteAddress(e.target.value)}
                    placeholder="Client Site Address"
                    className="w-60 h-9 px-3 rounded-lg text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Create Task
                </Button>
              </div>
            </div>
          </form>
        </Surface>
      )}

      {viewTab === 'list' && (
        <DataTable
          data={data.projectTasks}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search task or project..."
          searchPredicate={(r, q) =>
            `${r.projectName} ${r.title} ${r.assigneeName}`.toLowerCase().includes(q)
          }
          emptyTitle="No project tasks yet"
          emptyDescription="Create deliverables and assign owners to track progress across milestones."
          emptyActionLabel="New Task"
          onEmptyAction={() => setShowForm(true)}
        />
      )}

      {viewTab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {TASK_STAGES.map((st) => {
            const items = data.projectTasks.filter((t) => t.status === st);
            return (
              <Surface key={st} padding="sm" className="space-y-3 bg-[#FAF9F7]/60 dark:bg-[#141013]">
                <div className="text-xs font-semibold uppercase tracking-wide border-b border-slate-200 dark:border-[#32242A] pb-2">
                  {st.replace('_', ' ')} ({items.length})
                </div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] space-y-2"
                    >
                      <div className="text-xs font-semibold">{t.title}</div>
                      <div className="text-[11px] text-[#718096]">
                        {t.projectName} · {t.assigneeName}
                        {t.isFieldService ? ` · Field: ${t.siteAddress || 'On-site'}` : ''}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-[#32242A]">
                        <select
                          value={t.status}
                          onChange={(e) => updateProjectTaskStatus(t.id, e.target.value as ProjectTaskStatus)}
                          className="h-6 px-1.5 rounded text-[11px] bg-[#FAF9F7] dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                        >
                          {TASK_STAGES.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono text-[11px] text-[#718096]">{t.dueDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      {viewTab === 'timesheets' && (
        <div className="space-y-4">
          <Surface padding="lg">
            <form onSubmit={handleAddTimesheet} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Log Project Timesheet</h2>
                <span className="text-xs font-mono font-semibold text-[#16B8A6]">
                  Total Billable: {formatNumericCurrency(totalBillableValue, currency, 2)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <input
                  type="text"
                  value={tsProject}
                  onChange={(e) => setTsProject(e.target.value)}
                  placeholder="Project Name"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={tsEmp}
                  onChange={(e) => setTsEmp(e.target.value)}
                  placeholder="Employee / Consultant"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="number"
                  step="0.25"
                  value={tsHours}
                  onChange={(e) => setTsHours(e.target.value)}
                  placeholder="Hours"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="number"
                  step="0.01"
                  value={tsRate}
                  onChange={(e) => setTsRate(e.target.value)}
                  placeholder="Hourly Rate"
                  className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={tsNotes}
                  onChange={(e) => setTsNotes(e.target.value)}
                  placeholder="Work summary"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tsBillable}
                      onChange={(e) => setTsBillable(e.target.checked)}
                    />
                    Billable
                  </label>
                  <Button type="submit" variant="primary" size="sm">
                    Log
                  </Button>
                </div>
              </div>
            </form>
          </Surface>

          <Surface padding="none" className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#EFF3FA]/70 dark:bg-[#251B20] text-[#718096] border-b border-slate-200 dark:border-[#32242A]">
                <tr>
                  <th className="px-4 py-3">Date & Project</th>
                  <th className="px-4 py-3">Employee & Notes</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">Billing Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-[#32242A]">
                {data.timesheets.map((ts) => (
                  <tr key={ts.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{ts.projectName}</div>
                      <div className="font-mono text-[11px] text-[#718096]">{ts.workDate}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{ts.employeeName}</div>
                      <div className="text-[11px] text-[#718096]">{ts.notes || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{ts.hours}h</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                      {formatNumericCurrency(ts.hours * ts.hourlyRate, currency, 2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ts.billed ? (
                        <span className="text-[#16B8A6] font-semibold">Billed</span>
                      ) : ts.billable ? (
                        <button
                          type="button"
                          onClick={() => markTimesheetBilled(ts.id)}
                          className="text-xs font-medium text-[#DC2626] hover:underline cursor-pointer"
                        >
                          Mark Billed
                        </button>
                      ) : (
                        <span className="text-[#718096]">Internal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        </div>
      )}
    </div>
  );
}

function SupportPanel() {
  const { data, addSupportTicket, updateSupportTicketStatus, deleteSupportTicket, addKbArticle } =
    useErpData();
  const [tab, setTab] = useState<'tickets' | 'kb'>('tickets');
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [priority, setPriority] = useState<SupportTicket['priority']>('medium');
  const [channel, setChannel] = useState<NonNullable<SupportTicket['channel']>>('email');
  const [slaDueDate, setSlaDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // KB Article Form
  const [kbTitle, setKbTitle] = useState('');
  const [kbCat, setKbCat] = useState('How-To');
  const [kbSummary, setKbSummary] = useState('');
  const [kbContent, setKbContent] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    addSupportTicket({
      subject: subject.trim(),
      customerName: customerName.trim() || 'General',
      priority,
      status: 'open',
      channel,
      slaDueDate,
      notes: notes.trim(),
    });
    setSubject('');
    setCustomerName('');
    setNotes('');
    setShowForm(false);
  };

  const handleAddKb = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbTitle.trim()) return;
    addKbArticle({
      title: kbTitle.trim(),
      category: kbCat.trim() || 'General',
      summary: kbSummary.trim(),
      content: kbContent.trim(),
      published: true,
    });
    setKbTitle('');
    setKbSummary('');
    setKbContent('');
  };

  const columns: DataColumn<SupportTicket>[] = [
    {
      key: 'num',
      header: 'Ticket',
      render: (r) => (
        <div>
          <span className="font-mono text-xs font-semibold">{r.ticketNumber}</span>
          <div className="text-[10px] uppercase text-[#718096]">{r.channel ?? 'email'}</div>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Subject, Customer & SLA',
      render: (r) => (
        <div>
          <div className="font-semibold">{r.subject}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.customerName} · Priority: {r.priority}
            {r.slaDueDate ? ` · SLA Due: ${r.slaDueDate}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) => updateSupportTicketStatus(r.id, e.target.value as TicketStatus)}
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => deleteSupportTicket(r.id)}
          className="p-1.5 text-[#718096] hover:text-red-600 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            Support Desk, SLA & Knowledge Base
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Log omnichannel customer tickets with SLA deadlines and maintain a self-service Knowledge Base.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New Ticket
        </Button>
      </div>

      <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#251B20]">
        <button
          type="button"
          onClick={() => setTab('tickets')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
            tab === 'tickets' ? 'bg-white dark:bg-[#1B1417] shadow-xs' : 'text-[#718096]'
          }`}
        >
          Tickets ({data.supportTickets.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('kb')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer inline-flex items-center gap-1.5 ${
            tab === 'kb' ? 'bg-white dark:bg-[#1B1417] shadow-xs' : 'text-[#718096]'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Knowledge Base ({data.kbArticles.length})
        </button>
      </div>

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Issue Subject *"
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SupportTicket['priority'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as typeof channel)}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              >
                <option value="email">Email</option>
                <option value="chat">Live Chat</option>
                <option value="phone">Phone</option>
                <option value="portal">Customer Portal</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="date"
                value={slaDueDate}
                onChange={(e) => setSlaDueDate(e.target.value)}
                title="SLA Due Date"
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ticket notes or details"
                className="sm:col-span-3 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Create Ticket
              </Button>
            </div>
          </form>
        </Surface>
      )}

      {tab === 'tickets' ? (
        <DataTable
          data={data.supportTickets}
          columns={columns}
          getRowKey={(r) => r.id}
          searchPlaceholder="Search ticket number or subject..."
          searchPredicate={(r, q) =>
            `${r.ticketNumber} ${r.subject} ${r.customerName}`.toLowerCase().includes(q)
          }
          emptyTitle="No support tickets logged"
          emptyDescription="Create tickets to track customer issues from open to resolution."
          emptyActionLabel="New Ticket"
          onEmptyAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-6">
          <Surface padding="lg">
            <form onSubmit={handleAddKb} className="space-y-3">
              <h2 className="text-sm font-semibold">Publish Knowledge Base Article</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={kbTitle}
                  onChange={(e) => setKbTitle(e.target.value)}
                  placeholder="Article Title *"
                  className="sm:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <input
                  type="text"
                  value={kbCat}
                  onChange={(e) => setKbCat(e.target.value)}
                  placeholder="Category"
                  className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
              </div>
              <input
                type="text"
                value={kbSummary}
                onChange={(e) => setKbSummary(e.target.value)}
                placeholder="Short summary"
                className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <textarea
                rows={3}
                value={kbContent}
                onChange={(e) => setKbContent(e.target.value)}
                placeholder="Resolution steps or troubleshooting guide..."
                className="w-full p-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  Publish Article
                </Button>
              </div>
            </form>
          </Surface>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.kbArticles.map((art) => (
              <Surface key={art.id} className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase text-[#DC2626]">{art.category}</div>
                <div className="text-sm font-bold">{art.title}</div>
                {art.summary && <div className="text-xs text-[#718096]">{art.summary}</div>}
                <p className="text-xs text-[#1C1917] dark:text-slate-300 pt-1 whitespace-pre-wrap">
                  {art.content}
                </p>
              </Surface>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsPanel() {
  const { principal } = useTenant();
  const { data, addDocument, signDocument, bumpDocumentVersion, deleteDocument } = useErpData();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentRecord['category']>('contract');
  const [referenceCode, setReferenceCode] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addDocument({
      title: title.trim(),
      category,
      referenceCode:
        referenceCode.trim().toUpperCase() ||
        `DOC-${String(data.documents.length + 1).padStart(3, '0')}`,
      ownerName: ownerName.trim() || principal.fullName,
      expiryDate: expiryDate || 'No expiry',
      version: 1,
      notes: '',
    });
    setTitle('');
    setReferenceCode('');
    setShowForm(false);
  };

  const columns: DataColumn<DocumentRecord>[] = [
    {
      key: 'ref',
      header: 'Reference & Rev',
      render: (r) => (
        <div>
          <span className="font-mono text-xs font-semibold">{r.referenceCode}</span>
          <div className="font-mono text-[11px] text-[#DC2626]">v{r.version ?? 1}.0</div>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Document Title & Sign-Off',
      render: (r) => (
        <div>
          <div className="font-semibold">{r.title}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400 uppercase">
            {r.category.replace('_', ' ')} · Owner: {r.ownerName}
          </div>
          {r.signedBy && (
            <div className="text-[11px] text-[#16B8A6] font-medium flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="h-3 w-3" />
              Signed by {r.signedBy}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'expiry',
      header: 'Renewal / Expiry',
      render: (r) => <span className="font-mono text-xs">{r.expiryDate}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => bumpDocumentVersion(r.id)}
            className="px-2 py-1 rounded text-[11px] font-medium text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer"
            title="Increment version revision"
          >
            +v{(r.version ?? 1) + 1}
          </button>
          {!r.signedBy && (
            <button
              type="button"
              onClick={() => signDocument(r.id, principal.fullName)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[#16B8A6] hover:bg-[#16B8A6]/10 cursor-pointer"
              title="Apply e-signature approval"
            >
              <FileSignature className="h-3 w-3" />
              Sign
            </button>
          )}
          <button
            type="button"
            onClick={() => deleteDocument(r.id)}
            className="p-1.5 text-[#718096] hover:text-red-600 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            Documents, Versioning & E-Signature
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Track versioned contracts, tax filings, SOPs, renewal dates, and operator sign-offs.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          Register Document
        </Button>
      </div>

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document Title *"
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentRecord['category'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              >
                <option value="contract">Contract</option>
                <option value="tax_gst">Tax / GST Filing</option>
                <option value="sop">SOP / Manual</option>
                <option value="hr_policy">HR Policy</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save Document
              </Button>
            </div>
          </form>
        </Surface>
      )}

      <DataTable
        data={data.documents}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search document title or reference..."
        searchPredicate={(r, q) =>
          `${r.title} ${r.referenceCode} ${r.category}`.toLowerCase().includes(q)
        }
        emptyTitle="No documents registered"
        emptyDescription="Register legal contracts, tax filings, and compliance policies with renewal dates and e-signatures."
        emptyActionLabel="Register Document"
        onEmptyAction={() => setShowForm(true)}
      />
    </div>
  );
}

function MarketingPanel() {
  const { activeCompany } = useTenant();
  const { data, addCampaign, deleteCampaign } = useErpData();
  const currency = activeCompany.baseCurrency;

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<MarketingCampaign['channel']>('email');
  const [targetStage, setTargetStage] = useState<NonNullable<MarketingCampaign['targetStage']>>('all');
  const [budget, setBudget] = useState('0');
  const [leadsCount, setLeadsCount] = useState('0');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const audienceCount = useMemo(() => {
    if (targetStage === 'all') return data.contacts.length;
    return data.contacts.filter((c) => c.stage === targetStage).length;
  }, [data.contacts, targetStage]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addCampaign({
      name: name.trim(),
      channel,
      status: 'active',
      targetStage,
      budget: Math.max(0, Number(budget) || 0),
      leadsCount: Math.max(0, Number(leadsCount) || 0),
      startDate,
    });
    setName('');
    setBudget('0');
    setLeadsCount('0');
    setShowForm(false);
  };

  const columns: DataColumn<MarketingCampaign>[] = [
    {
      key: 'name',
      header: 'Campaign & Segment',
      render: (r) => (
        <div>
          <div className="font-semibold">{r.name}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400 uppercase">
            {r.channel} · Segment: {r.targetStage ?? 'all'} · {r.startDate}
          </div>
        </div>
      ),
    },
    {
      key: 'budget',
      header: `Budget (${currency})`,
      align: 'right',
      numeric: true,
      render: (r) => <span>{formatNumericCurrency(r.budget, currency, 2)}</span>,
    },
    {
      key: 'leads',
      header: 'Leads',
      align: 'right',
      numeric: true,
      render: (r) => <span>{r.leadsCount}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => deleteCampaign(r.id)}
          className="p-1.5 text-[#718096] hover:text-red-600 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C1917] dark:text-slate-100">
            Marketing & Omnichannel Campaigns
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Segment live CRM contacts by pipeline stage across Email, SMS, WhatsApp, Social & Events.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Campaign Name *"
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as MarketingCampaign['channel'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="social">Social</option>
                <option value="search">Search / Ads</option>
                <option value="events">Events</option>
              </select>
              <select
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value as typeof targetStage)}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A] capitalize"
              >
                <option value="all">All CRM Contacts</option>
                <option value="lead">Leads</option>
                <option value="qualified">Qualified</option>
                <option value="proposal">Proposal</option>
                <option value="customer">Existing Customers</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder={`Budget (${currency})`}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  value={leadsCount}
                  onChange={(e) => setLeadsCount(e.target.value)}
                  placeholder="Leads Generated"
                  className="w-40 h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#141013] border border-slate-200 dark:border-[#32242A]"
                />
                <span className="text-xs text-[#DC2626] font-medium">
                  Audience Preview: {audienceCount} matching CRM contact{audienceCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save Campaign
                </Button>
              </div>
            </div>
          </form>
        </Surface>
      )}

      <DataTable
        data={data.campaigns}
        columns={columns}
        getRowKey={(r) => r.id}
        searchPlaceholder="Search campaign or channel..."
        searchPredicate={(r, q) => `${r.name} ${r.channel}`.toLowerCase().includes(q)}
        emptyTitle="No marketing campaigns yet"
        emptyDescription="Launch targeted campaigns segmented by CRM pipeline stage across email, SMS, WhatsApp, and events."
        emptyActionLabel="New Campaign"
        onEmptyAction={() => setShowForm(true)}
      />
    </div>
  );
}
