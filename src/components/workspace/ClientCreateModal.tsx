'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { IClient } from '@/lib/models/Client';

interface ClientCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (client: IClient) => void;
}

export default function ClientCreateModal({ isOpen, onClose, onSuccess }: ClientCreateModalProps) {
    const [name, setName] = useState('');
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Client name is required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    contactName: contactName.trim(),
                    contactEmail: contactEmail.trim(),
                    contactPhone: contactPhone.trim(),
                    color,
                    status: 'active',
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to create client');
            }

            const client = await res.json();
            
            // Reset state
            setName('');
            setContactName('');
            setContactEmail('');
            setContactPhone('');
            setColor('#3b82f6');
            
            onSuccess?.(client);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create client');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Client" maxWidth="md">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                    <div className="p-3 bg-error-light border border-error/30 text-error rounded-md text-sm">
                        {error}
                    </div>
                )}
                
                <Input
                    label="Client Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Acme Corp"
                />

                <Input
                    label="Primary Contact Name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                />

                <Input
                    label="Contact Email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="e.g. jane@acme.com"
                />

                <Input
                    label="Contact Phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="e.g. +1 555-0123"
                />

                <div className="space-y-1">
                    <label className="block text-sm font-medium text-text-primary">
                        Brand Color
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-10 h-10 rounded border border-border cursor-pointer bg-transparent p-0 overflow-hidden"
                        />
                        <span className="text-sm text-text-secondary">{color}</span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={saving || !name.trim()}>
                        {saving ? 'Creating...' : 'Create Client'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
