import { useState } from 'react';
import type { LeaveEntry } from '../types';
import { formatHuman } from '../dates';
import { validateLeave } from '../validation';

interface Props {
  leave: LeaveEntry[];
  onChange: (leave: LeaveEntry[]) => void;
}

function blankEntry(): LeaveEntry {
  return { id: crypto.randomUUID(), start: '', end: '', hours: NaN, label: '' };
}

export default function LeaveList({ leave, onChange }: Props) {
  const [draft, setDraft] = useState<LeaveEntry>(blankEntry);

  const draftErrors = validateLeave(draft);
  const canAdd =
    draft.start !== '' &&
    draft.end !== '' &&
    Number.isFinite(draft.hours) &&
    Object.keys(draftErrors).length === 0;

  const addEntry = () => {
    if (!canAdd) return;
    onChange([...leave, draft]);
    setDraft(blankEntry());
  };

  const updateEntry = (id: string, patch: Partial<LeaveEntry>) => {
    onChange(leave.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEntry = (id: string) => onChange(leave.filter((e) => e.id !== id));

  const numberValue = (raw: string) => (raw.trim() === '' ? NaN : Number(raw));

  return (
    <section className="card" aria-labelledby="leave-heading">
      <h2 id="leave-heading">Planned leave</h2>

      {leave.length === 0 && (
        <p className="empty-note">No planned leave yet. Add an entry below.</p>
      )}

      <ul className="leave-items">
        {leave.map((entry) => {
          const errors = validateLeave(entry);
          return (
            <li key={entry.id} className="leave-item">
              <div className="leave-item-fields">
                <div className="field">
                  <label>Start</label>
                  <input
                    type="date"
                    value={entry.start}
                    onChange={(e) => updateEntry(entry.id, { start: e.target.value })}
                    aria-invalid={!!errors.start}
                  />
                </div>
                <div className="field">
                  <label>End</label>
                  <input
                    type="date"
                    value={entry.end}
                    onChange={(e) => updateEntry(entry.id, { end: e.target.value })}
                    aria-invalid={!!errors.end}
                  />
                </div>
                <div className="field">
                  <label>Hours</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={Number.isFinite(entry.hours) ? entry.hours : ''}
                    onChange={(e) =>
                      updateEntry(entry.id, { hours: numberValue(e.target.value) })
                    }
                    aria-invalid={!!errors.hours}
                  />
                </div>
                <div className="field field-grow">
                  <label>Label (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Summer holiday"
                    value={entry.label ?? ''}
                    onChange={(e) => updateEntry(entry.id, { label: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-danger leave-remove"
                  onClick={() => removeEntry(entry.id)}
                  aria-label="Delete leave entry"
                >
                  Delete
                </button>
              </div>
              {(errors.start || errors.end || errors.hours) && (
                <p className="field-error">{errors.start ?? errors.end ?? errors.hours}</p>
              )}
              {Object.keys(errors).length === 0 && (
                <p className="leave-summary">
                  {formatHuman(entry.start)} → {formatHuman(entry.end)} · {entry.hours}h
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="leave-add">
        <h3>Add leave</h3>
        <div className="leave-item-fields">
          <div className="field">
            <label htmlFor="draft-start">Start</label>
            <input
              id="draft-start"
              type="date"
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="draft-end">End</label>
            <input
              id="draft-end"
              type="date"
              value={draft.end}
              onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="draft-hours">Hours</label>
            <input
              id="draft-hours"
              type="number"
              inputMode="decimal"
              step="any"
              value={Number.isFinite(draft.hours) ? draft.hours : ''}
              onChange={(e) => setDraft({ ...draft, hours: numberValue(e.target.value) })}
            />
          </div>
          <div className="field field-grow">
            <label htmlFor="draft-label">Label (optional)</label>
            <input
              id="draft-label"
              type="text"
              placeholder="e.g. Summer holiday"
              value={draft.label ?? ''}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary leave-remove"
            onClick={addEntry}
            disabled={!canAdd}
          >
            Add
          </button>
        </div>
        {draft.start !== '' && draft.end !== '' && draftErrors.end && (
          <p className="field-error">{draftErrors.end}</p>
        )}
      </div>
    </section>
  );
}
