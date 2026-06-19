'use client';

import { IEmployee } from '@/lib/models/Employee';
import { ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import Input from '@/components/ui/Input';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { DISTRIBUTION_METHODS } from '@/lib/constants/contentDistribution';
import { formInputClass } from '@/components/ui/formClasses';
import { CONTENT_CHANNELS, CONTENT_STATUSES } from '@/components/planning-map/contentItemFormConstants';
import RecurrenceFields from '@/components/shared/RecurrenceFields';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';

export function FormSelect({
  label,
  value,
  onChange,
  children,
  labelClassName = 'block text-sm font-medium text-text-primary',
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  labelClassName?: string;
}) {
  return (
    <label className={labelClassName}>
      {label}
      <select value={value} onChange={onChange} className={formInputClass}>
        {children}
      </select>
    </label>
  );
}

export function DistributionSection({
  distributionMethods,
  onToggle,
  inspectorStyled = false,
}: {
  distributionMethods: DistributionMethod[];
  onToggle: (method: DistributionMethod) => void;
  inspectorStyled?: boolean;
}) {
  const labelClass = inspectorStyled
    ? 'block text-sm font-medium text-gray-900 dark:text-white mb-2'
    : 'block text-sm font-medium text-text-primary mb-2';
  return (
    <div>
      <label className={labelClass}>Distribution methods</label>
      <div className="flex flex-wrap gap-2">
        {DISTRIBUTION_METHODS.map((method) => {
          const checked = distributionMethods.includes(method);
          return (
            <label
              key={method}
              className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full border cursor-pointer transition-colors ${
                checked
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-border bg-background-card text-text-secondary hover:bg-background-elevated'
              }`}
            >
              <input type="checkbox" checked={checked} onChange={() => onToggle(method)} className="sr-only" />
              {method}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ContentFormErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-error/30 bg-error-light px-3 py-2 text-sm text-error">
      {message}
    </div>
  );
}

export interface ContentItemFormFieldsProps {
  title: string;
  onTitleChange: (value: string) => void;
  titleAutoFocus?: boolean;
  inspectorStyled?: boolean;
  compactLayout?: boolean;
  repeatPreset?: RecurrencePreset;
  onRepeatPresetChange?: (preset: RecurrencePreset) => void;
  recurrenceAnchorDate?: Date;
  distributionMethods: DistributionMethod[];
  onToggleDistribution: (method: DistributionMethod) => void;
  channel: ContentChannel;
  onChannelChange: (value: ContentChannel) => void;
  status: ContentStatus;
  onStatusChange: (value: ContentStatus) => void;
  publishDate: string;
  onPublishDateChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  assignedToEmployeeId: string;
  onAssignedToEmployeeIdChange: (value: string) => void;
  assigneeOptions: IEmployee[];
  estimatedHours: string;
  onEstimatedHoursChange: (value: string) => void;
  isEstimatingHours?: boolean;
  estimatedHoursHint?: string;
  children?: React.ReactNode;
}

export default function ContentItemFormFields({
  title,
  onTitleChange,
  titleAutoFocus,
  distributionMethods,
  onToggleDistribution,
  channel,
  onChannelChange,
  status,
  onStatusChange,
  publishDate,
  onPublishDateChange,
  notes,
  onNotesChange,
  assignedToEmployeeId,
  onAssignedToEmployeeIdChange,
  assigneeOptions,
  estimatedHours,
  onEstimatedHoursChange,
  isEstimatingHours = false,
  estimatedHoursHint,
  children,
  inspectorStyled = false,
  compactLayout = false,
  repeatPreset,
  onRepeatPresetChange,
  recurrenceAnchorDate,
}: ContentItemFormFieldsProps) {
  const labelClass = inspectorStyled
    ? 'block text-sm font-medium text-gray-900 dark:text-white'
    : 'block text-sm font-medium text-text-primary';
  const subLabelClass = inspectorStyled
    ? 'block text-sm font-medium text-gray-900 dark:text-white mb-1'
    : 'block text-sm font-medium text-text-primary mb-1';
  const hintClass = inspectorStyled
    ? 'text-xs text-gray-500 dark:text-gray-400 mt-1'
    : 'text-xs text-text-secondary mt-1';

  const titleField = compactLayout && inspectorStyled ? (
    <label className={labelClass}>
      Title *
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Content title"
        autoFocus={titleAutoFocus}
        className={formInputClass}
      />
    </label>
  ) : (
    <Input
      label="Title *"
      type="text"
      value={title}
      onChange={(e) => onTitleChange(e.target.value)}
      placeholder="Content title"
      autoFocus={titleAutoFocus}
    />
  );

  const channelSelect = (
    <FormSelect
      label="Channel *"
      value={channel}
      onChange={(e) => onChannelChange(e.target.value as ContentChannel)}
      labelClassName={labelClass}
    >
      {CONTENT_CHANNELS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </FormSelect>
  );

  const statusSelect = (
    <FormSelect
      label="Status"
      value={status}
      onChange={(e) => onStatusChange(e.target.value as ContentStatus)}
      labelClassName={labelClass}
    >
      {CONTENT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace('_', ' ')}
        </option>
      ))}
    </FormSelect>
  );

  const publishDateField = (
    <label className={labelClass}>
      Publish date
      <input
        type="date"
        value={publishDate}
        onChange={(e) => onPublishDateChange(e.target.value)}
        className={formInputClass}
      />
    </label>
  );

  const assigneeSelect = (
    <FormSelect
      label="Assignee"
      value={assignedToEmployeeId}
      onChange={(e) => onAssignedToEmployeeIdChange(e.target.value)}
      labelClassName={labelClass}
    >
      <option value="">Unassigned</option>
      {assigneeOptions.map((emp) => (
        <option key={emp._id.toString()} value={emp._id.toString()}>
          {emp.name}
        </option>
      ))}
    </FormSelect>
  );

  const notesField = (
    <div>
      <label className={subLabelClass}>Optional notes</label>
      <AutoGrowTextarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Add context for this content item"
      />
    </div>
  );

  const estimatedHoursField = (
    <div>
      {compactLayout ? (
        <label className={labelClass}>
          Estimated hours
          <input
            type="number"
            step="0.5"
            min="0"
            value={estimatedHours}
            onChange={(e) => onEstimatedHoursChange(e.target.value)}
            className={`${formInputClass} max-w-[8rem]`}
          />
        </label>
      ) : (
        <Input
          label="Estimated hours"
          type="number"
          step="0.5"
          min="0"
          value={estimatedHours}
          onChange={(e) => onEstimatedHoursChange(e.target.value)}
        />
      )}
      {isEstimatingHours ? (
        <p className={`${hintClass} italic`}>Estimating…</p>
      ) : (
        !estimatedHours.trim() &&
        estimatedHoursHint && <p className={hintClass}>{estimatedHoursHint}</p>
      )}
    </div>
  );

  if (compactLayout) {
    const showRecurrence =
      repeatPreset != null && onRepeatPresetChange != null;

    return (
      <div className="space-y-3">
        {titleField}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {channelSelect}
          {statusSelect}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {publishDateField}
          {showRecurrence && (
            <RecurrenceFields
              repeatPreset={repeatPreset}
              onRepeatPresetChange={onRepeatPresetChange}
              inputClass={formInputClass}
              anchorDate={recurrenceAnchorDate}
              occurrenceLabel="content items"
              inspectorStyled={inspectorStyled}
            />
          )}
        </div>
        {assigneeSelect}
        {notesField}
        {estimatedHoursField}
        <DistributionSection
          distributionMethods={distributionMethods}
          onToggle={onToggleDistribution}
          inspectorStyled={inspectorStyled}
        />
        {children}
      </div>
    );
  }

  return (
    <>
      {titleField}
      <DistributionSection
        distributionMethods={distributionMethods}
        onToggle={onToggleDistribution}
        inspectorStyled={inspectorStyled}
      />
      {channelSelect}
      {statusSelect}
      {publishDateField}
      {assigneeSelect}
      {notesField}
      {estimatedHoursField}
      {children}
    </>
  );
}
