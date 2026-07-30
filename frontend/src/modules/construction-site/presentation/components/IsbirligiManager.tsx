/**
 * IsbirligiManager — İşbirliği ekranı (FAZ 11).
 * TEK menü + 3 iç sekme: Duyuru Panosu / Proje Ekibi / Galeri.
 *
 * OKUNMA: gönderi GENİŞLETİLİNCE mark-read çağrılır — listede başlık görmek
 * "okudu" sayılmaz. Rozet "M/N okudu" hedef kitle üzerinden; payda 0 iken
 * oran basılmaz ("hedef kitle tanımsız" ayrıca yazılır, 0 değil).
 *
 * DÜZENLEME İZİ: edited_at dolu gönderi "düzenlendi" damgası taşır — okuyan,
 * gördüğü metnin sonradan değiştiğini bilir. Silme yumuşaktır ve onay metni
 * bunu söyler.
 *
 * GALERİ: liste META ile kurulur; baytlar Authorization gerektirdiğinden
 * <img src> yerine blob URL fetch edilir ve bileşen sökülünce serbest bırakılır.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import type {
  MemberRole,
  PostDetailDto,
  PostDto,
  ProjectMemberDto,
  ProjectPhotoDto,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';
import { csT, memberRoleLabel } from '../../i18n';
import { useProjects } from '../hooks/useProjects';

export interface IsbirligiManagerProps {
  api: ConstructionApi;
  companyId: number;
  lang?: string | undefined;
  canCreate?: boolean | undefined;
  confirmAsync?: ((message: string) => Promise<boolean>) | undefined;
}

const box: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: 12,
  background: '#fff',
};
const label: CSSProperties = { fontSize: 12, color: '#64748b', display: 'block', marginBottom: 2 };
const input: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};
const btn: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: 12,
};
const btnPrimary: CSSProperties = {
  ...btn,
  background: '#2563eb',
  border: '1px solid #2563eb',
  color: '#fff',
};
const btnDanger: CSSProperties = {
  ...btn,
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  color: '#b91c1c',
};
const errBox: CSSProperties = {
  border: '1px solid #fca5a5',
  background: '#fef2f2',
  color: '#b91c1c',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
};
const chip: CSSProperties = {
  display: 'inline-block',
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const ROLES: MemberRole[] = [
  'manager',
  'site_chief',
  'engineer',
  'foreman',
  'accountant',
  'viewer',
  'other',
];

type Tab = 'wall' | 'team' | 'gallery';

export function IsbirligiManager({
  api,
  companyId,
  lang,
  canCreate = true,
  confirmAsync,
}: IsbirligiManagerProps): JSX.Element {
  const { projects } = useProjects(api, companyId);
  const [projectId, setProjectId] = useState(0);
  const [tab, setTab] = useState<Tab>('wall');
  const [error, setError] = useState<string | null>(null);

  const t = useCallback(
    (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => csT(k, lang, vars),
    [lang],
  );
  const confirm = useCallback(
    async (msg: string): Promise<boolean> => {
      if (confirmAsync) return confirmAsync(msg);
      return Promise.resolve(globalThis.confirm(msg));
    },
    [confirmAsync],
  );

  const TABS: { id: Tab; labelKey: Parameters<typeof csT>[0] }[] = [
    { id: 'wall', labelKey: 'cs.cb.tab.wall' },
    { id: 'team', labelKey: 'cs.cb.tab.team' },
    { id: 'gallery', labelKey: 'cs.cb.tab.gallery' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t('cs.cb.title')}</h2>
          <div style={{ fontSize: 12, color: '#64748b', maxWidth: 720 }}>{t('cs.cb.subtitle')}</div>
        </div>
        <div style={{ marginLeft: 'auto', minWidth: 220 }}>
          <span style={label}>{t('cs.common.project')}</span>
          <select
            style={input}
            value={projectId}
            onChange={(e) => {
              setProjectId(Number(e.target.value));
            }}
          >
            <option value={0}>{t('cs.common.selectProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {TABS.map(({ id, labelKey }) => (
          <button
            key={id}
            style={tab === id ? btnPrimary : btn}
            onClick={() => {
              setTab(id);
            }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {error !== null && <div style={errBox}>{error}</div>}

      {projectId > 0 && tab === 'wall' && (
        <WallPanel
          api={api}
          companyId={companyId}
          projectId={projectId}
          t={t}
          canCreate={canCreate}
          confirm={confirm}
          onError={setError}
        />
      )}
      {projectId > 0 && tab === 'team' && (
        <TeamPanel
          api={api}
          companyId={companyId}
          projectId={projectId}
          lang={lang}
          t={t}
          canCreate={canCreate}
          confirm={confirm}
          onError={setError}
        />
      )}
      {projectId > 0 && tab === 'gallery' && (
        <GalleryPanel
          api={api}
          companyId={companyId}
          projectId={projectId}
          t={t}
          canCreate={canCreate}
          confirm={confirm}
          onError={setError}
        />
      )}
    </div>
  );
}

// ===== DUYURU PANOSU ========================================================

function WallPanel({
  api,
  companyId,
  projectId,
  t,
  canCreate,
  confirm,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  t: (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => string;
  canCreate: boolean;
  confirm: (msg: string) => Promise<boolean>;
  onError: (msg: string | null) => void;
}): JSX.Element {
  const [posts, setPosts] = useState<ReadonlyArray<PostDto>>([]);
  const [members, setMembers] = useState<ReadonlyArray<ProjectMemberDto>>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<PostDetailDto | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [recipients, setRecipients] = useState<ReadonlySet<number>>(new Set());
  const [comment, setComment] = useState('');

  const load = useCallback(async (): Promise<void> => {
    try {
      const [p, m] = await Promise.all([
        api.listPosts(projectId, companyId),
        api.listProjectMembers(projectId, companyId),
      ]);
      setPosts(p.posts);
      setMembers(m.members);
      onError(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, onError, projectId]);

  useEffect(() => {
    setExpanded(null);
    setDetail(null);
    void load();
  }, [load]);

  const openPost = useCallback(
    async (p: PostDto): Promise<void> => {
      if (expanded === p.id) {
        setExpanded(null);
        setDetail(null);
        return;
      }
      setExpanded(p.id);
      setDetail(null);
      try {
        // Genişletmek = okumak: okundu işareti burada atılır (idempotent, ilk
        // an korunur). Liste çekmek okundu saymaz.
        await api.markPostRead(p.id, companyId);
        setDetail(await api.getPost(p.id, companyId));
        const refreshed = await api.listPosts(projectId, companyId);
        setPosts(refreshed.posts);
        onError(null);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    },
    [api, companyId, expanded, onError, projectId],
  );

  const publish = async (): Promise<void> => {
    if (body.trim() === '') return;
    try {
      await api.createPost(projectId, {
        companyId,
        title: title.trim() === '' ? null : title.trim(),
        body: body.trim(),
        pinned,
        ...(recipients.size > 0
          ? {
              recipients: members
                .filter((m) => recipients.has(m.userId))
                .map((m) => ({ userId: m.userId, userName: m.memberName })),
            }
          : {}),
      });
      setTitle('');
      setBody('');
      setPinned(false);
      setRecipients(new Set());
      onError(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (p: PostDto): Promise<void> => {
    if (!(await confirm(t('cs.cb.wall.deleteConfirm')))) return;
    try {
      await api.deletePost(p.id, companyId);
      if (expanded === p.id) {
        setExpanded(null);
        setDetail(null);
      }
      onError(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const togglePin = async (p: PostDto): Promise<void> => {
    try {
      await api.updatePost(p.id, { companyId, pinned: !p.pinned });
      onError(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const addComment = async (postId: number): Promise<void> => {
    if (comment.trim() === '') return;
    try {
      await api.addPostComment(postId, { companyId, body: comment.trim() });
      setComment('');
      setDetail(await api.getPost(postId, companyId));
      onError(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canCreate && (
        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            {t('cs.cb.wall.new')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              style={input}
              placeholder={t('cs.cb.wall.titleField')}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
            />
            <textarea
              style={{ ...input, minHeight: 60, resize: 'vertical' }}
              placeholder={t('cs.cb.wall.bodyField')}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
              }}
            />
            {members.length > 0 && (
              <div title={t('cs.cb.wall.recipientsHint')}>
                <span style={label}>{t('cs.cb.wall.recipients')}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {members.map((m) => (
                    <label
                      key={m.userId}
                      style={{ fontSize: 12, display: 'inline-flex', gap: 4, alignItems: 'center' }}
                    >
                      <input
                        type="checkbox"
                        checked={recipients.has(m.userId)}
                        onChange={(e) => {
                          const next = new Set(recipients);
                          if (e.target.checked) next.add(m.userId);
                          else next.delete(m.userId);
                          setRecipients(next);
                        }}
                      />
                      {m.memberName}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 12, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => {
                    setPinned(e.target.checked);
                  }}
                />
                {t('cs.cb.wall.pin')}
              </label>
              <button
                style={{ ...btnPrimary, marginLeft: 'auto' }}
                disabled={body.trim() === ''}
                onClick={() => void publish()}
              >
                {t('cs.cb.wall.publish')}
              </button>
            </div>
          </div>
        </div>
      )}

      {posts.length === 0 && (
        <div style={{ fontSize: 13, color: '#64748b' }}>{t('cs.cb.wall.empty')}</div>
      )}

      {posts.map((p) => (
        <div key={p.id} style={{ ...box, borderLeft: p.pinned ? '3px solid #b45309' : undefined }}>
          <button
            type="button"
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              cursor: 'pointer',
              flexWrap: 'wrap',
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              font: 'inherit',
            }}
            onClick={() => void openPost(p)}
          >
            {p.pinned && (
              <span
                style={{
                  ...chip,
                  color: '#b45309',
                  background: '#b4530911',
                  border: '1px solid #b4530955',
                }}
              >
                {t('cs.cb.wall.pinned')}
              </span>
            )}
            <span style={{ fontWeight: 700, fontSize: 14 }}>{p.title ?? p.body.slice(0, 60)}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {p.authorName} · {p.createdAt.slice(0, 10)}
              {p.editedAt !== null && <em> · {t('cs.cb.wall.edited')}</em>}
            </span>
            <span
              style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}
            >
              {!p.myRead && (
                <span
                  style={{
                    ...chip,
                    color: '#b91c1c',
                    background: '#b91c1c11',
                    border: '1px solid #b91c1c55',
                  }}
                >
                  {t('cs.cb.wall.myUnread')}
                </span>
              )}
              <span
                style={{
                  ...chip,
                  color: '#0369a1',
                  background: '#0369a111',
                  border: '1px solid #0369a155',
                }}
                title={
                  p.readPct === null
                    ? t('cs.cb.wall.readPctUnknown')
                    : `${String(Math.round(p.readPct))}%`
                }
              >
                {p.recipientCount > 0
                  ? t('cs.cb.wall.readStats', { read: p.targetReadCount, total: p.recipientCount })
                  : t('cs.cb.wall.readPctUnknown')}
              </span>
              {p.commentCount > 0 && (
                <span style={{ fontSize: 11, color: '#64748b' }}>💬 {p.commentCount}</span>
              )}
            </span>
          </button>

          {expanded === p.id && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{p.body}</div>
              {canCreate && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={btn} onClick={() => void togglePin(p)}>
                    {p.pinned ? t('cs.cb.wall.unpin') : t('cs.cb.wall.pin')}
                  </button>
                  <button style={btnDanger} onClick={() => void remove(p)}>
                    {t('cs.common.delete')}
                  </button>
                </div>
              )}
              {detail !== null && detail.post.id === p.id && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ ...box, background: '#f8fafc' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                      {t('cs.cb.wall.readers')}
                    </div>
                    {detail.reads.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {t('cs.cb.wall.noReaders')}
                      </div>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                        {detail.reads.map((r) => (
                          <li key={r.userId}>
                            {r.userName || `#${String(r.userId)}`} —{' '}
                            {r.readAt.slice(0, 16).replace('T', ' ')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div style={{ ...box, background: '#f8fafc' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                      {t('cs.cb.wall.comments')}
                    </div>
                    {detail.comments.map((cm) => (
                      <div key={cm.id} style={{ fontSize: 12, marginBottom: 4 }}>
                        <strong>{cm.authorName || `#${String(cm.createdBy ?? 0)}`}:</strong>{' '}
                        {cm.body}
                      </div>
                    ))}
                    {canCreate && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input
                          style={{ ...input, flex: 1 }}
                          placeholder={t('cs.cb.wall.addComment')}
                          value={comment}
                          onChange={(e) => {
                            setComment(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void addComment(p.id);
                          }}
                        />
                        <button
                          style={btnPrimary}
                          disabled={comment.trim() === ''}
                          onClick={() => void addComment(p.id)}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== PROJE EKİBİ ==========================================================

function TeamPanel({
  api,
  companyId,
  projectId,
  lang,
  t,
  canCreate,
  confirm,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  lang: string | undefined;
  t: (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => string;
  canCreate: boolean;
  confirm: (msg: string) => Promise<boolean>;
  onError: (msg: string | null) => void;
}): JSX.Element {
  const [members, setMembers] = useState<ReadonlyArray<ProjectMemberDto>>([]);
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('engineer');
  const [memberTitle, setMemberTitle] = useState('');

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await api.listProjectMembers(projectId, companyId);
      setMembers(res.members);
      onError(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, onError, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async (): Promise<void> => {
    const uid = Number(userId);
    if (!Number.isInteger(uid) || uid <= 0 || name.trim() === '') return;
    try {
      await api.addProjectMember(projectId, {
        companyId,
        userId: uid,
        memberName: name.trim(),
        memberRole: role,
        title: memberTitle.trim() === '' ? null : memberTitle.trim(),
      });
      setUserId('');
      setName('');
      setMemberTitle('');
      onError(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (m: ProjectMemberDto): Promise<void> => {
    if (!(await confirm(t('cs.cb.team.removeConfirm')))) return;
    try {
      await api.removeProjectMember(m.id, companyId);
      onError(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canCreate && (
        <div style={box} title={t('cs.cb.team.denomHint')}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            {t('cs.cb.team.add')}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ width: 110 }}>
              <span style={label}>{t('cs.cb.team.userId')} *</span>
              <input
                style={input}
                type="number"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                }}
              />
            </div>
            <div style={{ minWidth: 180, flex: 1 }}>
              <span style={label}>{t('cs.cb.team.name')} *</span>
              <input
                style={input}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                }}
              />
            </div>
            <div style={{ minWidth: 140 }}>
              <span style={label}>{t('cs.cb.team.role')}</span>
              <select
                style={input}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as MemberRole);
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {memberRoleLabel(r, lang)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <span style={label}>{t('cs.cb.team.titleField')}</span>
              <input
                style={input}
                value={memberTitle}
                onChange={(e) => {
                  setMemberTitle(e.target.value);
                }}
              />
            </div>
            <button
              style={btnPrimary}
              disabled={userId.trim() === '' || name.trim() === ''}
              onClick={() => void add()}
            >
              {t('cs.common.add')}
            </button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <div style={{ fontSize: 13, color: '#64748b' }}>{t('cs.cb.team.empty')}</div>
      ) : (
        <div style={{ ...box, padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {[
                  t('cs.cb.team.userId'),
                  t('cs.cb.team.name'),
                  t('cs.cb.team.role'),
                  t('cs.cb.team.titleField'),
                  '',
                ].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '5px 7px',
                      fontSize: 11,
                      background: '#f8fafc',
                      textAlign: 'left',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ padding: '5px 7px', fontSize: 12 }}>#{m.userId}</td>
                  <td style={{ padding: '5px 7px', fontSize: 12, fontWeight: 600 }}>
                    {m.memberName}
                  </td>
                  <td style={{ padding: '5px 7px', fontSize: 12 }}>
                    {memberRoleLabel(m.memberRole, lang)}
                  </td>
                  <td style={{ padding: '5px 7px', fontSize: 12 }}>{m.title ?? '—'}</td>
                  <td style={{ padding: '5px 7px', textAlign: 'right' }}>
                    {canCreate && (
                      <button style={btnDanger} onClick={() => void remove(m)}>
                        {t('cs.cb.team.remove')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== GALERİ ===============================================================

function GalleryPanel({
  api,
  companyId,
  projectId,
  t,
  canCreate,
  confirm,
  onError,
}: {
  api: ConstructionApi;
  companyId: number;
  projectId: number;
  t: (k: Parameters<typeof csT>[0], vars?: Record<string, string | number>) => string;
  canCreate: boolean;
  confirm: (msg: string) => Promise<boolean>;
  onError: (msg: string | null) => void;
}): JSX.Element {
  const [photos, setPhotos] = useState<ReadonlyArray<ProjectPhotoDto>>([]);
  const [blobUrls, setBlobUrls] = useState<Record<number, string>>({});
  const [caption, setCaption] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [locationId, setLocationId] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const urlsRef = useRef<Record<number, string>>({});

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await api.listProjectPhotos(projectId, companyId);
      setPhotos(res.photos);
      onError(null);
      // Baytlar Authorization ister — blob URL kurulur, eskiler bırakılır.
      const next: Record<number, string> = {};
      for (const ph of res.photos) {
        if (!ph.hasContent) continue;
        try {
          const blob = await api.fetchPhotoBlob(ph.id, companyId);
          next[ph.id] = URL.createObjectURL(blob);
        } catch {
          // tek fotoğrafın inememesi galeriyi düşürmez
        }
      }
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url);
      urlsRef.current = next;
      setBlobUrls(next);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  }, [api, companyId, onError, projectId]);

  useEffect(() => {
    void load();
    return () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url);
      urlsRef.current = {};
    };
  }, [load]);

  const add = async (): Promise<void> => {
    const file = fileRef.current?.files?.[0] ?? null;
    if (file === null && fileUrl.trim() === '') {
      onError(t('cs.cb.gal.needPayload'));
      return;
    }
    try {
      let contentBase64: string | null = null;
      let mimeType: string | null = null;
      if (file !== null) {
        const buf = await file.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (const b of bytes) bin += String.fromCharCode(b);
        contentBase64 = btoa(bin);
        mimeType = file.type || 'application/octet-stream';
      }
      await api.addProjectPhoto(projectId, {
        companyId,
        title: caption.trim() === '' ? null : caption.trim(),
        takenAt: takenAt === '' ? null : takenAt,
        locationId: locationId.trim() === '' ? null : Number(locationId),
        fileUrl: fileUrl.trim() === '' ? null : fileUrl.trim(),
        contentBase64,
        mimeType,
      });
      setCaption('');
      setTakenAt('');
      setLocationId('');
      setFileUrl('');
      if (fileRef.current) fileRef.current.value = '';
      onError(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (ph: ProjectPhotoDto): Promise<void> => {
    if (!(await confirm(t('cs.cb.gal.deleteConfirm')))) return;
    try {
      await api.deleteProjectPhoto(ph.id, companyId);
      onError(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canCreate && (
        <div style={box}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{t('cs.cb.gal.add')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 200 }}>
              <span style={label}>{t('cs.cb.gal.file')}</span>
              <input style={input} type="file" accept="image/*" ref={fileRef} />
            </div>
            <div style={{ minWidth: 160 }}>
              <span style={label}>{t('cs.cb.gal.url')}</span>
              <input
                style={input}
                value={fileUrl}
                onChange={(e) => {
                  setFileUrl(e.target.value);
                }}
              />
            </div>
            <div style={{ minWidth: 160, flex: 1 }}>
              <span style={label}>{t('cs.cb.gal.titleField')}</span>
              <input
                style={input}
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                }}
              />
            </div>
            <div>
              <span style={label}>{t('cs.cb.gal.takenAt')}</span>
              <input
                style={input}
                type="date"
                value={takenAt}
                onChange={(e) => {
                  setTakenAt(e.target.value);
                }}
              />
            </div>
            <div style={{ width: 130 }} title={t('cs.cb.gal.locationHint')}>
              <span style={label}>{t('cs.cb.gal.location')}</span>
              <input
                style={input}
                type="number"
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                }}
              />
            </div>
            <button style={btnPrimary} onClick={() => void add()}>
              {t('cs.common.add')}
            </button>
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        <div style={{ fontSize: 13, color: '#64748b' }}>{t('cs.cb.gal.empty')}</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}
        >
          {photos.map((ph) => (
            <div key={ph.id} style={{ ...box, padding: 8 }}>
              {blobUrls[ph.id] !== undefined ? (
                <img
                  src={blobUrls[ph.id]}
                  alt={ph.title ?? ''}
                  style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 6 }}
                />
              ) : ph.fileUrl !== null ? (
                <a
                  href={ph.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, display: 'block', padding: '40px 0', textAlign: 'center' }}
                >
                  {t('cs.cb.gal.external')} ↗
                </a>
              ) : (
                <div style={{ height: 130, background: '#f1f5f9', borderRadius: 6 }} />
              )}
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{ph.title ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {ph.takenAt ?? ph.createdAt.slice(0, 10)}
                {ph.locationPath !== null && <> · {ph.locationPath}</>}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{ph.authorName}</div>
              {canCreate && (
                <button style={{ ...btnDanger, marginTop: 6 }} onClick={() => void remove(ph)}>
                  {t('cs.common.delete')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
