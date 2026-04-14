'use client';

import { useState } from 'react';
import { AccFolderBrowser } from '@/components/acc-folder-browser';
import { Button } from '@/components/ui/button';

type TaskFormProps = {
  projectId: string;
  onSubmit: (data: {
    projectId: string;
    name: string;
    taskType: 'PUBLISH_MODEL';
    targetModelId?: string;
    targetModelName?: string;
    scheduleCron?: string;
  }) => Promise<void>;
  onCancel: () => void;
  initialValues?: {
    name?: string;
    targetModelId?: string | null;
    targetModelName?: string | null;
    scheduleCron?: string | null;
  };
  isEditing?: boolean;
};

/** Parse cron "minute hour dayOfWeek" back to form values */
function parseCron(cron: string | null | undefined): { hour12: string; minute: string; ampm: 'AM' | 'PM'; days: number[] } {
  if (!cron) return { hour12: '9', minute: '0', ampm: 'AM', days: [1, 2, 3, 4, 5] };
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 2) return { hour12: '9', minute: '0', ampm: 'AM', days: [1, 2, 3, 4, 5] };
  const m = parseInt(parts[0]!, 10);
  const h = parseInt(parts[1]!, 10);
  const dayStr = parts[2] || '*';
  const ampm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const days = dayStr === '*' ? [0, 1, 2, 3, 4, 5, 6] : dayStr.split(',').map(d => parseInt(d, 10));
  return { hour12: String(h12), minute: String(m), ampm, days };
}

const DAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export function TaskForm({ projectId, onSubmit, onCancel, initialValues, isEditing }: TaskFormProps) {
  const parsed = parseCron(initialValues?.scheduleCron);
  const [name, setName] = useState(initialValues?.name || '');
  const [targetModelId, setTargetModelId] = useState(initialValues?.targetModelId || '');
  const [targetModelName, setTargetModelName] = useState(initialValues?.targetModelName || '');
  const [showBrowser, setShowBrowser] = useState(false);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm);

  const to24Hour = () => {
    let h = parseInt(hour12, 10);
    if (ampm === 'AM' && h === 12) h = 0;
    else if (ampm === 'PM' && h !== 12) h += 12;
    return h;
  };
  const [selectedDays, setSelectedDays] = useState<number[]>(parsed.days);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e['name'] = 'Task name is required';
    if (!targetModelId) e['model'] = 'Please select a target model';
    if (selectedDays.length === 0) e['days'] = 'Select at least one day';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const hour24 = to24Hour();
    const scheduleCron = `${minute} ${hour24} ${selectedDays.length === 7 ? '*' : selectedDays.join(',')}`;

    try {
      await onSubmit({
        projectId,
        name,
        taskType: 'PUBLISH_MODEL',
        targetModelId: targetModelId || undefined,
        targetModelName: targetModelName || undefined,
        scheduleCron,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Task Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 text-sm"
          placeholder="e.g., Daily Model Publish"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Target Model</label>
        {targetModelName ? (
          <div className="mt-1 flex items-center gap-2">
            <span className="flex-1 border border-slate-200 bg-slate-50 px-3 h-8 flex items-center text-sm text-slate-700 font-mono">
              📄 {targetModelName}
            </span>
            <Button
              type="button"
              variant="default"
              onClick={() => { setTargetModelId(''); setTargetModelName(''); setShowBrowser(true); }}
            >
              Change
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="default"
            onClick={() => setShowBrowser(true)}
            className="mt-1 w-full h-auto py-3 border-dashed justify-start"
          >
            Browse Forma to select a Revit model...
          </Button>
        )}
        {errors['model'] && <p className="mt-1 text-xs text-red-600">{errors['model']}</p>}
        {showBrowser && (
          <div className="mt-2">
            <AccFolderBrowser
              projectId={projectId}
              onSelect={(id, name) => {
                setTargetModelId(id);
                setTargetModelName(name);
                setShowBrowser(false);
              }}
              onCancel={() => setShowBrowser(false)}
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Schedule Time</label>
        <div className="mt-1.5 flex items-center gap-2">
          <select
            value={hour12}
            onChange={(e) => setHour12(e.target.value)}
            className="rounded-md px-3 py-2 text-sm"
          >
            {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
              <option key={h} value={String(h)}>{h}</option>
            ))}
          </select>
          <span className="text-sm text-slate-600">:</span>
          <select
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            className="rounded-md px-3 py-2 text-sm"
          >
            <option value="0">00</option>
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="45">45</option>
          </select>
          <select
            value={ampm}
            onChange={(e) => setAmpm(e.target.value as 'AM' | 'PM')}
            className="rounded-md px-3 py-2 text-sm font-medium"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Days</label>
        <div className="mt-1 flex gap-1">
          {DAYS.map((day) => (
            <Button
              key={day.value}
              type="button"
              variant={selectedDays.includes(day.value) ? 'primary' : 'default'}
              onClick={() => toggleDay(day.value)}
            >
              {day.label}
            </Button>
          ))}
        </div>
        {errors['days'] && <p className="mt-1 text-xs text-red-600">{errors['days']}</p>}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={submitting || !name || !targetModelId}>
          {submitting ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Task')}
        </Button>
        <Button type="button" variant="default" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
