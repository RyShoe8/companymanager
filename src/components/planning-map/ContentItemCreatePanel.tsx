'use client';

import { useState } from 'react';
import { IProject } from '@/lib/models/Project';
import { IClient } from '@/lib/models/Client';
import { IEmployee } from '@/lib/models/Employee';
import CollapsibleInspectorSection from '@/components/ui/CollapsibleInspectorSection';
import ContentItemCreateForm from '@/components/planning-map/ContentItemCreateForm';

export interface ContentItemCreatePanelProps {
  project: IProject;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  clients?: IClient[];
  employees: IEmployee[];
  isManagerOrAdmin?: boolean;
  defaultPublishDate?: Date;
  initialTitle?: string;
  initialChannel?: string;
  initialNotes?: string;
  onSuccess: () => void;
  panelId?: string;
}

export default function ContentItemCreatePanel({
  project,
  expanded,
  onExpandedChange,
  clients = [],
  employees,
  isManagerOrAdmin = true,
  defaultPublishDate,
  initialTitle,
  initialChannel,
  initialNotes,
  onSuccess,
  panelId = 'content-create-panel',
}: ContentItemCreatePanelProps) {
  const [titleDraft, setTitleDraft] = useState('');

  const collapsedSummary = titleDraft.trim() || project.name;

  const handleCancel = () => {
    onExpandedChange(false);
  };

  const handleSuccess = () => {
    onSuccess();
    onExpandedChange(false);
    setTitleDraft('');
  };

  return (
    <CollapsibleInspectorSection
      id={panelId}
      title="Add Content"
      expanded={expanded}
      onToggle={() => onExpandedChange(!expanded)}
      collapsedSummary={collapsedSummary}
    >
      <ContentItemCreateForm
        project={project}
        clients={clients}
        employees={employees}
        isManagerOrAdmin={isManagerOrAdmin}
        defaultPublishDate={defaultPublishDate}
        initialTitle={initialTitle}
        initialChannel={initialChannel}
        initialNotes={initialNotes}
        active={expanded}
        onCancel={handleCancel}
        onSuccess={handleSuccess}
        onTitleDraftChange={setTitleDraft}
      />
    </CollapsibleInspectorSection>
  );
}
