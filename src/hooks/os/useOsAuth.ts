'use client';

import { useCallback, useEffect, useState } from 'react';

type OsRole = 'Administrator' | 'Manager' | 'User' | null;

export interface OsAuthState {
    loading: boolean;
    userId: string | null;
    email: string | null;
    name: string | null;
    profilePicture: string | null;
    isAdmin: boolean;
    employeeId: string | null;
    role: OsRole;
    isManagerOrAdmin: boolean;
    error: string | null;
    refetch: () => void;
}

interface MeResponse {
    id: string;
    email?: string;
    name?: string;
    profilePicture?: string | null;
    isAdmin?: boolean;
}

interface EmployeeResponse {
    _id: string;
    userId?: string;
    email?: string;
    name?: string;
    role?: 'Administrator' | 'Manager' | 'User';
}

const initialState: Omit<OsAuthState, 'refetch'> = {
    loading: true,
    userId: null,
    email: null,
    name: null,
    profilePicture: null,
    isAdmin: false,
    employeeId: null,
    role: null,
    isManagerOrAdmin: false,
    error: null,
};

/**
 * Minimal auth hook for the OS shell. Mirrors the `/api/auth/me` +
 * `/api/employees` join used by useWorkspaceData but returns only the
 * fields the OS shell needs (identity + role).
 */
export function useOsAuth(): OsAuthState {
    const [state, setState] = useState<Omit<OsAuthState, 'refetch'>>(initialState);
    const [refreshToken, setRefreshToken] = useState(0);

    const refetch = useCallback(() => setRefreshToken((t) => t + 1), []);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const [meRes, empsRes] = await Promise.all([
                    fetch('/api/auth/me'),
                    fetch('/api/employees'),
                ]);

                if (!meRes.ok) {
                    if (!cancelled) {
                        setState({
                            ...initialState,
                            loading: false,
                            error: `auth/me ${meRes.status}`,
                        });
                    }
                    return;
                }

                const me = (await meRes.json()) as MeResponse;
                const employees = empsRes.ok
                    ? ((await empsRes.json()) as EmployeeResponse[])
                    : [];

                const employee =
                    employees.find((e) => e.userId === me.id) ??
                    employees.find((e) => !!me.email && e.email === me.email) ??
                    null;

                const role: OsRole = employee?.role ?? null;
                const isManagerOrAdmin = role === 'Administrator' || role === 'Manager';

                if (!cancelled) {
                    setState({
                        loading: false,
                        userId: me.id,
                        email: me.email ?? null,
                        name: me.name ?? null,
                        profilePicture: me.profilePicture ?? null,
                        isAdmin: Boolean(me.isAdmin),
                        employeeId: employee?._id ?? null,
                        role,
                        isManagerOrAdmin,
                        error: null,
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setState({
                        ...initialState,
                        loading: false,
                        error: err instanceof Error ? err.message : 'unknown',
                    });
                }
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [refreshToken]);

    return { ...state, refetch };
}
