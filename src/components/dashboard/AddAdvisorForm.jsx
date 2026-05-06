import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

export default function AddAdvisorForm({ projectId, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    role: '',
    el_start_date: '',
    duration_months: '',
    pause_start_date: '',
    pause_resume_date: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      name: form.name.trim(),
      role: form.role.trim(),
      project_id: projectId,
      el_start_date: form.el_start_date,
      duration_months: parseFloat(form.duration_months),
    };
    if (form.pause_start_date) data.pause_start_date = form.pause_start_date;
    if (form.pause_resume_date) data.pause_resume_date = form.pause_resume_date;
    onSave(data);
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-3 space-y-2 bg-secondary/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-foreground">New Advisor</span>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Name</label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} required className="h-7 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Role</label>
          <Input value={form.role} onChange={(e) => set('role', e.target.value)} required className="h-7 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">EL Start Date</label>
          <Input type="date" value={form.el_start_date} onChange={(e) => set('el_start_date', e.target.value)} required className="h-7 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Duration (months)</label>
          <Input type="number" min="1" value={form.duration_months} onChange={(e) => set('duration_months', e.target.value)} required className="h-7 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Pause Start (optional)</label>
          <Input type="date" value={form.pause_start_date} onChange={(e) => set('pause_start_date', e.target.value)} className="h-7 text-xs" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Pause Resume (optional)</label>
          <Input type="date" value={form.pause_resume_date} onChange={(e) => set('pause_resume_date', e.target.value)} className="h-7 text-xs" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" className="h-7 text-xs">Add Advisor</Button>
      </div>
    </form>
  );
}