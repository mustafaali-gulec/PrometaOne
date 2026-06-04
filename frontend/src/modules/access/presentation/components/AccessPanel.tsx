/**
 * AccessPanel — "Roller ve Izinler" sekmesinin govdesi.
 *
 * Alt sekmeler: Roller / Atamalar / Override'lar / Etkin Izinler.
 * Her alt sekme kendi hook'unu kullanir; RolesManager / GrantsManager /
 * OverridesManager / EffectivePermissionsViewer bilesenlerini barindirir.
 */
import { useState } from 'react';

import type { AccessApi } from '../../application/ports/AccessApi';
import { useCustomRoles } from '../hooks/useCustomRoles';
import { usePermissionOverrides } from '../hooks/usePermissionOverrides';
import { useRoleGrants } from '../hooks/useRoleGrants';

import { EffectivePermissionsViewer } from './EffectivePermissionsViewer';
import { GrantsManager } from './GrantsManager';
import { OverridesManager } from './OverridesManager';
import { RolesManager } from './RolesManager';

export interface AccessPanelProps {
  api: AccessApi;
  companyId: number;
}

type SubTab = 'roles' | 'grants' | 'overrides' | 'effective';

export function AccessPanel({ api, companyId }: AccessPanelProps): JSX.Element {
  const [subTab, setSubTab] = useState<SubTab>('roles');

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <nav style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <SubTabButton active={subTab === 'roles'} onClick={() => setSubTab('roles')}>
          Roller
        </SubTabButton>
        <SubTabButton active={subTab === 'grants'} onClick={() => setSubTab('grants')}>
          Atamalar
        </SubTabButton>
        <SubTabButton active={subTab === 'overrides'} onClick={() => setSubTab('overrides')}>
          Override&apos;lar
        </SubTabButton>
        <SubTabButton active={subTab === 'effective'} onClick={() => setSubTab('effective')}>
          Etkin Izinler
        </SubTabButton>
      </nav>

      {subTab === 'roles' ? <RolesSection api={api} companyId={companyId} /> : null}
      {subTab === 'grants' ? <GrantsSection api={api} companyId={companyId} /> : null}
      {subTab === 'overrides' ? <OverridesSection api={api} companyId={companyId} /> : null}
      {subTab === 'effective' ? (
        <EffectivePermissionsViewer api={api} companyId={companyId} />
      ) : null}
    </div>
  );
}

function RolesSection({ api, companyId }: AccessPanelProps): JSX.Element {
  const { roles, catalog, loading, error, refetch, createRole, updateRole, deleteRole } =
    useCustomRoles(api, companyId);
  return (
    <RolesManager
      roles={roles}
      catalog={catalog}
      companyId={companyId}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      onCreate={createRole}
      onUpdate={updateRole}
      onDelete={deleteRole}
    />
  );
}

function GrantsSection({ api, companyId }: AccessPanelProps): JSX.Element {
  const { grants, roles, loading, error, refetch, createGrant, deleteGrant } = useRoleGrants(
    api,
    companyId,
  );
  return (
    <GrantsManager
      grants={grants}
      roles={roles}
      companyId={companyId}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      onCreate={createGrant}
      onDelete={deleteGrant}
    />
  );
}

function OverridesSection({ api, companyId }: AccessPanelProps): JSX.Element {
  const { overrides, catalog, loading, error, refetch, setOverride, deleteOverride } =
    usePermissionOverrides(api, companyId);
  return (
    <OverridesManager
      overrides={overrides}
      catalog={catalog}
      companyId={companyId}
      loading={loading}
      error={error}
      onReload={() => void refetch()}
      onUpsert={setOverride}
      onDelete={deleteOverride}
    />
  );
}

function SubTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        border: '1px solid var(--line, #d1d5db)',
        borderRadius: 4,
        background: active ? 'var(--accent, #0066cc)' : 'var(--paper, #fff)',
        color: active ? '#fff' : 'var(--ink, #111)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
