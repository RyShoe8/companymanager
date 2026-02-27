# Nucleas — Policy Source of Truth

All API guards, UI gating, and RBAC tests MUST derive from this document. Do not duplicate policy logic; reference this matrix.

---

## Role Model

- **User.isAdmin** — System-level admin (global). Set via `isAdminEmail()` in User model or manual flag. Used for: admin panel, org setup.
- **Employee.role** — Org-level role: `'Administrator' | 'Manager' | 'User'`. Source for project/task permissions.
- The User model has no `role` field. API middleware must: (1) resolve session → User → Employee for the org, (2) check `employee.role` for Manager/Administrator.

**"Manager"** = `Employee.role === 'Manager'`.  
**"Admin" (org-level)** = `Employee.role === 'Administrator'` or (where applicable) `User.isAdmin`.

---

## Canonical Policy Matrix

| Action | Who can do it |
|--------|----------------|
| **Task creation** | Managers, Administrators, and assigned project members only (not "any project member"). |
| **Task edit/delete** | Same as task creation, or stricter (e.g. creator only) — define per product. |
| **Task submit for review** | Assigned task owner. |
| **Task approve/decline review** | Managers and Administrators assigned to the project. |
| **Button create/edit** | Manager/Administrator or assigned project member (per product). |
| **Button delete** | Manager/Administrator only. |
| **Project creation** | Administrators and Managers only. |
| **Admin panel / org setup** | User.isAdmin (system admin). |

---

## Implementation

- API middleware: resolve Employee for the request's org, then check `employee.role` against this matrix.
- UI: gate actions using the same rules (e.g. hide "Create task" unless user is manager/admin or assigned to project).
- RBAC integration tests: generate cases from this matrix (each role × path combination).
