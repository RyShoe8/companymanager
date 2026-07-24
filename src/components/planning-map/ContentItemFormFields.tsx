'use client';

import type { ReactNode } from 'react';
import { IEmployee } from '@/lib/models/Employee';
import { ContentChannel, ContentStatus, DistributionMethod } from '@/lib/models/ContentItem';
import Input from '@/components/ui/Input';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { DISTRIBUTION_METHODS } from '@/lib/constants/contentDistribution';
import { formInputClass, formInputClassInspector } from '@/components/ui/formClasses';
import { CONTENT_CHANNELS, CONTENT_STATUSES } from '@/components/planning-map/contentItemFormConstants';
import RecurrenceFields from '@/components/shared/RecurrenceFields';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';

function InspectorFormField({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">{label}</span>
      {children}
      {hint}
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  children,
  labelClassName = 'block text-sm font-medium text-text-primary',
  inputClassName = formInputClass,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  labelClassName?: string;
  inputClassName?: string;
}) {
  return (
    <label className={labelClassName}>
      {label}
      <select value={value} onChange={onChange} className={inputClassName}>
        {children}
      </select>
    </label>
  );
}

function DistributionSection({
  distributionMethods,
  onToggle,
  inspectorStyled = false,
  compact = false,
}: {
  distributionMethods: DistributionMethod[];
  onToggle: (method: DistributionMethod) => void;
  inspectorStyled?: boolean;
  compact?: boolean;
}) {
  const labelClass = inspectorStyled
    ? 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'
    : 'block text-sm font-medium text-text-primary mb-2';
  const chipClass = compact
    ? 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors'
    : 'inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full border cursor-pointer transition-colors';
  return (
    <div>
      <span className={labelClass}>Distribution methods</span>
      <div className="flex flex-wrap gap-1.5">
        {DISTRIBUTION_METHODS.map((method) => {
          const checked = distributionMethods.includes(method);
          return (
            <label
              key={method}
              className={`${chipClass} ${
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
  const hintClass = inspectorStyled
    ? 'text-xs text-gray-500 dark:text-gray-400 mt-0.5'
    : 'text-xs text-text-secondary mt-1';

  const useInspectorFields = compactLayout && inspectorStyled;
  const inputClass = useInspectorFields ? formInputClassInspector : formInputClass;

  const hoursHint =
    isEstimatingHours ? (
      <p className={`${hintClass} italic`}>Estimating…</p>
    ) : (
      !estimatedHours.trim() && estimatedHoursHint && (
        <p className={hintClass}>{estimatedHoursHint}</p>
      )
    );

  if (useInspectorFields) {
    const showRecurrence = repeatPreset != null && onRepeatPresetChange != null;

    return (
      <div className="space-y-2">
        <InspectorFormField label="Title *">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Content title"
            autoFocus={titleAutoFocus}
            className={formInputClassInspector}
          />
        </InspectorFormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <InspectorFormField label="Channel *">
            <select
              value={channel}
              onChange={(e) => onChannelChange(e.target.value as ContentChannel)}
              className={formInputClassInspector}
            >
              {CONTENT_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </InspectorFormField>
          <InspectorFormField label="Status">
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as ContentStatus)}
              className={formInputClassInspector}
            >
              {CONTENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </InspectorFormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <InspectorFormField label="Publish date">
            <input
              type="date"
              value={publishDate}
              onChange={(e) => onPublishDateChange(e.target.value)}
              className={formInputClassInspector}
            />
          </InspectorFormField>
          {showRecurrence && (
            <RecurrenceFields
              repeatPreset={repeatPreset}
              onRepeatPresetChange={onRepeatPresetChange}
              inputClass={formInputClassInspector}
              anchorDate={recurrenceAnchorDate}
              occurrenceLabel="content items"
              inspectorStyled
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <InspectorFormField label="Assignee">
            <select
              value={assignedToEmployeeId}
              onChange={(e) => onAssignedToEmployeeIdChange(e.target.value)}
              className={formInputClassInspector}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((emp) => (
                <option key={emp._id.toString()} value={emp._id.toString()}>
                  {emp.name}
                </option>
              ))}
            </select>
          </InspectorFormField>
          <InspectorFormField label="Estimated hours" hint={hoursHint}>
            <input
              type="number"
              step="0.5"
              min="0"
              value={estimatedHours}
              onChange={(e) => onEstimatedHoursChange(e.target.value)}
              className={formInputClassInspector}
            />
          </InspectorFormField>
        </div>
        <InspectorFormField label="Optional notes">
          <AutoGrowTextarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add context for this content item"
            minRows={2}
            className={`${formInputClassInspector} whitespace-pre-wrap`}
          />
        </InspectorFormField>
        <DistributionSection
          distributionMethods={distributionMethods}
          onToggle={onToggleDistribution}
          inspectorStyled
          compact
        />
        {children}
      </div>
    );
  }

  const channelSelect = (
    <FormSelect
      label="Channel *"
      value={channel}
      onChange={(e) => onChannelChange(e.target.value as ContentChannel)}
      labelClassName={labelClass}
      inputClassName={inputClass}
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
      inputClassName={inputClass}
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
        className={inputClass}
      />
    </label>
  );

  const assigneeSelect = (
    <FormSelect
      label="Assignee"
      value={assignedToEmployeeId}
      onChange={(e) => onAssignedToEmployeeIdChange(e.target.value)}
      labelClassName={labelClass}
      inputClassName={inputClass}
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
      <span className={`${labelClass} mb-1 block`}>Optional notes</span>
      <AutoGrowTextarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Add context for this content item"
      />
    </div>
  );

  const estimatedHoursField = (
    <div>
      <Input
        label="Estimated hours"
        type="number"
        step="0.5"
        min="0"
        value={estimatedHours}
        onChange={(e) => onEstimatedHoursChange(e.target.value)}
      />
      {hoursHint}
    </div>
  );

  if (compactLayout) {
    const showRecurrence = repeatPreset != null && onRepeatPresetChange != null;

    return (
      <div className="space-y-2">
        <Input
          label="Title *"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Content title"
          autoFocus={titleAutoFocus}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {channelSelect}
          {statusSelect}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {publishDateField}
          {showRecurrence && (
            <RecurrenceFields
              repeatPreset={repeatPreset}
              onRepeatPresetChange={onRepeatPresetChange}
              inputClass={inputClass}
              anchorDate={recurrenceAnchorDate}
              occurrenceLabel="content items"
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {assigneeSelect}
          {estimatedHoursField}
        </div>
        {notesField}
        <DistributionSection
          distributionMethods={distributionMethods}
          onToggle={onToggleDistribution}
        />
        {children}
      </div>
    );
  }

  return (
    <>
      <Input
        label="Title *"
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Content title"
        autoFocus={titleAutoFocus}
      />
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
