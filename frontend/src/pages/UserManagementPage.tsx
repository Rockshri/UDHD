import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  useCreateUserMutation,
  useListUsersQuery,
  useUpdateUserMutation,
} from '../app/api/usersApi';
import { useAppSelector } from '../app/hooks';
import { selectCurrentUser } from '../features/auth/authSlice';
import { RoleGate } from '../components/auth/RoleGate';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { FormField } from '../components/input-sheet/FormField';
import { cn } from '../lib/utils';
import { formatDate } from '../lib/formatters';
import type { CreateUserPayload, UpdateUserPayload, UserRole, UserRow } from '../types/api';

const ROLE_TONE: Record<UserRole, string> = {
  MD: 'bg-[#F0F4F8] text-[#1E3A5F] border-[#93C5FD]',
  Admin: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#93C5FD]',
  Viewer: 'bg-[#F9FAFB] text-[#6B7280] border-[#E5E7EB]',
};

export function UserManagementPage(): JSX.Element {
  const me = useAppSelector(selectCurrentUser);
  const { data, isLoading } = useListUsersQuery();
  const [createUser, createState] = useCreateUserMutation();
  const [updateUser, updateState] = useUpdateUserMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const busy = createState.isLoading || updateState.isLoading;

  const canPromote = me?.role === 'MD';
  const rolesAvailable: UserRole[] = canPromote ? ['MD', 'Admin', 'Viewer'] : ['Viewer'];

  const rows = useMemo(() => data?.items ?? [], [data]);
  const usersById = useMemo(() => {
    const map = new Map<number, UserRow>();
    for (const r of rows) map.set(r.userId, r);
    return map;
  }, [rows]);

  return (
    <RoleGate
      allow={['MD', 'Admin']}
      fallback={
        <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm">
          <p className="font-semibold text-[#B91C1C]">
            You don't have permission to manage users.
          </p>
          <NavLink to="/" className="mt-2 inline-block text-[#1D4ED8] hover:underline">
            ← Back to overview
          </NavLink>
        </div>
      }
    >
      <article className="space-y-4">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#111827]">User Management</h1>
            <p className="text-[12.5px] text-[#6B7280]">
              {me?.role === 'MD'
                ? 'Full control: create any role, toggle project CRUD flags, deactivate.'
                : 'Admin scope: create/edit Viewer users only. Grant them project CRUD flags as needed.'}
            </p>
          </div>
          <Button onClick={() => setAddOpen((o) => !o)} disabled={busy}>
            {addOpen ? '× Close form' : `+ Add ${canPromote ? 'User' : 'Viewer'}`}
          </Button>
        </header>

        {addOpen ? (
          <UserForm
            mode="create"
            rolesAvailable={rolesAvailable}
            canPromote={canPromote}
            busy={busy}
            onCancel={() => setAddOpen(false)}
            onSubmit={async (payload) => {
              await createUser(payload as CreateUserPayload).unwrap();
              setAddOpen(false);
            }}
          />
        ) : null}

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="bg-[#F9FAFB] text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280]">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Username</th>
                      <th className="px-3 py-2 text-left">Full name</th>
                      <th className="px-3 py-2 text-left">Role</th>
                      <th className="px-3 py-2 text-center">Create</th>
                      <th className="px-3 py-2 text-center">Update</th>
                      <th className="px-3 py-2 text-center">Delete</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Created by</th>
                      <th className="px-3 py-2 text-left">Last login</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u, idx) => {
                      const canEdit =
                        me?.role === 'MD' || (me?.role === 'Admin' && u.role === 'Viewer');
                      const isSelf = me?.userId === u.userId;
                      const createdByLabel = u.createdBy
                        ? usersById.get(u.createdBy)?.username ?? `#${u.createdBy}`
                        : '—';
                      return (
                        <tr
                          key={u.userId}
                          className={cn(
                            'border-b border-[#F3F4F6]',
                            idx % 2 === 1 && 'bg-[#FAFAFA]',
                            u.isActive === false && 'opacity-60',
                          )}
                        >
                          <td className="px-3 py-2 text-[#9CA3AF]">{idx + 1}</td>
                          <td className="px-3 py-2 font-semibold text-[#111827]">
                            {u.username}
                            {isSelf ? (
                              <span className="ml-1 text-[10px] text-[#1D4ED8]">(you)</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-[#374151]">{u.fullName ?? '—'}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'inline-flex rounded border px-2 py-0.5 text-[10.5px] font-bold',
                                ROLE_TONE[u.role],
                              )}
                            >
                              {u.role}
                            </span>
                          </td>
                          <PermCell
                            enabled={u.role === 'MD' || u.canCreateProjects}
                            bypassed={u.role === 'MD'}
                          />
                          <PermCell
                            enabled={u.role === 'MD' || u.canUpdateProjects}
                            bypassed={u.role === 'MD'}
                          />
                          <PermCell
                            enabled={u.role === 'MD' || u.canDeleteProjects}
                            bypassed={u.role === 'MD'}
                          />
                          <td className="px-3 py-2">
                            {u.isActive ? (
                              <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10.5px] font-semibold text-[#15803D]">
                                Active
                              </span>
                            ) : (
                              <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10.5px] font-semibold text-[#B91C1C]">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[#6B7280]">{createdByLabel}</td>
                          <td className="px-3 py-2 tabular-nums text-[#6B7280]">
                            {formatDate(u.lastLogin)}
                          </td>
                          <td className="px-3 py-2">
                            {canEdit ? (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setEditing(u)}
                                disabled={busy}
                              >
                                Edit
                              </Button>
                            ) : (
                              <span className="text-[10.5px] text-[#9CA3AF]">Read-only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {editing ? (
          <UserForm
            mode="edit"
            initial={editing}
            rolesAvailable={rolesAvailable}
            canPromote={canPromote}
            busy={busy}
            isSelf={me?.userId === editing.userId}
            onCancel={() => setEditing(null)}
            onSubmit={async (payload) => {
              await updateUser({ userId: editing.userId, body: payload as UpdateUserPayload }).unwrap();
              setEditing(null);
            }}
          />
        ) : null}
      </article>
    </RoleGate>
  );
}

function PermCell({
  enabled,
  bypassed,
}: {
  enabled: boolean;
  bypassed: boolean;
}): JSX.Element {
  if (bypassed) {
    return (
      <td className="px-3 py-2 text-center">
        <span
          className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10.5px] font-bold text-[#1D4ED8]"
          title="MD role bypasses granular flags — always allowed."
        >
          MD ★
        </span>
      </td>
    );
  }
  return (
    <td className="px-3 py-2 text-center">
      {enabled ? (
        <span className="text-[#15803D]" aria-label="Enabled">
          ✓
        </span>
      ) : (
        <span className="text-[#B91C1C]" aria-label="Disabled">
          ✕
        </span>
      )}
    </td>
  );
}

interface FormPayload {
  username?: string;
  password?: string;
  fullName?: string | null;
  role?: UserRole;
  isActive?: boolean;
  canCreateProjects?: boolean;
  canUpdateProjects?: boolean;
  canDeleteProjects?: boolean;
}

interface UserFormProps {
  mode: 'create' | 'edit';
  initial?: UserRow;
  rolesAvailable: UserRole[];
  canPromote: boolean;
  busy: boolean;
  isSelf?: boolean;
  onCancel: () => void;
  onSubmit: (payload: FormPayload) => Promise<void>;
}

function UserForm({
  mode,
  initial,
  rolesAvailable,
  canPromote,
  busy,
  isSelf,
  onCancel,
  onSubmit,
}: UserFormProps): JSX.Element {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'Viewer');
  const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);
  const [canCreate, setCanCreate] = useState<boolean>(initial?.canCreateProjects ?? false);
  const [canUpdate, setCanUpdate] = useState<boolean>(initial?.canUpdateProjects ?? false);
  const [canDelete, setCanDelete] = useState<boolean>(initial?.canDeleteProjects ?? false);
  const [error, setError] = useState<string | null>(null);

  const canEditRole = mode === 'create' ? true : canPromote && !isSelf;

  const submit = async (): Promise<void> => {
    setError(null);
    if (mode === 'create' && username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (mode === 'create' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (mode === 'edit' && password && password.length < 8) {
      setError('Password must be at least 8 characters (or leave blank to keep unchanged).');
      return;
    }

    const payload: FormPayload = {
      fullName: fullName.trim() || null,
      canCreateProjects: canCreate,
      canUpdateProjects: canUpdate,
      canDeleteProjects: canDelete,
    };
    if (mode === 'create') {
      payload.username = username.trim();
      payload.password = password;
      payload.role = role;
    } else {
      if (password) payload.password = password;
      if (canEditRole) payload.role = role;
      payload.isActive = isActive;
    }

    try {
      await onSubmit(payload);
    } catch (err) {
      setError(readError(err));
    }
  };

  const isMdRole = role === 'MD';

  return (
    <div className="space-y-3 rounded-lg border border-[#93C5FD] bg-[#F0F7FF] p-4">
      <h2 className="text-sm font-bold text-[#1D4ED8]">
        {mode === 'create' ? 'Create user' : `Edit ${initial?.username}`}
      </h2>

      {error ? (
        <div className="rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {mode === 'create' ? (
          <FormField
            label="Username"
            value={username}
            onChange={setUsername}
            required
            hint="3–60 characters, unique."
          />
        ) : (
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#374151]">
              Username
            </div>
            <div className="mt-1 flex h-9 items-center rounded border border-[#E5E7EB] bg-[#F9FAFB] px-3 text-[13px] text-[#6B7280]">
              {initial?.username}
              <span className="ml-2 text-[10.5px]">(not editable)</span>
            </div>
          </div>
        )}
        <FormField label="Full name" value={fullName} onChange={setFullName} />
        <FormField
          label={mode === 'create' ? 'Password' : 'New password (blank = unchanged)'}
          value={password}
          onChange={setPassword}
          required={mode === 'create'}
          hint="Minimum 8 characters."
        />
        <FormField
          label="Role"
          type="select"
          value={role}
          onChange={(v) => setRole(v as UserRole)}
          options={rolesAvailable as unknown as string[]}
          disabled={!canEditRole}
          hint={!canEditRole ? (isSelf ? "Can't change your own role." : 'Admin cannot promote roles.') : ''}
        />
        {mode === 'edit' ? (
          <FormField
            label="Status"
            type="select"
            value={isActive ? 'Active' : 'Inactive'}
            onChange={(v) => setIsActive(v === 'Active')}
            options={['Active', 'Inactive']}
            disabled={isSelf ?? false}
            hint={isSelf ? "Can't deactivate yourself." : ''}
          />
        ) : null}
      </div>

      <div className="rounded border border-[#E5E7EB] bg-white p-3">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#374151]">
          ▌ Project CRUD permissions
        </div>
        {isMdRole ? (
          <p className="mt-1 text-[12px] text-[#1D4ED8]">
            💡 MD role bypasses these flags — always allowed to create/update/delete any project.
          </p>
        ) : (
          <p className="mt-1 text-[12px] text-[#6B7280]">
            Toggle each action independently. Admin role always keeps all three on by default.
          </p>
        )}
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
          <PermToggle
            label="Can create projects"
            checked={canCreate || isMdRole}
            disabled={isMdRole}
            onChange={setCanCreate}
          />
          <PermToggle
            label="Can update projects"
            checked={canUpdate || isMdRole}
            disabled={isMdRole}
            onChange={setCanUpdate}
          />
          <PermToggle
            label="Can delete projects"
            checked={canDelete || isMdRole}
            disabled={isMdRole}
            onChange={setCanDelete}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[#BFDBFE] pt-3">
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : mode === 'create' ? 'Create user' : 'Save changes'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PermToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded border px-3 py-2 text-[12.5px]',
        checked
          ? 'border-[#86EFAC] bg-[#F0FDF4] text-[#15803D]'
          : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]',
        disabled && 'cursor-not-allowed opacity-70',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-[#D1D5DB]"
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}

function readError(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const e = (data as { error?: { message?: string } }).error;
      if (e?.message) return e.message;
    }
  }
  return 'Something went wrong. Please retry.';
}
