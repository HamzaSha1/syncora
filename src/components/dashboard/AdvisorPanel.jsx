import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, PenLine, Check, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format, parseISO } from 'date-fns';
import AdvisorTimeline from './AdvisorTimeline';
import AddAdvisorForm from './AddAdvisorForm';

export default function AdvisorPanel() {
  const [projects, setProjects] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddAdvisor, setShowAddAdvisor] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState('');
  const [editingAdvisor, setEditingAdvisor] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    Promise.all([
      base44.entities.Project.list('-created_date', 50),
      base44.entities.Advisor.list('-created_date', 200),
    ]).then(([projs, advs]) => {
      setProjects(projs);
      setAdvisors(advs);
      if (projs.length > 0) setActiveProjectId(projs[0].id);
      setLoading(false);
    });
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const projectAdvisors = advisors.filter((a) => a.project_id === activeProjectId);

  const addProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const proj = await base44.entities.Project.create({ name: newProjectName.trim() });
    setProjects((prev) => [...prev, proj]);
    setActiveProjectId(proj.id);
    setNewProjectName('');
    setShowAddProject(false);
  };

  const saveDeadline = async () => {
    const updated = await base44.entities.Project.update(activeProjectId, { submission_deadline: deadlineInput || null });
    setProjects((prev) => prev.map((p) => (p.id === activeProjectId ? updated : p)));
    setEditingDeadline(false);
  };

  const addAdvisor = async (data) => {
    const adv = await base44.entities.Advisor.create(data);
    setAdvisors((prev) => [...prev, adv]);
    setShowAddAdvisor(false);
  };

  const deleteAdvisor = async (id) => {
    await base44.entities.Advisor.delete(id);
    setAdvisors((prev) => prev.filter((a) => a.id !== id));
  };

  const startEditAdvisor = (adv) => {
    setEditingAdvisor(adv.id);
    setEditForm({
      name: adv.name,
      role: adv.role,
      el_start_date: adv.el_start_date || '',
      duration_months: adv.duration_months || '',
      pause_start_date: adv.pause_start_date || '',
      pause_resume_date: adv.pause_resume_date || '',
    });
  };

  const saveEditAdvisor = async (id) => {
    const data = {
      name: editForm.name,
      role: editForm.role,
      el_start_date: editForm.el_start_date,
      duration_months: parseFloat(editForm.duration_months),
      pause_start_date: editForm.pause_start_date || null,
      pause_resume_date: editForm.pause_resume_date || null,
    };
    const updated = await base44.entities.Advisor.update(id, data);
    setAdvisors((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setEditingAdvisor(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm text-foreground">Advisor Tracking</h2>
      </div>

      {/* Project tabs */}
      <div className="flex items-center gap-1 px-4 pt-2 pb-0 shrink-0 flex-wrap">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProjectId(p.id)}
            className={`px-3 py-1 rounded-t text-xs font-medium border-b-2 transition-colors ${
              activeProjectId === p.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.name}
          </button>
        ))}
        {showAddProject ? (
          <form onSubmit={addProject} className="flex items-center gap-1">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              autoFocus
              className="h-6 text-xs w-32"
            />
            <Button type="submit" size="icon" className="h-6 w-6"><Check className="w-3 h-3" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddProject(false)}>
              <X className="w-3 h-3" />
            </Button>
          </form>
        ) : (
          <button
            onClick={() => setShowAddProject(true)}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" /> Project
          </button>
        )}
      </div>

      <div className="border-b border-border shrink-0" />

      {!activeProject ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Create a project to get started.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Deadline row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Submission Deadline:</span>
            {editingDeadline ? (
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="h-6 text-xs w-36"
                  autoFocus
                />
                <Button size="icon" className="h-6 w-6" onClick={saveDeadline}><Check className="w-3 h-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingDeadline(false)}><X className="w-3 h-3" /></Button>
              </div>
            ) : (
              <button
                onClick={() => { setDeadlineInput(activeProject.submission_deadline || ''); setEditingDeadline(true); }}
                className="text-xs text-primary hover:underline"
              >
                {activeProject.submission_deadline
                  ? format(parseISO(activeProject.submission_deadline), 'MMM d, yyyy')
                  : 'Set deadline'}
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-emerald-400 inline-block" /> Active EL</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-yellow-400 inline-block" /> Paused</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-400 inline-block" /> Past EL / Deadline overage</span>
            <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-foreground inline-block" /> Today</span>
          </div>

          {/* Advisor rows */}
          {projectAdvisors.length === 0 && !showAddAdvisor && (
            <p className="text-xs text-muted-foreground text-center py-4">No advisors yet. Add one below.</p>
          )}

          {projectAdvisors.map((adv) => (
            <div key={adv.id} className="space-y-1">
              {editingAdvisor === adv.id ? (
                <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/30">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Name', key: 'name', type: 'text' },
                      { label: 'Role', key: 'role', type: 'text' },
                      { label: 'EL Start Date', key: 'el_start_date', type: 'date' },
                      { label: 'Duration (months)', key: 'duration_months', type: 'number' },
                      { label: 'Pause Start', key: 'pause_start_date', type: 'date' },
                      { label: 'Pause Resume', key: 'pause_resume_date', type: 'date' },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <label className="text-[10px] text-muted-foreground">{label}</label>
                        <Input
                          type={type}
                          value={editForm[key]}
                          onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingAdvisor(null)}>Cancel</Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => saveEditAdvisor(adv.id)}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="group space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-foreground">{adv.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">{adv.role}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditAdvisor(adv)} className="text-muted-foreground hover:text-foreground">
                        <PenLine className="w-3 h-3" />
                      </button>
                      <button onClick={() => deleteAdvisor(adv.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <AdvisorTimeline advisor={adv} projectDeadline={activeProject.submission_deadline} />
                </div>
              )}
            </div>
          ))}

          {showAddAdvisor && (
            <AddAdvisorForm
              projectId={activeProjectId}
              onSave={addAdvisor}
              onCancel={() => setShowAddAdvisor(false)}
            />
          )}

          {!showAddAdvisor && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs border-dashed"
              onClick={() => setShowAddAdvisor(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> Add Advisor
            </Button>
          )}
        </div>
      )}
    </div>
  );
}