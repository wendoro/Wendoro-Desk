import React, { useState } from 'react';
import { Banknote, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { DataColumn, DataTable } from '@/src/components/ui/DataTable';
import { Surface } from '@/src/components/ui/Surface';
import { useErpData } from '@/src/components/shell/ErpDataProvider';
import { useTenant } from '@/src/components/shell/TenantProvider';
import {
  DocumentRecord,
  EmployeeRecord,
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
  const { data, addEmployee, toggleEmployeeStatus, deleteEmployee, runMonthlyPayroll } =
    useErpData();
  const currency = activeCompany.baseCurrency;

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [designation, setDesignation] = useState('Specialist');
  const [monthlySalary, setMonthlySalary] = useState('0');
  const [payrollNotice, setPayrollNotice] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    addEmployee({
      employeeCode: `EMP-${String(data.employees.length + 1).padStart(3, '0')}`,
      fullName: fullName.trim(),
      email: email.trim(),
      department: department.trim() || 'Operations',
      designation: designation.trim() || 'Staff',
      monthlySalary: Math.max(0, Number(monthlySalary) || 0),
      status: 'active',
      joinedDate: new Date().toISOString().slice(0, 10),
    });
    setFullName('');
    setEmail('');
    setMonthlySalary('0');
    setShowForm(false);
  };

  const handleRunPayroll = () => {
    const total = runMonthlyPayroll();
    setPayrollNotice(
      total > 0
        ? `Posted ${formatNumericCurrency(total, currency, 2)} payroll run to Accounting Ledger.`
        : 'Add at least one active employee with a salary > 0 to run payroll.',
    );
  };

  const columns: DataColumn<EmployeeRecord>[] = [
    {
      key: 'code',
      header: 'ID & Employee',
      sortable: true,
      sortValue: (r) => r.fullName,
      render: (r) => (
        <div>
          <div className="font-semibold text-[#182238] dark:text-slate-100">
            {r.fullName}
          </div>
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
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.designation}
          </div>
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
        <button
          type="button"
          onClick={() => deleteEmployee(r.id)}
          className="p-1.5 text-[#718096] hover:text-red-600 cursor-pointer"
          aria-label={`Remove ${r.fullName}`}
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
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            HRMS & Payroll
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Manage staff records, leave statuses, and run monthly payroll directly into Accounting.
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
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work Email"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Department"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Role / Designation"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="number"
                step="0.01"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                placeholder={`Monthly Salary (${currency})`}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
        emptyDescription="Add team members to manage departments, attendance status, and payroll disbursements."
        emptyActionLabel="Add Employee"
        onEmptyAction={() => setShowForm(true)}
      />
    </div>
  );
}

function ProjectsPanel() {
  const { activeCompany } = useTenant();
  const { data, addProjectTask, updateProjectTaskStatus, deleteProjectTask } = useErpData();
  const currency = activeCompany.baseCurrency;

  const [showForm, setShowForm] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [title, setTitle] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [priority, setPriority] = useState<ProjectTask['priority']>('medium');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [budget, setBudget] = useState('0');

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
    });
    setTitle('');
    setBudget('0');
    setShowForm(false);
  };

  const columns: DataColumn<ProjectTask>[] = [
    {
      key: 'title',
      header: 'Task & Project',
      render: (r) => (
        <div>
          <div className="font-semibold text-[#182238] dark:text-slate-100">{r.title}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.projectName} · Assignee: {r.assigneeName}
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
          onChange={(e) =>
            updateProjectTaskStatus(r.id, e.target.value as ProjectTaskStatus)
          }
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Projects & Tasks
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Manage deliverables, team assignments, due dates, and task budgets.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
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
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task Title *"
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="text"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="Assignee"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProjectTask['priority'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder={`Budget (${currency})`}
                className="w-44 h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
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
    </div>
  );
}

function SupportPanel() {
  const { data, addSupportTicket, updateSupportTicketStatus, deleteSupportTicket } =
    useErpData();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [priority, setPriority] = useState<SupportTicket['priority']>('medium');
  const [notes, setNotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    addSupportTicket({
      subject: subject.trim(),
      customerName: customerName.trim() || 'General',
      priority,
      status: 'open',
      notes: notes.trim(),
    });
    setSubject('');
    setCustomerName('');
    setNotes('');
    setShowForm(false);
  };

  const columns: DataColumn<SupportTicket>[] = [
    {
      key: 'num',
      header: 'Ticket',
      render: (r) => <span className="font-mono text-xs font-semibold">{r.ticketNumber}</span>,
    },
    {
      key: 'subject',
      header: 'Subject & Customer',
      render: (r) => (
        <div>
          <div className="font-semibold">{r.subject}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400">
            {r.customerName} · Priority: {r.priority}
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
          onChange={(e) =>
            updateSupportTicketStatus(r.id, e.target.value as TicketStatus)
          }
          className="h-7 px-2 rounded-md text-xs bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Support Desk
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Log and resolve customer support tickets and service SLAs.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {showForm && (
        <Surface padding="lg">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Issue Subject *"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SupportTicket['priority'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ticket notes or details"
              className="w-full h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
            />
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
    </div>
  );
}

function DocumentsPanel() {
  const { data, addDocument, deleteDocument } = useErpData();
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
      ownerName: ownerName.trim() || 'Admin',
      expiryDate: expiryDate || 'No expiry',
      notes: '',
    });
    setTitle('');
    setReferenceCode('');
    setShowForm(false);
  };

  const columns: DataColumn<DocumentRecord>[] = [
    {
      key: 'ref',
      header: 'Reference',
      render: (r) => <span className="font-mono text-xs font-semibold">{r.referenceCode}</span>,
    },
    {
      key: 'title',
      header: 'Document Title',
      render: (r) => (
        <div>
          <div className="font-semibold">{r.title}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400 uppercase">
            {r.category.replace('_', ' ')} · Owner: {r.ownerName}
          </div>
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
        <button
          type="button"
          onClick={() => deleteDocument(r.id)}
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
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Documents & Compliance Register
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Track contracts, GST/tax filings, SOPs, and policy renewal dates.
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
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentRecord['category'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
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
        emptyDescription="Register legal contracts, tax filings, and compliance policies with renewal dates."
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
  const [budget, setBudget] = useState('0');
  const [leadsCount, setLeadsCount] = useState('0');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addCampaign({
      name: name.trim(),
      channel,
      status: 'active',
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
      header: 'Campaign',
      render: (r) => (
        <div>
          <div className="font-semibold">{r.name}</div>
          <div className="text-[11px] text-[#718096] dark:text-slate-400 uppercase">
            {r.channel} · {r.startDate}
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
          <h1 className="text-2xl font-bold tracking-tight text-[#182238] dark:text-slate-100">
            Marketing & Growth
          </h1>
          <p className="mt-1 text-xs text-[#718096] dark:text-slate-400">
            Plan outbound campaigns and measure lead generation cost across channels.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Campaign Name *"
                className="lg:col-span-2 h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as MarketingCampaign['channel'])}
                className="h-9 px-3 rounded-lg text-sm bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="social">Social</option>
                <option value="search">Search / Ads</option>
                <option value="events">Events</option>
              </select>
              <input
                type="number"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder={`Budget (${currency})`}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
            </div>
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={leadsCount}
                onChange={(e) => setLeadsCount(e.target.value)}
                placeholder="Leads Generated"
                className="w-44 h-9 px-3 rounded-lg text-sm font-mono bg-white dark:bg-[#0E172E] border border-slate-200 dark:border-[#223257]"
              />
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
        searchPredicate={(r, q) =>
          `${r.name} ${r.channel}`.toLowerCase().includes(q)
        }
        emptyTitle="No marketing campaigns yet"
        emptyDescription="Launch campaigns to track budgets and lead acquisition."
        emptyActionLabel="New Campaign"
        onEmptyAction={() => setShowForm(true)}
      />
    </div>
  );
}
