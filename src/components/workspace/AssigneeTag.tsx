interface AssigneeTagProps {
  name: string;
}

export default function AssigneeTag({ name }: AssigneeTagProps) {
  return (
    <span
      className="px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-text-secondary whitespace-nowrap"
      title={name === 'You' ? 'Assigned to you' : `Assigned to ${name}`}
    >
      {name}
    </span>
  );
}
