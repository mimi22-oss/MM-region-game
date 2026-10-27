import React, { useEffect, useRef } from 'react';
import WardVillageEditor from './WardVillageEditor';
import type { Point2 } from '../game/worldLayout';
import './WardVillageEditorDialog.css';

export default function WardVillageEditorDialog({
  focus,
  onClose,
}: {
  focus: Point2;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    return () => {
      if (node.open) node.close();
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    // If clicking outside the dialog content on the backdrop
    if (e.target === dialog.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialog}
      className="ward-editor-dialog"
      aria-label="2D Map Editor"
      onClick={handleBackdropClick}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <WardVillageEditor initialCenter={focus} onClose={onClose} />
    </dialog>
  );
}
