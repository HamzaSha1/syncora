import { useState } from 'react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';

function toDatetimeLocal(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(localStr, timeZone) {
  // Convert local datetime string to ISO with timezone
  const d = new Date(localStr);
  return { dateTime: d.toISOString(), timeZone: timeZone || 'UTC' };
}

export default function EditEventModal({ event, onClose, onSaved, onDeleted }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [subject, setSubject] = useState(event.subject || '');
  const [startLocal, setStartLocal] = useState(toDatetimeLocal(event.start?.dateTime || event.start?.date));
  const [endLocal, setEndLocal] = useState(toDatetimeLocal(event.end?.dateTime || event.end?.date));
  const [location, setLocation] = useState(event.location?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.functions.invoke('updateEvent', {
      eventId: event.id,
      action: 'update',
      subject,
      start: fromDatetimeLocal(startLocal, tz),
      end: fromDatetimeLocal(endLocal, tz),
      location,
    });
    setSaving(false);
    onSaved?.();
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this event from your Outlook calendar?')) return;
    setDeleting(true);
    await base44.functions.invoke('updateEvent', { eventId: event.id, action: 'delete' });
    setDeleting(false);
    onDeleted?.();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start</Label>
              <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End</Label>
              <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="w-4 h-4 mr-1" />
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}