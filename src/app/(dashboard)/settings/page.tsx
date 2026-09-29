'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, sendJson } from '@/lib/ui';
import { ActionButton, Card, Notice, PageHeader } from '@/components/ui';
import { useDialog } from '@/components/Modal';

type Provider = 'anthropic' | 'openai' | 'gemini';
interface KeySummary {
  preferredProvider: Provider;
  active: Provider[];
  providers: Record<Provider, { label: string; stored: boolean; hint: string | null }>;
}

const PROVIDERS: { id: Provider; field: string; placeholder: string; where: string; href: string }[] = [
  { id: 'anthropic', field: 'anthropicKey', placeholder: 'sk-ant-…', where: 'console.anthropic.com', href: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', field: 'openaiKey', placeholder: 'sk-…', where: 'platform.openai.com', href: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', field: 'geminiKey', placeholder: 'AIza…', where: 'aistudio.google.com', href: 'https://aistudio.google.com/app/apikey' },
];

export default function SettingsPage() {
  const dialog = useDialog();
  const [keys, setKeys] = useState<KeySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setKeys(await getJson<KeySummary>('/api/user/keys'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const put = async (body: Record<string, unknown>, msg: string) => {
    setError(null);
    setNotice(null);
    try {
      setKeys(await sendJson<KeySummary>('/api/user/keys', 'PUT', body));
      setNotice(msg);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };

  const none = keys !== null && keys.active.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Every research run, draft and critique is paid for with your own key. Add one provider or all three; whichever you add gets used."
      />

      {error && <Notice kind="error" onDismiss={() => setError(null)}>{error}</Notice>}
      {notice && <Notice kind="ok" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      {none && (
        <Notice kind="attention">
          No key yet. Nothing can be generated until you add one below. Keys are checked with the provider when you save, then
          stored encrypted.
        </Notice>
      )}

      {keys !== null && <FreeKeyGuide expanded={none} />}

      <Card title="AI provider keys" flush>
        <div className="divide-y divide-hairline">
          {PROVIDERS.map((p) => (
            <ProviderRow
              key={p.id}
              spec={p}
              state={keys?.providers[p.id] ?? null}
              preferred={keys?.preferredProvider === p.id}
              onSave={(value) => put({ [p.field]: value }, `${keys?.providers[p.id].label ?? p.id} key saved.`)}
              onRemove={async () => {
                const okay = await dialog.confirm({
                  title: `Remove your ${keys?.providers[p.id].label} key?`,
                  body: 'Runs will use your other stored keys, if any. You can paste it again any time.',
                  confirmLabel: 'Remove key',
                  danger: true,
                });
                if (okay) await put({ [p.field]: null }, `${keys?.providers[p.id].label} key removed.`).catch(() => undefined);
              }}
              onPrefer={() => put({ preferredProvider: p.id }, `${keys?.providers[p.id].label} is now tried first.`).catch(() => undefined)}
            />
          ))}
        </div>
      </Card>

      <Card title="How keys are used">
        <ul className="t-body-sm list-disc space-y-1.5 pl-5 text-body">
          <li>Calls go to your preferred provider first. If it has no key or rejects the key, the next stored one is tried.</li>
          <li>
            Research uses the provider&apos;s own web search (Anthropic web search, OpenAI web search, Google Search grounding),
            so every provider can source facts.
          </li>
          <li>Heavy stages (research, writing, critique) use the standard model; suggestions and ranking use the cheap one.</li>
          <li>Keys are encrypted at rest and never leave this deployment except to call the provider you chose.</li>
        </ul>
      </Card>
    </div>
  );
}

const FREE_KEY_STEPS: [string, React.ReactNode][] = [
  [
    'Open Google AI Studio',
    <>
      Go to{' '}
      <a className="text-primary hover:underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
        aistudio.google.com/app/apikey
      </a>{' '}
      and sign in with any Google account. No card is asked for.
    </>,
  ],
  [
    'Create an API key',
    <>
      Click <strong>Create API key</strong>. If it asks for a project, choose <strong>Create API key in new project</strong>.
      A key starting with <span className="font-mono">AIza</span> appears after a few seconds.
    </>,
  ],
  [
    'Copy it once',
    <>
      Copy the key now. Google shows it again later under the same page, but treat it like a password: do not paste it
      anywhere except the Gemini box below.
    </>,
  ],
  [
    'Paste it below and save',
    <>
      Put it in the <strong>Google Gemini</strong> row and press <strong>Save key</strong>. The app checks it with Google
      first, so a typo fails instantly instead of on your first post.
    </>,
  ],
];

/**
 * Gemini is the only one of the three with a real free tier, so a user with
 * no key at all is walked to it. Open by default when nothing is stored, a
 * one-line disclosure otherwise.
 */
function FreeKeyGuide({ expanded }: { expanded: boolean }) {
  const [open, setOpen] = useState(expanded);
  useEffect(() => setOpen(expanded), [expanded]);
  return (
    <Card
      title="Get a free key in two minutes"
      action={
        <button type="button" className="btn-text text-[12px]" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Show steps'}
        </button>
      }
      flush
    >
      {open ? (
        <div className="space-y-4">
          <p className="t-body-sm text-body">
            Anthropic and OpenAI both need prepaid credit before a key works. <strong>Google Gemini</strong> gives a free
            API key with no card, and its free tier covers this app comfortably for personal use.
          </p>
          <ol className="space-y-3">
            {FREE_KEY_STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-3.5">
                <span className="t-number w-5 shrink-0 pt-px text-[12px] text-muted-soft">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="t-title-sm">{title}</p>
                  <p className="t-body-sm mt-0.5 text-body">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="t-body-sm text-muted-soft">
            Limits on the free tier: a few hundred requests a day and a per-minute cap, which is a handful of posts a day.
            Google may use free-tier prompts to improve its models; a paid Gemini key removes that. If a run hits the cap,
            wait a minute and click Write a post again.
          </p>
        </div>
      ) : (
        <p className="t-body-sm text-body">
          No key yet? Google Gemini is free with no card. Show the steps to get one.
        </p>
      )}
    </Card>
  );
}

function ProviderRow({
  spec,
  state,
  preferred,
  onSave,
  onRemove,
  onPrefer,
}: {
  spec: (typeof PROVIDERS)[number];
  state: { label: string; stored: boolean; hint: string | null } | null;
  preferred: boolean;
  onSave: (value: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onPrefer: () => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);
  const label = state?.label ?? spec.id;
  const showInput = !state?.stored || editing;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="t-title-sm">{label}</span>
        {state?.stored ? (
          <span className="badge badge-up">stored {state.hint}</span>
        ) : (
          <span className="badge">not added</span>
        )}
        {preferred && state?.stored && <span className="badge badge-primary">tried first</span>}
        <a className="btn-text ml-auto text-[12px]" href={spec.href} target="_blank" rel="noreferrer">
          Get a key at {spec.where} ↗
        </a>
      </div>

      {showInput && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <input
            className="input w-full font-mono text-[13px]"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={spec.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton
              className="btn btn-primary"
              disabled={value.trim().length < 10}
              onClick={async () => {
                await onSave(value.trim());
                setValue('');
                setEditing(false);
              }}
              pendingLabel="Checking…"
            >
              {state?.stored ? 'Replace key' : 'Save key'}
            </ActionButton>
            {editing && (
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {state?.stored && !editing && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
            Replace
          </button>
          {!preferred && (
            <ActionButton className="btn btn-sm" onClick={onPrefer}>
              Try first
            </ActionButton>
          )}
          <ActionButton className="btn btn-sm btn-danger" onClick={onRemove}>
            Remove
          </ActionButton>
        </div>
      )}
    </div>
  );
}
