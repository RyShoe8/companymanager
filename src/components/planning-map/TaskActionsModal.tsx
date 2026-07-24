'use client';

import Modal from '@/components/ui/Modal';
import ModalAction from '@/components/ui/ModalAction';
import type { IProjectTask } from '@/lib/models/Project';

interface TaskActionsModalProps {
  isOpen: boolean;
  task: IProjectTask | undefined;
  isManagerOrAdmin: boolean;
  canDeleteTask: boolean;
  onClose: () => void;
  onSubmitForReview: () => void;
  onCompleteTask: () => void;
  onDeclineReview: () => void;
  onDeleteTask: () => void;
}

/** Task quick-actions menu (submit for review / complete / decline / delete), extracted from InlineProjectView. */
export default function TaskActionsModal({
  isOpen,
  task,
  isManagerOrAdmin,
  canDeleteTask,
  onClose,
  onSubmitForReview,
  onCompleteTask,
  onDeclineReview,
  onDeleteTask,
}: TaskActionsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={task ? task.name : 'Task Actions'}
      maxWidth="sm"
      elevated
      bodyPadding={false}
    >
      <div className="py-1">
        {task && (
          <>
            {task.status === 'active' && (
              <ModalAction
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
                label="Submit for Review"
                onClick={onSubmitForReview}
                variant="warning"
              />
            )}
            {task.status === 'in-review' && isManagerOrAdmin && (
              <>
                <ModalAction
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  }
                  label="Approve & Complete"
                  onClick={onCompleteTask}
                  variant="success"
                />
                <ModalAction
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  }
                  label="Decline Review"
                  onClick={onDeclineReview}
                  variant="danger"
                />
              </>
            )}
            {task.status !== 'completed' && (
              <ModalAction
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                }
                label="Mark Complete"
                onClick={onCompleteTask}
                variant="success"
              />
            )}
            {canDeleteTask && (
              <ModalAction
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                }
                label="Delete Task"
                onClick={onDeleteTask}
                variant="danger"
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
