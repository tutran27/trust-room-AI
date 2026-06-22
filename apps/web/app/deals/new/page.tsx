'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from '@trustroom/ui';
import { AppShell } from '../../../components/app-shell';
import { AuthGate } from '../../../components/auth-gate';
import { useAnalyzeDeal, useCreateDeal } from '../../../hooks/use-api';

type CreateDealForm = {
  title: string;
  description: string;
  type: 'freelance_service' | 'nft' | 'token_otc' | 'digital_goods' | 'domain' | 'other';
  amount: string;
  token: 'SOL' | 'USDC' | 'SPL_TOKEN';
  deadline: string;
  sellerWallet: string;
};

const DEAL_TYPE_OPTIONS = [
  { label: 'Freelance service', value: 'freelance_service' },
  { label: 'NFT', value: 'nft' },
  { label: 'Token OTC', value: 'token_otc' },
  { label: 'Digital goods', value: 'digital_goods' },
  { label: 'Domain', value: 'domain' },
  { label: 'Other', value: 'other' },
] as const;

const TOKEN_OPTIONS = [
  { label: 'SOL', value: 'SOL' },
  { label: 'USDC', value: 'USDC' },
] as const;

function riskVariant(level?: string) {
  const normalized = String(level ?? '').toLowerCase();
  if (normalized === 'critical' || normalized === 'high') return 'danger' as const;
  if (normalized === 'medium') return 'warning' as const;
  if (normalized === 'low') return 'info' as const;
  return 'muted' as const;
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function objectList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
}

export default function CreateDealPage() {
  const router = useRouter();
  const createDeal = useCreateDeal();
  const analyzeDeal = useAnalyzeDeal();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CreateDealForm>({
    defaultValues: {
      title: '',
      description: '',
      type: 'freelance_service',
      amount: '100',
      token: 'SOL',
      deadline: '',
      sellerWallet: '',
    },
  });

  const descriptionValue = form.watch('description');
  const aiSummary = useMemo(() => analyzeDeal.data, [analyzeDeal.data]);
  const termRecord = (aiSummary?.terms ?? null) as Record<string, unknown> | null;
  const scamRecord = (aiSummary?.scamCheck ?? null) as Record<string, unknown> | null;

  return (
    <AuthGate>
      <AppShell
        title="Tạo deal mới"
        actions={
          <Link href="/dashboard">
            <Button variant="ghost">Quay lại dashboard</Button>
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin deal</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-5"
                onSubmit={form.handleSubmit(async (values) => {
                  setSubmitError(null);
                  try {
                    const created = await createDeal.mutateAsync({
                      title: values.title,
                      description: values.description || undefined,
                      type: values.type,
                      amount: values.amount,
                      token: values.token,
                      deadline: values.deadline || undefined,
                      sellerWallet: values.sellerWallet || undefined,
                    });
                    router.push(`/deals/${created.id}`);
                  } catch (error) {
                    setSubmitError(error instanceof Error ? error.message : 'Không thể tạo deal.');
                  }
                })}
              >
                <div className="grid gap-2">
                  <Label htmlFor="title">Tiêu đề deal</Label>
                  <Input
                    id="title"
                    placeholder="Ví dụ: OTC 5,000 USDC cho dịch vụ thiết kế"
                    {...form.register('title', { required: true })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Mô tả</Label>
                  <Textarea
                    id="description"
                    rows={6}
                    placeholder="Mô tả deliverable, điều kiện release, deadline, phạm vi bàn giao..."
                    {...form.register('description')}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Loại deal</Label>
                    <Select id="type" options={DEAL_TYPE_OPTIONS as never} {...form.register('type')} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="token">Token</Label>
                    <Select id="token" options={TOKEN_OPTIONS as never} {...form.register('token')} />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Số tiền</Label>
                    <Input id="amount" placeholder="1000" {...form.register('amount', { required: true })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input id="deadline" type="datetime-local" {...form.register('deadline')} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sellerWallet">Seller wallet</Label>
                  <Input
                    id="sellerWallet"
                    placeholder="Base58 wallet của seller"
                    {...form.register('sellerWallet')}
                  />
                </div>

                {submitError ? (
                  <Alert variant="danger" title="Không thể tạo deal">
                    {submitError}
                  </Alert>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={createDeal.isPending}>
                    {createDeal.isPending ? 'Đang tạo...' : 'Tạo deal'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!descriptionValue || analyzeDeal.isPending}
                    onClick={() => analyzeDeal.mutate({ dealDescription: descriptionValue })}
                  >
                    {analyzeDeal.isPending ? 'Đang phân tích...' : 'AI review mô tả'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiSummary ? (
                <>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant={riskVariant(aiSummary.risk.level)}>
                        {aiSummary.risk.level ?? 'unknown'}
                      </Badge>
                      <Badge variant="muted">score {aiSummary.risk.score ?? '—'}</Badge>
                      <Badge variant={aiSummary.llmAvailable ? 'success' : 'warning'}>
                        {aiSummary.llmAvailable ? 'LLM active' : 'fallback'}
                      </Badge>
                    </div>
                    {aiSummary.risk.recommendation ? (
                      <p className="text-sm leading-relaxed text-slate-700">
                        {aiSummary.risk.recommendation}
                      </p>
                    ) : null}
                  </div>

                  <div className="divide-y divide-slate-100">
                    {textList(termRecord?.summary).length ? (
                      <div className="py-3 first:pt-0">
                        <p className="mb-2 text-sm font-medium text-slate-900">Tóm tắt</p>
                        <div className="space-y-2 text-sm text-slate-500">
                          {textList(termRecord?.summary).map((item, index) => (
                            <p key={index}>{item}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {objectList(termRecord?.deliverables).length ? (
                      <div className="py-3">
                        <p className="mb-3 text-sm font-medium text-slate-900">Deliverables</p>
                        <div className="space-y-2">
                          {objectList(termRecord?.deliverables).map((item, index) => (
                            <div key={index} className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-sm text-slate-700">
                                {String(item.description ?? item.name ?? `Deliverable ${index + 1}`)}
                              </p>
                              {item.deadline ? (
                                <p className="mt-1 text-xs text-slate-400">Deadline: {String(item.deadline)}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {objectList(termRecord?.milestones).length ? (
                      <div className="py-3">
                        <p className="mb-3 text-sm font-medium text-slate-900">Milestones</p>
                        <div className="space-y-2">
                          {objectList(termRecord?.milestones).map((item, index) => (
                            <div key={index} className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-sm text-slate-700">
                                {String(item.name ?? `Milestone ${index + 1}`)}
                              </p>
                              {item.description ? (
                                <p className="mt-1 text-xs text-slate-400">{String(item.description)}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {objectList(scamRecord?.flags).length ? (
                      <div className="py-3 last:pb-0">
                        <p className="mb-3 text-sm font-medium text-slate-900">Cờ rủi ro</p>
                        <div className="space-y-2">
                          {objectList(scamRecord?.flags).map((flag, index) => (
                            <div key={index} className="rounded-lg bg-slate-50 px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={riskVariant(String(flag.severity ?? 'medium'))}>
                                  {String(flag.severity ?? 'medium')}
                                </Badge>
                                <Badge variant="muted">{String(flag.type ?? 'flag')}</Badge>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                                {String(flag.description ?? '')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Nhấn <strong>AI review mô tả</strong> để xem risk, deliverables và khuyến nghị.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
